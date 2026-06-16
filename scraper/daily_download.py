"""
Script para download diário de XMLs de CT-e e MDF-e do EGS Sistemas.
Pode ser executado manualmente ou agendado via Task Scheduler/cron.

Uso:
    python daily_download.py              # Baixa notas de hoje
    python daily_download.py 05/12/2025   # Baixa notas de uma data específica
"""
import os
import sys
import re
import time
import glob
import zipfile
import shutil
from datetime import datetime

from browser import BrowserManager
from egs_client import EGSClient
from destack_client import DestackClient
from config import DOWNLOAD_DIR
from logger_setup import setup_logger

logger = setup_logger('daily_download')


def download_daily_xmls(target_date: str = None):
    """
    Baixa XMLs de CT-e e MDF-e para uma data específica (ou hoje).

    Args:
        target_date: Data no formato DD/MM/YYYY (se None, usa data de hoje)
    """
    if target_date is None:
        target_date = datetime.now().strftime('%d/%m/%Y')

    # Criar pasta do dia
    date_folder = target_date.replace('/', '-')
    output_folder = os.path.join(DOWNLOAD_DIR, f"xmls_{date_folder}")
    os.makedirs(output_folder, exist_ok=True)

    logger.info("=" * 60)
    logger.info(f"DOWNLOAD DIÁRIO DE XMLs - Data: {target_date}")
    logger.info(f"Pasta de destino: {output_folder}")
    logger.info(f"Horário: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    logger.info("=" * 60)

    browser = None
    cte_count = 0
    mdfe_count = 0

    try:
        # Iniciar browser
        logger.info("Iniciando browser...")
        browser = BrowserManager()
        if not browser.start():
            logger.error("Falha ao iniciar browser")
            return False

        # Criar cliente EGS
        client = EGSClient(browser)

        # Fazer login
        logger.info("-" * 40)
        logger.info("Realizando login...")
        logger.info("-" * 40)

        if not client.login():
            logger.error("FALHA NO LOGIN!")
            return False

        logger.info("LOGIN OK!")

        # Baixar CT-e
        logger.info("-" * 40)
        logger.info("Baixando CT-e...")
        logger.info("-" * 40)
        cte_count = download_cte_daily(client, output_folder)
        logger.info(f"CT-e: {cte_count} XMLs baixados")

        # Baixar MDF-e
        logger.info("-" * 40)
        logger.info("Baixando MDF-e...")
        logger.info("-" * 40)
        mdfe_count = download_mdfe_daily(client, output_folder)
        logger.info(f"MDF-e: {mdfe_count} XMLs baixados")

        # Resultado do download
        total_downloaded = cte_count + mdfe_count
        logger.info("")
        logger.info("=" * 60)
        logger.info("DOWNLOAD CONCLUÍDO!")
        logger.info(f"Data: {target_date}")
        logger.info(f"CT-e: {cte_count} XMLs")
        logger.info(f"MDF-e: {mdfe_count} XMLs")
        logger.info(f"Total: {total_downloaded} XMLs")
        logger.info(f"Pasta: {output_folder}")
        logger.info("=" * 60)

        # Enviar XMLs para a API do Destack
        if total_downloaded > 0:
            logger.info("")
            logger.info("-" * 40)
            logger.info("Enviando XMLs para API do Destack...")
            logger.info("-" * 40)
            upload_result = upload_xmls_to_api(output_folder)
            logger.info(f"Enviados: {upload_result['success']} | Ignorados (já existem): {upload_result['skipped']} | Duplicados: {upload_result['duplicates']} | Falhas: {upload_result['failed']}")
        else:
            logger.info("Nenhum XML para enviar")

        logger.info("")
        logger.info("=" * 60)
        logger.info("PROCESSO DIÁRIO FINALIZADO!")
        logger.info("=" * 60)

        return True

    except Exception as e:
        logger.error(f"Erro durante download: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        if browser:
            logger.info("Fechando browser...")
            try:
                browser.driver.quit()
            except:
                pass


def extract_chave_from_filename(filename: str):
    """Extrai chave de 44 dígitos do nome do arquivo."""
    match = re.search(r'(\d{44})', filename)
    return match.group(1) if match else None


def is_event_xml_file(file_path: str) -> bool:
    """Identifica XML de evento, como cancelamento, CC-e ou retorno SEFAZ."""
    filename = os.path.basename(file_path).lower()
    if any(marker in filename for marker in ('_canc', 'procevento', 'retevento', 'evento')):
        return True

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as xml_file:
            sample = xml_file.read(4096).lower()
    except OSError:
        return False

    return any(
        marker in sample
        for marker in (
            '<proceventocte',
            '<proceventomdfe',
            '<reteventocte',
            '<reteventomdfe',
            '<eventocte',
            '<eventomdfe',
        )
    )


def sort_xml_upload_order(file_paths: list) -> list:
    """Garante que XMLs principais sejam enviados antes dos eventos da mesma chave."""
    def upload_order(file_path):
        filename = os.path.basename(file_path).lower()
        is_event = is_event_xml_file(file_path)
        is_return = 'retevento' in filename
        chave = extract_chave_from_filename(filename) or ''
        return (chave, 2 if is_return else 1 if is_event else 0, filename)

    return sorted(file_paths, key=upload_order)


def upload_xmls_to_api(folder_path: str) -> dict:
    """
    Envia XMLs novos de uma pasta para a API do Destack.
    Pré-verifica quais chaves já existem para evitar reprocessamento.
    Retorna estatísticas do envio.
    """
    result = {'success': 0, 'failed': 0, 'duplicates': 0, 'skipped': 0, 'total': 0}

    # Encontrar todos os XMLs na pasta
    xml_files = glob.glob(os.path.join(folder_path, "**/*.xml"), recursive=True)
    result['total'] = len(xml_files)

    if not xml_files:
        logger.info("Nenhum arquivo XML encontrado para enviar")
        return result

    logger.info(f"Encontrados {len(xml_files)} arquivos XML")

    # Fase 1: Extrair chaves dos filenames
    files_with_chaves = {}  # chave -> [file_paths]
    files_without_chaves = []

    for xml_path in xml_files:
        filename = os.path.basename(xml_path)
        chave = extract_chave_from_filename(filename)
        if chave:
            files_with_chaves.setdefault(chave, []).append(xml_path)
        else:
            files_without_chaves.append(xml_path)

    logger.info(f"Chaves extraídas: {len(files_with_chaves)} únicas, {len(files_without_chaves)} sem chave")

    # Conectar à API
    destack = DestackClient()
    if not destack.login():
        logger.error("Falha ao conectar na API do Destack")
        result['failed'] = len(xml_files)
        return result

    # Fase 2: Consultar API para saber quais já existem
    all_chaves = list(files_with_chaves.keys())
    check_result = destack.check_existing_chaves(all_chaves)
    existing_chaves = check_result['existing']
    missing_chaves = check_result['missing']

    # Fase 3: Filtrar - separar novos dos existentes.
    # Eventos devem ser enviados mesmo quando a chave principal ja existe: cancelamentos
    # podem chegar depois da CT-e/MDF-e original.
    files_to_upload = []
    for chave in missing_chaves:
        files_to_upload.extend(files_with_chaves[chave])

    skipped_count = 0
    for chave in existing_chaves:
        for xml_path in files_with_chaves[chave]:
            if is_event_xml_file(xml_path):
                files_to_upload.append(xml_path)
            else:
                skipped_count += 1

    result['skipped'] = skipped_count

    # Arquivos sem chave sempre são enviados (a API decidirá)
    files_to_upload.extend(files_without_chaves)
    files_to_upload = sort_xml_upload_order(files_to_upload)

    logger.info(
        f"Pré-verificação: {skipped_count} XMLs ignorados (já existem), "
        f"{len(files_to_upload)} XMLs para enviar"
    )

    if not files_to_upload:
        logger.info("Todos os XMLs já existem na API. Nada a enviar.")
        return result

    # Fase 4: Upload dos novos
    for xml_path in files_to_upload:
        filename = os.path.basename(xml_path)
        try:
            upload_result = destack.upload_xml(xml_path)

            if upload_result.get('success'):
                result['success'] += 1
            elif upload_result.get('duplicate'):
                result['duplicates'] += 1
            else:
                result['failed'] += 1
                logger.warning(f"Falha ao enviar {filename}: {upload_result.get('error')}")

        except Exception as e:
            result['failed'] += 1
            logger.error(f"Erro ao enviar {filename}: {e}")

    logger.info(
        f"Upload concluído: {result['success']} enviados, "
        f"{result['skipped']} ignorados (pré-check), "
        f"{result['duplicates']} duplicados, {result['failed']} falhas"
    )
    return result


def download_cte_daily(client: EGSClient, output_folder: str) -> int:
    """Baixa todos os CT-e disponíveis e retorna a contagem"""
    from selenium.webdriver.common.by import By

    logger.info("Navegando para exportação de CT-e...")

    try:
        # Fechar banner de comunicados
        close_banner(client)
        time.sleep(1)

        # Navegar para página de EXPORTAÇÃO XML de CT-e
        logger.info("Navegando para /cte-tela-xml...")
        client.browser.driver.get('https://app.egssistemas.com.br/cte-tela-xml')
        time.sleep(5)

        # Fechar banner novamente se aparecer
        close_banner(client)
        time.sleep(1)

        # Log da URL atual para debug
        current_url = client.browser.driver.current_url
        logger.info(f"URL atual: {current_url}")

        # Verificar se foi redirecionado para login (sessão expirada)
        if 'login' in current_url.lower():
            logger.warning("Sessão expirada! Redirecionado para /login. Tentando re-login...")
            if not client.login():
                logger.error("Re-login falhou!")
                return 0
            # Navegar novamente após re-login
            close_banner(client)
            time.sleep(1)
            client.browser.driver.get('https://app.egssistemas.com.br/cte-tela-xml')
            time.sleep(5)
            close_banner(client)
            time.sleep(1)
            current_url = client.browser.driver.current_url
            logger.info(f"URL após re-login: {current_url}")
            if 'login' in current_url.lower():
                logger.error("Ainda na página de login após re-login!")
                return 0

        # Aguardar grid (timeout maior para conexões lentas)
        client._wait_for_devexpress_grid(timeout=90)

        # Verificar contagem
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid: {page_info}")
        except:
            pass

        # Verificar se há dados
        no_data = client.browser.find_element_safe(By.CSS_SELECTOR, ".dx-datagrid-nodata")
        if no_data and no_data.is_displayed():
            logger.info("Nenhum CT-e encontrado")
            return 0

        # Selecionar todos (mesma abordagem do MDF-e)
        client.browser.driver.execute_script("""
            var headerCheckbox = document.querySelector('.dx-header-row .dx-checkbox');
            if (headerCheckbox) headerCheckbox.click();
        """)
        time.sleep(2)

        # Verificar seleção
        selected = client.browser.driver.execute_script("""
            return document.querySelectorAll('.dx-datagrid-rowsview .dx-checkbox-checked').length;
        """)
        logger.info(f"Registros selecionados: {selected}")

        if selected == 0:
            logger.warning("Nenhum registro selecionado")
            return 0

        # Clicar no botão de download XML
        # Usa seletor para botão com ícone fa-download (funciona na página cte-tela-xml)
        download_clicked = client.browser.driver.execute_script("""
            var selectors = [
                "button:has(i.fa-download)",
                "button[ng-click='downloadXml()']",
                "button[ng-click*='download']",
                "button.btn-download"
            ];
            for (var i = 0; i < selectors.length; i++) {
                var btn = document.querySelector(selectors[i]);
                if (btn) {
                    btn.click();
                    return 'clicked: ' + selectors[i];
                }
            }
            return 'not found';
        """)
        logger.info(f"Botão de download: {download_clicked}")
        time.sleep(2)

        # Aguardar download
        count = wait_and_extract_zip(output_folder, 'cte')
        return count

    except Exception as e:
        logger.error(f"Erro ao baixar CT-e: {e}")
        return 0


def download_mdfe_daily(client: EGSClient, output_folder: str) -> int:
    """Baixa todos os MDF-e disponíveis e retorna a contagem"""
    from selenium.webdriver.common.by import By

    logger.info("Navegando para página de MDF-e...")

    try:
        # Fechar banner
        close_banner(client)
        time.sleep(1)

        # Navegar para página de MDF-e
        client.browser.driver.get('https://app.egssistemas.com.br/mdfe')
        time.sleep(5)

        close_banner(client)
        time.sleep(1)

        # Verificar se foi redirecionado para login (sessão expirada)
        current_url = client.browser.driver.current_url
        if 'login' in current_url.lower():
            logger.warning("Sessão expirada no MDF-e! Tentando re-login...")
            if not client.login():
                logger.error("Re-login falhou!")
                return 0
            close_banner(client)
            time.sleep(1)
            client.browser.driver.get('https://app.egssistemas.com.br/mdfe')
            time.sleep(5)
            close_banner(client)
            time.sleep(1)
            current_url = client.browser.driver.current_url
            if 'login' in current_url.lower():
                logger.error("Ainda na página de login após re-login no MDF-e!")
                return 0

        # Aguardar grid (timeout maior para conexões lentas)
        client._wait_for_devexpress_grid(timeout=90)

        # Verificar contagem
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid: {page_info}")
        except:
            pass

        # Verificar se há dados
        no_data = client.browser.find_element_safe(By.CSS_SELECTOR, ".dx-datagrid-nodata")
        if no_data and no_data.is_displayed():
            logger.info("Nenhum MDF-e encontrado")
            return 0

        # Selecionar todos
        client.browser.driver.execute_script("""
            var headerCheckbox = document.querySelector('.dx-header-row .dx-checkbox');
            if (headerCheckbox) headerCheckbox.click();
        """)
        time.sleep(2)

        # Verificar seleção
        selected = client.browser.driver.execute_script("""
            return document.querySelectorAll('.dx-datagrid-rowsview .dx-checkbox-checked').length;
        """)
        logger.info(f"Registros selecionados: {selected}")

        if selected == 0:
            return 0

        # Clicar em Baixar XML
        client.browser.driver.execute_script("""
            var btn = document.querySelector("button[ng-click='downloadXml()']");
            if (btn) btn.click();
        """)
        time.sleep(2)

        # Aguardar download
        count = wait_and_extract_zip(output_folder, 'mdfe')
        return count

    except Exception as e:
        logger.error(f"Erro ao baixar MDF-e: {e}")
        return 0


def close_banner(client):
    """Fecha banner de comunicados"""
    from selenium.webdriver.common.by import By
    try:
        close_btn = client._find_element_multiple_strategies([
            (By.CSS_SELECTOR, '.btn-close'),
            (By.XPATH, '//button[contains(@class, "close")]'),
        ])
        if close_btn and close_btn.is_displayed():
            client._safe_click(close_btn)
            time.sleep(0.5)
    except:
        pass


def wait_and_extract_zip(output_folder: str, doc_type: str, timeout: int = 120) -> int:
    """Aguarda download e extrai XMLs, retornando a contagem"""

    start_time = time.time()

    while time.time() - start_time < timeout:
        zip_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.zip"))
        downloading = glob.glob(os.path.join(DOWNLOAD_DIR, "*.crdownload"))

        if downloading:
            time.sleep(2)
            continue

        if zip_files:
            latest_zip = max(zip_files, key=os.path.getctime)
            logger.info(f"Extraindo: {os.path.basename(latest_zip)}")

            count = 0
            try:
                with zipfile.ZipFile(latest_zip, 'r') as zf:
                    for file_info in zf.namelist():
                        if file_info.endswith('.xml'):
                            zf.extract(file_info, output_folder)
                            count += 1

                # Mover arquivos de subpastas
                for root, dirs, files in os.walk(output_folder):
                    for file in files:
                        if file.endswith('.xml') and root != output_folder:
                            src = os.path.join(root, file)
                            dst = os.path.join(output_folder, file)
                            if not os.path.exists(dst):
                                shutil.move(src, dst)

                # Limpar subpastas vazias
                for root, dirs, files in os.walk(output_folder, topdown=False):
                    for dir_name in dirs:
                        try:
                            os.rmdir(os.path.join(root, dir_name))
                        except:
                            pass

                # Remover ZIP
                os.remove(latest_zip)

                return count

            except Exception as e:
                logger.error(f"Erro ao extrair: {e}")
                return 0

        time.sleep(2)

    logger.warning("Timeout aguardando download")
    return 0


if __name__ == "__main__":
    # Verificar argumentos
    target_date = None
    if len(sys.argv) > 1:
        target_date = sys.argv[1]

    # Executar download
    success = download_daily_xmls(target_date)

    sys.exit(0 if success else 1)
