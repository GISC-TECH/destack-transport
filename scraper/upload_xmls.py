#!/usr/bin/env python3
"""
Script para enviar XMLs baixados para a API do Destack Transport.
Envia cada XML um a um e reporta o progresso.
"""

import os
import sys
import glob
import time
import requests
from datetime import datetime

# Configuracoes
API_BASE_URL = os.getenv('DESTACK_API_URL', 'http://localhost:8001')
API_USERNAME = os.getenv('DESTACK_USERNAME', 'admin')
API_PASSWORD = os.getenv('DESTACK_PASSWORD', 'admin123')

DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), 'downloads')


class DestackUploader:
    """Cliente para upload de XMLs para a API Destack usando Basic Auth"""

    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip('/')
        # Garante que a base termine com /api para manter compatibilidade
        # com DESTACK_API_URL=http://destack:8000/api
        if not self.base_url.endswith('/api'):
            self.base_url = f"{self.base_url}/api"
        self.username = username
        self.password = password
        self.session = requests.Session()
        # Usar Basic Auth ao inves de Session Auth (evita problemas com CSRF)
        self.session.auth = (username, password)

    def login(self) -> bool:
        """Verifica autenticacao usando Basic Auth"""
        print(f"\n[LOGIN] Verificando autenticacao em {self.base_url}...")

        try:
            # Testar autenticacao com endpoint simples
            response = self.session.get(
                f"{self.base_url}/users/me/",
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                print(f"     Login OK! Usuario: {data.get('username', self.username)}")
                return True

            print(f"     Falha no login: {response.status_code} - {response.text[:100]}")
            return False

        except Exception as e:
            print(f"     Erro no login: {e}")
            return False

    def upload_xml(self, file_path: str) -> dict:
        """Envia um arquivo XML para a API usando Basic Auth"""
        filename = os.path.basename(file_path)

        try:
            with open(file_path, 'rb') as f:
                # Campo correto do serializer Django: arquivo_xml
                files = {'arquivo_xml': (filename, f, 'application/xml')}

                response = self.session.post(
                    f"{self.base_url}/upload/",
                    files=files,
                    timeout=60
                )

            if response.status_code in [200, 201]:
                return {
                    'success': True,
                    'filename': filename,
                    'response': response.json() if response.text else {}
                }
            elif response.status_code == 400:
                result = response.json() if response.text else {}
                error_msg = result.get('error', result.get('detail', str(result)))
                is_duplicate = 'duplicad' in str(error_msg).lower() or 'existe' in str(error_msg).lower() or 'ja existe' in str(error_msg).lower()
                return {
                    'success': False,
                    'duplicate': is_duplicate,
                    'filename': filename,
                    'error': error_msg
                }
            else:
                return {
                    'success': False,
                    'filename': filename,
                    'error': f"HTTP {response.status_code}: {response.text[:200]}"
                }

        except requests.exceptions.Timeout:
            return {'success': False, 'filename': filename, 'error': 'Timeout'}
        except Exception as e:
            return {'success': False, 'filename': filename, 'error': str(e)}

    def upload_all(self, xml_files: list, batch_size: int = 50) -> dict:
        """Envia todos os XMLs e reporta progresso"""
        total = len(xml_files)
        results = {
            'total': total,
            'success': 0,
            'duplicates': 0,
            'failed': 0,
            'errors': []
        }

        print(f"\n{'='*60}")
        print(f"Enviando {total} XMLs para {self.base_url}")
        print(f"{'='*60}")

        start_time = time.time()

        for i, file_path in enumerate(xml_files, 1):
            filename = os.path.basename(file_path)

            # Progresso a cada 10 arquivos
            if i % 10 == 0 or i == 1:
                elapsed = time.time() - start_time
                rate = i / elapsed if elapsed > 0 else 0
                eta = (total - i) / rate if rate > 0 else 0
                print(f"\n[{i}/{total}] ({i*100//total}%) - {rate:.1f} arquivos/s - ETA: {eta/60:.1f} min")

            result = self.upload_xml(file_path)

            if result.get('success'):
                results['success'] += 1
                print(f"  OK: {filename}")
            elif result.get('duplicate'):
                results['duplicates'] += 1
                # Nao imprime duplicados para nao poluir
            else:
                results['failed'] += 1
                results['errors'].append(result)
                print(f"  ERRO: {filename} - {result.get('error', 'Erro desconhecido')[:50]}")

            # Pequena pausa para nao sobrecarregar a API
            if i % batch_size == 0:
                time.sleep(0.5)

        elapsed = time.time() - start_time

        print(f"\n{'='*60}")
        print(f"RESULTADO FINAL")
        print(f"{'='*60}")
        print(f"  Total: {results['total']}")
        print(f"  Sucesso: {results['success']}")
        print(f"  Duplicados (ignorados): {results['duplicates']}")
        print(f"  Falhas: {results['failed']}")
        print(f"  Tempo: {elapsed/60:.1f} minutos")
        print(f"{'='*60}")

        return results


def find_xml_files(directory: str = DOWNLOADS_DIR) -> tuple:
    """Encontra todos os XMLs de CT-e e MDF-e"""
    cte_files = []
    mdfe_files = []

    # Procurar em subpastas
    for root, dirs, files in os.walk(directory):
        for f in files:
            if f.endswith('.xml'):
                full_path = os.path.join(root, f)
                if f.startswith('CTe') or 'cte' in root.lower():
                    cte_files.append(full_path)
                elif f.startswith('MDFe') or 'mdfe' in root.lower():
                    mdfe_files.append(full_path)

    return cte_files, mdfe_files


def main():
    """Funcao principal"""
    print("\n" + "="*60)
    print("DESTACK XML UPLOADER")
    print(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("="*60)

    # Encontrar XMLs
    print("\n[1] Buscando arquivos XML...")
    cte_files, mdfe_files = find_xml_files()

    print(f"    CT-e encontrados: {len(cte_files)}")
    print(f"    MDF-e encontrados: {len(mdfe_files)}")

    if not cte_files and not mdfe_files:
        print("\n    Nenhum XML encontrado!")
        return

    # Inicializar uploader
    uploader = DestackUploader(API_BASE_URL, API_USERNAME, API_PASSWORD)

    # Login
    print("\n[2] Autenticando na API...")
    if not uploader.login():
        print("    ERRO: Falha na autenticacao!")
        return

    # Upload CT-e
    if cte_files:
        print(f"\n[3] Enviando {len(cte_files)} CT-e...")
        cte_results = uploader.upload_all(cte_files)

    # Upload MDF-e
    if mdfe_files:
        print(f"\n[4] Enviando {len(mdfe_files)} MDF-e...")
        mdfe_results = uploader.upload_all(mdfe_files)

    print("\n" + "="*60)
    print("UPLOAD FINALIZADO!")
    print("="*60)


if __name__ == '__main__':
    main()
