"""
Script para download diário de XMLs de CT-e e MDF-e do EGS Sistemas.
Pode ser executado manualmente ou agendado via Task Scheduler/cron.

Uso:
    python daily_download.py              # Baixa notas de hoje
    python daily_download.py 05/12/2025   # Baixa notas de uma data específica
"""
import os
import sys
import time
import glob
import zipfile
import shutil
from datetime import datetime

from browser import BrowserManager
from egs_client import EGSClient
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

        # Resultado final
        logger.info("")
        logger.info("=" * 60)
        logger.info("DOWNLOAD DIÁRIO CONCLUÍDO!")
        logger.info(f"Data: {target_date}")
        logger.info(f"CT-e: {cte_count} XMLs")
        logger.info(f"MDF-e: {mdfe_count} XMLs")
        logger.info(f"Total: {cte_count + mdfe_count} XMLs")
        logger.info(f"Pasta: {output_folder}")
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


def download_cte_daily(client: EGSClient, output_folder: str) -> int:
    """Baixa todos os CT-e disponíveis e retorna a contagem"""
    from selenium.webdriver.common.by import By

    logger.info("Navegando para exportação de CT-e...")

    try:
        # Fechar banner de comunicados
        close_banner(client)
        time.sleep(1)

        # Navegar via menu: FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML
        fiscal_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "FISCAL")]'),
            (By.XPATH, '//a[contains(., "FISCAL")]'),
        ], timeout=10)

        if fiscal_menu:
            client._safe_click(fiscal_menu)
            time.sleep(1)

        # Clicar em CT-E
        cte_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "CT-E")]'),
            (By.XPATH, '//a[contains(., "CT-E")]'),
        ], timeout=10)

        if cte_menu:
            client._safe_click(cte_menu)
            time.sleep(1)

        # Clicar em EXPORTAÇÃO XML
        export_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//a[contains(., "EXPORTAÇÃO XML")]'),
        ], timeout=10)

        if export_menu:
            client._safe_click(export_menu)
            time.sleep(3)

        # Aguardar grid
        client._wait_for_devexpress_grid(timeout=30)

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

        # Selecionar todos
        client.browser.driver.execute_script("""
            var headerCheckbox = document.querySelector('.dx-header-row .dx-checkbox, .dx-datagrid-headers .dx-checkbox');
            if (headerCheckbox) headerCheckbox.click();
        """)
        time.sleep(1)

        # Clicar em Download
        download_btn = client._find_element_multiple_strategies([
            (By.XPATH, '//button[contains(., "Download XML")]'),
            (By.XPATH, '//button[contains(., "Download")]'),
        ])

        if download_btn:
            client._safe_click(download_btn)
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

        # Aguardar grid
        client._wait_for_devexpress_grid(timeout=30)

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
