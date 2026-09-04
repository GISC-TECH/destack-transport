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
from lxml import etree

from browser import BrowserManager
from egs_client import EGSClient
from destack_client import DestackClient
from config import DOWNLOAD_DIR
from logger_setup import setup_logger

logger = setup_logger('daily_download')

DOCUMENT_DOWNLOAD_ATTEMPTS = 3
GRID_LOAD_ATTEMPTS = 4
GRID_STATE_TIMEOUT = 30
DOWNLOAD_TIMEOUT = 180


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
        cte_count = download_document_with_retries(
            "CT-e", download_cte_daily, client, output_folder
        )
        logger.info(f"CT-e: {max(cte_count, 0)} XMLs baixados")

        # Baixar MDF-e
        logger.info("-" * 40)
        logger.info("Baixando MDF-e...")
        logger.info("-" * 40)
        mdfe_count = download_document_with_retries(
            "MDF-e", download_mdfe_daily, client, output_folder
        )
        logger.info(f"MDF-e: {max(mdfe_count, 0)} XMLs baixados")

        # Resultado do download
        download_failed = cte_count < 0 or mdfe_count < 0
        safe_cte_count = max(cte_count, 0)
        safe_mdfe_count = max(mdfe_count, 0)
        total_downloaded = safe_cte_count + safe_mdfe_count
        logger.info("")
        logger.info("=" * 60)
        logger.info("DOWNLOAD CONCLUÍDO!" if not download_failed else "DOWNLOAD INCOMPLETO!")
        logger.info(f"Data: {target_date}")
        logger.info(f"CT-e: {safe_cte_count} XMLs")
        logger.info(f"MDF-e: {safe_mdfe_count} XMLs")
        logger.info(f"Total: {total_downloaded} XMLs")
        logger.info(f"Pasta: {output_folder}")
        logger.info("=" * 60)

        # Enviar XMLs para a API do Destack
        upload_failed = False
        if total_downloaded > 0:
            logger.info("")
            logger.info("-" * 40)
            logger.info("Enviando XMLs para API do Destack...")
            logger.info("-" * 40)
            upload_result = upload_xmls_to_api(output_folder)
            logger.info(f"Enviados: {upload_result['success']} | Ignorados (já existem): {upload_result['skipped']} | Duplicados: {upload_result['duplicates']} | Falhas: {upload_result['failed']}")
            upload_failed = upload_result['failed'] > 0
        else:
            logger.info("Nenhum XML para enviar")

        logger.info("")
        logger.info("=" * 60)
        logger.info("PROCESSO DIÁRIO FINALIZADO!")
        logger.info("=" * 60)

        if download_failed:
            logger.error("Job incompleto: CT-e ou MDF-e falhou após todas as tentativas")
        if upload_failed:
            logger.error("Job incompleto: houve falha no envio de XMLs para a API")

        return not download_failed and not upload_failed

    except Exception as e:
        logger.error(f"Erro durante download: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        if browser:
            logger.info("Fechando browser...")
            try:
                browser.stop()
            except Exception as e:
                logger.warning(f"Erro ao fechar browser: {e}")


def extract_chave_from_filename(filename: str):
    """Extrai chave de 44 dígitos do nome do arquivo."""
    match = re.search(r'(\d{44})', filename)
    return match.group(1) if match else None


def download_document_with_retries(
    doc_type: str,
    download_func,
    client: EGSClient,
    output_folder: str,
) -> int:
    """Executa o download e diferencia uma lista vazia de uma falha real."""
    for attempt in range(1, DOCUMENT_DOWNLOAD_ATTEMPTS + 1):
        count = download_func(client, output_folder)
        if count >= 0:
            return count

        if attempt < DOCUMENT_DOWNLOAD_ATTEMPTS:
            logger.warning(
                f"{doc_type} falhou na tentativa {attempt}/"
                f"{DOCUMENT_DOWNLOAD_ATTEMPTS}; tentando novamente"
            )
            time.sleep(10)

    logger.error(
        f"{doc_type} falhou após {DOCUMENT_DOWNLOAD_ATTEMPTS} tentativas"
    )
    return -1


def is_event_xml_file(file_path: str) -> bool:
    """
    Identifica XML de evento fiscal (cancelamento, CC-e, retorno SEFAZ).

    Primeiro verifica padroes no nome do arquivo; se nao identificar,
    le a tag raiz do XML (com suporte a namespaces).
    """
    filename = os.path.basename(file_path).lower()
    name_markers = ('_canc', 'procevento', 'retevento', 'evento')
    if any(marker in filename for marker in name_markers):
        return True

    try:
        tree = etree.parse(file_path)
        root_tag = etree.QName(tree.getroot()).localname.lower()
    except Exception as e:
        logger.debug(f"Nao foi possivel parsear {file_path}: {e}")
        return False

    event_roots = {
        'proceventocte',
        'proceventomdfe',
        'reteventocte',
        'reteventomdfe',
        'eventocte',
        'eventomdfe',
    }
    return root_tag in event_roots


def sort_xml_upload_order(file_paths: list) -> list:
    """Garante que XMLs principais sejam enviados antes dos eventos da mesma chave."""
    def upload_order(file_path):
        filename = os.path.basename(file_path).lower()
        is_event = is_event_xml_file(file_path)
        is_return = is_event and 'retevento' in filename
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
                return -1
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
                return -1

        record_count = wait_for_valid_grid(client, "CT-e")
        if record_count < 0:
            return -1
        if record_count == 0:
            logger.info("Nenhum CT-e encontrado")
            return 0

        selected = select_all_grid_rows(client, "CT-e")
        if selected <= 0:
            return -1

        # Clicar no botão de download XML
        download_started_at = time.time()
        download_clicked = click_download_button(client)
        logger.info(f"Botão de download: {download_clicked}")
        if not download_clicked:
            return -1
        time.sleep(2)

        # Aguardar download
        count = wait_and_extract_zip(
            output_folder,
            'cte',
            timeout=DOWNLOAD_TIMEOUT,
            started_at=download_started_at,
        )
        return count

    except Exception as e:
        logger.error(f"Erro ao baixar CT-e: {e}")
        return -1


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
                return -1
            close_banner(client)
            time.sleep(1)
            client.browser.driver.get('https://app.egssistemas.com.br/mdfe')
            time.sleep(5)
            close_banner(client)
            time.sleep(1)
            current_url = client.browser.driver.current_url
            if 'login' in current_url.lower():
                logger.error("Ainda na página de login após re-login no MDF-e!")
                return -1

        record_count = wait_for_valid_grid(client, "MDF-e")
        if record_count < 0:
            return -1
        if record_count == 0:
            logger.info("Nenhum MDF-e encontrado")
            return 0

        selected = select_all_grid_rows(client, "MDF-e")
        if selected <= 0:
            return -1

        # Clicar em Baixar XML
        download_started_at = time.time()
        download_clicked = click_download_button(client)
        logger.info(f"Botão de download: {download_clicked}")
        if not download_clicked:
            return -1
        time.sleep(2)

        # Aguardar download
        count = wait_and_extract_zip(
            output_folder,
            'mdfe',
            timeout=DOWNLOAD_TIMEOUT,
            started_at=download_started_at,
        )
        return count

    except Exception as e:
        logger.error(f"Erro ao baixar MDF-e: {e}")
        return -1


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


def parse_grid_record_count(page_info: str):
    """Extrai a quantidade da paginação DevExpress."""
    match = re.search(r'\((-?\d+)\s+registros?\)', page_info or '', re.IGNORECASE)
    return int(match.group(1)) if match else None


def wait_for_valid_grid(client: EGSClient, doc_type: str) -> int:
    """Aguarda paginação conclusiva; ausência de estado nunca significa lista vazia."""
    from selenium.webdriver.common.by import By

    for attempt in range(1, GRID_LOAD_ATTEMPTS + 1):
        if not client._wait_for_devexpress_grid(timeout=90):
            logger.warning(
                f"{doc_type}: grid não carregou ({attempt}/{GRID_LOAD_ATTEMPTS})"
            )

        deadline = time.time() + GRID_STATE_TIMEOUT
        last_page_info = ''
        while time.time() < deadline:
            try:
                last_page_info = client.browser.driver.find_element(
                    By.CSS_SELECTOR, '.dx-pager .dx-info'
                ).text.strip()
            except Exception:
                last_page_info = ''

            record_count = parse_grid_record_count(last_page_info)
            if record_count is not None and record_count >= 0:
                logger.info(f"Registros na grid: {last_page_info}")
                return record_count

            time.sleep(2)

        logger.warning(
            f"{doc_type}: estado inconclusivo da grid "
            f"({last_page_info or 'paginação ausente'}); "
            f"recarregando ({attempt}/{GRID_LOAD_ATTEMPTS})"
        )
        if attempt < GRID_LOAD_ATTEMPTS:
            client.browser.driver.refresh()
            time.sleep(8)
            close_banner(client)

    logger.error(
        f"{doc_type}: grid permaneceu inválida após "
        f"{GRID_LOAD_ATTEMPTS} tentativas"
    )
    return -1


def selected_grid_row_count(client: EGSClient) -> int:
    """Conta linhas visíveis efetivamente marcadas."""
    return int(client.browser.driver.execute_script("""
        return document.querySelectorAll(
            '.dx-datagrid-rowsview .dx-checkbox.dx-checkbox-checked'
        ).length;
    """) or 0)


def select_all_grid_rows(client: EGSClient, doc_type: str) -> int:
    """Seleciona todos e só confirma quando a grade reflete a seleção."""
    from selenium.webdriver.common.by import By

    for attempt in range(1, 5):
        selected = selected_grid_row_count(client)
        if selected > 0:
            logger.info(f"Registros selecionados: {selected}")
            return selected

        # Primeiro usa o widget DevExpress, que é mais estável que um click cru.
        client.browser.driver.execute_script("""
            document.querySelectorAll('.dx-datagrid').forEach(function (element) {
                try {
                    var instance = window.jQuery
                        ? window.jQuery(element).dxDataGrid('instance')
                        : null;
                    if (instance) instance.selectAll();
                } catch (error) {}
            });
        """)
        time.sleep(2)
        selected = selected_grid_row_count(client)
        if selected > 0:
            logger.info(f"Registros selecionados: {selected}")
            return selected

        header_checkbox = client.browser.find_element_safe(
            By.CSS_SELECTOR, '.dx-header-row .dx-checkbox'
        )
        if header_checkbox:
            try:
                if 'dx-checkbox-checked' not in (
                    header_checkbox.get_attribute('class') or ''
                ):
                    client._safe_click(header_checkbox)
            except Exception as exc:
                logger.debug(f"{doc_type}: clique Selenium falhou: {exc}")

        time.sleep(2)
        selected = selected_grid_row_count(client)
        if selected > 0:
            logger.info(f"Registros selecionados: {selected}")
            return selected

        client.browser.driver.execute_script("""
            var icon = document.querySelector(
                '.dx-header-row .dx-checkbox .dx-checkbox-icon'
            );
            if (icon) {
                icon.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                icon.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
                icon.click();
            }
        """)
        time.sleep(2)
        selected = selected_grid_row_count(client)
        if selected > 0:
            logger.info(f"Registros selecionados: {selected}")
            return selected

        logger.warning(
            f"{doc_type}: seleção não confirmada ({attempt}/4)"
        )

    logger.error(f"{doc_type}: não foi possível selecionar os registros")
    return -1


def click_download_button(client: EGSClient) -> str:
    """Clica no download e retorna o seletor usado, ou string vazia."""
    result = client.browser.driver.execute_script("""
        var selectors = [
            "button[ng-click='downloadXml()']",
            "button:has(i.fa-download)",
            "button[ng-click*='download']",
            "button.btn-download"
        ];
        for (var i = 0; i < selectors.length; i++) {
            var button = document.querySelector(selectors[i]);
            if (button && !button.disabled) {
                button.click();
                return 'clicked: ' + selectors[i];
            }
        }
        return '';
    """)
    if not result:
        logger.error("Botão de download não encontrado ou desabilitado")
    return result or ''


def wait_and_extract_zip(
    output_folder: str,
    doc_type: str,
    timeout: int = DOWNLOAD_TIMEOUT,
    started_at: float = None,
) -> int:
    """Aguarda download e extrai XMLs, retornando a contagem"""

    started_at = started_at or time.time()
    start_time = time.time()

    while time.time() - start_time < timeout:
        zip_files = [
            path for path in glob.glob(os.path.join(DOWNLOAD_DIR, "*.zip"))
            if os.path.getmtime(path) >= started_at - 1
        ]
        downloading = [
            path for path in glob.glob(os.path.join(DOWNLOAD_DIR, "*.crdownload"))
            if os.path.getmtime(path) >= started_at - 1
        ]

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
                return -1

        time.sleep(2)

    logger.error(f"{doc_type}: timeout aguardando download após {timeout}s")
    return -1


if __name__ == "__main__":
    # Verificar argumentos
    target_date = None
    if len(sys.argv) > 1:
        target_date = sys.argv[1]

    # Executar download
    success = download_daily_xmls(target_date)

    sys.exit(0 if success else 1)
