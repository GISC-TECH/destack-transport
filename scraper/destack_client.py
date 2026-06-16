"""
Cliente para a API do Destack Transport
Envia XMLs coletados para processamento
"""
import os
import requests
from typing import Dict, Optional, List
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import DESTACK_API_URL, DESTACK_USERNAME, DESTACK_PASSWORD
from logger_setup import setup_logger

logger = setup_logger('destack_client')


class DestackClient:
    """Cliente para interagir com a API do Destack Transport"""

    def __init__(self):
        self.base_url = DESTACK_API_URL.rstrip('/')
        self.session = self._create_session()
        self.authenticated = False

    def _create_session(self) -> requests.Session:
        """Cria sessao HTTP com retry automatico"""
        session = requests.Session()

        # Configurar retry para resiliencia
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        return session

    def login(self) -> bool:
        """Autentica na API do Destack"""
        logger.info("Autenticando na API do Destack...")

        try:
            response = self.session.post(
                f"{self.base_url}/auth/login/",
                json={
                    'username': DESTACK_USERNAME,
                    'password': DESTACK_PASSWORD
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                # Guardar token se retornado
                if 'token' in data:
                    self.session.headers['Authorization'] = f"Token {data['token']}"
                elif 'access' in data:
                    self.session.headers['Authorization'] = f"Bearer {data['access']}"

                self.authenticated = True
                logger.info("Autenticacao bem sucedida!")
                return True
            else:
                logger.error(f"Falha na autenticacao: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.error(f"Erro ao autenticar: {e}")
            return False

    def upload_xml(self, file_path: str) -> Dict:
        """
        Envia um arquivo XML para a API do Destack.
        Retorna dict com resultado do processamento.
        Usa Basic Auth para evitar problemas de CSRF.
        """
        if not os.path.exists(file_path):
            logger.error(f"Arquivo nao encontrado: {file_path}")
            return {'success': False, 'error': 'Arquivo nao encontrado'}

        filename = os.path.basename(file_path)
        logger.info(f"Enviando XML: {filename}")

        try:
            with open(file_path, 'rb') as f:
                # Campo deve ser 'arquivo_xml' conforme esperado pelo serializer
                files = {'arquivo_xml': (filename, f, 'application/xml')}

                # Usar Basic Auth diretamente para evitar CSRF
                response = self.session.post(
                    f"{self.base_url}/upload/",
                    files=files,
                    auth=(DESTACK_USERNAME, DESTACK_PASSWORD),
                    timeout=60
                )

            if response.status_code in [200, 201, 202]:
                result = response.json()
                if response.status_code == 202:
                    logger.warning(f"XML recebido mas nao efetivado: {filename} - {result}")
                else:
                    logger.info(f"XML processado com sucesso: {filename}")
                return {
                    'success': True,
                    'accepted_without_effect': response.status_code == 202,
                    'data': result,
                    'filename': filename
                }
            elif response.status_code == 400:
                # Pode ser duplicado ou erro de validacao
                result = response.json()
                error_msg = result.get('error', result.get('detail', 'Erro desconhecido'))
                logger.warning(f"Erro ao processar {filename}: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg,
                    'filename': filename,
                    'duplicate': 'duplicad' in error_msg.lower() or 'existe' in error_msg.lower()
                }
            else:
                logger.error(f"Erro HTTP {response.status_code} ao enviar {filename}: {response.text}")
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}",
                    'filename': filename
                }

        except requests.exceptions.Timeout:
            logger.error(f"Timeout ao enviar {filename}")
            return {'success': False, 'error': 'Timeout', 'filename': filename}
        except Exception as e:
            logger.error(f"Erro ao enviar {filename}: {e}")
            return {'success': False, 'error': str(e), 'filename': filename}

    def upload_batch(self, file_paths: List[str]) -> Dict:
        """
        Envia multiplos XMLs em lote.
        Retorna estatisticas do processamento.
        """
        results = {
            'total': len(file_paths),
            'success': 0,
            'failed': 0,
            'duplicates': 0,
            'details': []
        }

        for file_path in file_paths:
            result = self.upload_xml(file_path)
            results['details'].append(result)

            if result.get('success'):
                results['success'] += 1
            elif result.get('duplicate'):
                results['duplicates'] += 1
            else:
                results['failed'] += 1

        logger.info(
            f"Lote processado: {results['success']} sucesso, "
            f"{results['duplicates']} duplicados, {results['failed']} falhas"
        )

        return results

    def check_existing_chaves(self, chaves: List[str], chunk_size: int = 500) -> Dict:
        """
        Consulta a API para verificar quais chaves já existem no banco.
        Retorna dict com sets 'existing' e 'missing'.
        Fallback seguro: se falhar, trata todas como novas.
        """
        all_existing = set()
        all_chaves = set(chaves)

        try:
            for i in range(0, len(chaves), chunk_size):
                chunk = chaves[i:i + chunk_size]
                response = self.session.post(
                    f"{self.base_url}/upload/check_exists/",
                    json={"chaves": chunk},
                    auth=(DESTACK_USERNAME, DESTACK_PASSWORD),
                    timeout=30
                )

                if response.status_code == 200:
                    data = response.json()
                    all_existing.update(data.get('existing', []))
                else:
                    logger.warning(
                        f"check_exists retornou HTTP {response.status_code} "
                        f"para chunk {i}-{i+len(chunk)}. "
                        f"Fallback: tratando todas como novas."
                    )
                    return {'existing': set(), 'missing': all_chaves}

        except Exception as e:
            logger.warning(f"Erro ao consultar check_exists: {e}. Fallback: tratando todas como novas.")
            return {'existing': set(), 'missing': all_chaves}

        missing = all_chaves - all_existing
        logger.info(f"Check exists: {len(all_existing)} existentes, {len(missing)} novas de {len(all_chaves)} total")
        return {'existing': all_existing, 'missing': missing}

    def check_health(self) -> bool:
        """Verifica se a API esta acessivel"""
        try:
            response = self.session.get(
                f"{self.base_url}/",
                timeout=10
            )
            return response.status_code < 500
        except Exception as e:
            logger.warning(f"API nao acessivel: {e}")
            return False
