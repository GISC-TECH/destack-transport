"""
Script específico para baixar XMLs de MDF-e do EGS Sistemas
"""
import os
import sys
import time

from browser import BrowserManager
from egs_client import EGSClient
from config import DOWNLOAD_DIR
from logger_setup import setup_logger
from selenium.webdriver.common.by import By

logger = setup_logger('download_mdfe')


def download_mdfe_by_date(target_date: str):
    """
    Baixa XMLs de MDF-e para uma data específica.

    Args:
        target_date: Data no formato DD/MM/YYYY
    """
    logger.info("=" * 60)
    logger.info(f"DOWNLOAD DE MDF-e XMLs - Data: {target_date}")
    logger.info("=" * 60)

    browser = None

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
        logger.info("PASSO 1: Realizando login...")
        logger.info("-" * 40)

        if not client.login():
            logger.error("FALHA NO LOGIN!")
            return False

        logger.info("LOGIN OK!")
        time.sleep(2)

        # Navegar para MDF-e XML
        logger.info("-" * 40)
        logger.info("PASSO 2: Navegando para MDF-e EXPORTAÇÃO XML...")
        logger.info("-" * 40)

        # Fechar comunicados
        close_comunicados(client)

        # Navegar via menu FISCAL > MDF-E > EXPORTAÇÃO XML
        success = navigate_to_mdfe_xml(client)

        if not success:
            logger.error("Falha ao navegar para página de MDF-e")
            return False

        # Aguardar grid carregar
        logger.info("-" * 40)
        logger.info("PASSO 3: Carregando grid e aplicando filtro...")
        logger.info("-" * 40)

        if not client._wait_for_devexpress_grid(timeout=30):
            logger.warning("Grid não carregou completamente")

        browser.screenshot('mdfe_grid_loaded.png')

        # Verificar se há dados
        try:
            page_info = browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid: {page_info}")
        except:
            pass

        # Aplicar filtro de data
        logger.info(f"Aplicando filtro para data: {target_date}")
        apply_date_filter_mdfe(client, target_date)
        time.sleep(3)

        browser.screenshot('mdfe_filtered.png')

        # Verificar contagem após filtro
        try:
            page_info = browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros após filtro: {page_info}")
        except:
            pass

        # Verificar se há dados
        if check_no_data(client):
            logger.warning(f"Nenhum MDF-e encontrado para {target_date}")
            return True

        # Selecionar todos
        logger.info("-" * 40)
        logger.info("PASSO 4: Selecionando registros e baixando...")
        logger.info("-" * 40)

        select_all_records(client)
        time.sleep(1)
        browser.screenshot('mdfe_selected.png')

        # Download
        click_download_button(client)

        # Aguardar download
        downloaded = wait_for_download('mdfe', target_date)

        if downloaded:
            logger.info("MDF-e XMLs baixados com sucesso!")

        logger.info("=" * 60)
        logger.info("DOWNLOAD CONCLUÍDO!")
        logger.info(f"Arquivos salvos em: {DOWNLOAD_DIR}")
        logger.info("=" * 60)

        return downloaded

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


def close_comunicados(client):
    """Fecha banner de comunicados"""
    try:
        close_btn = client.browser.driver.find_element(
            By.XPATH, '//div[contains(@class, "alert")]//button | //button[contains(@class, "close")]'
        )
        if close_btn.is_displayed():
            client._safe_click(close_btn)
            time.sleep(0.5)
    except:
        pass


def navigate_to_mdfe_xml(client) -> bool:
    """Navega para a página de exportação XML de MDF-e"""

    logger.info("Navegando via menu FISCAL > MDF-E > EXPORTAÇÃO XML...")

    # Clicar no menu FISCAL para expandir
    fiscal = client._wait_and_find_element([
        (By.XPATH, '//span[text()="FISCAL"]'),
        (By.XPATH, '//a[contains(., "FISCAL")]'),
    ], timeout=10)

    if fiscal:
        client._safe_click(fiscal)
        time.sleep(2)
        logger.info("Menu FISCAL clicado/expandido")
        client.browser.screenshot('mdfe_nav_1_fiscal.png')

    # Procurar MDF-E no submenu (cuidado para não pegar CT-E)
    # O texto exato é "MDF-E" sem mais nada
    mdfe = client._wait_and_find_element([
        (By.XPATH, '//li//a[normalize-space(.)="MDF-E"]'),
        (By.XPATH, '//a[span[text()="MDF-E"]]'),
        (By.XPATH, '//span[text()="MDF-E"]/parent::a'),
        (By.XPATH, '//li[contains(@class, "nav-item")]//a[contains(., "MDF-E") and not(contains(., "CT"))]'),
    ], timeout=10)

    if mdfe:
        client._safe_click(mdfe)
        time.sleep(2)
        logger.info("Submenu MDF-E expandido")
        client.browser.screenshot('mdfe_nav_2_mdfe.png')

        # Agora procurar EXPORTAÇÃO XML dentro do submenu expandido
        export = client._wait_and_find_element([
            (By.XPATH, '//a[contains(@href, "mdfe-tela-xml")]'),
            (By.XPATH, '//li//a[contains(., "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//span[text()="EXPORTAÇÃO XML"]/parent::a'),
        ], timeout=10)

        if export:
            client._safe_click(export)
            time.sleep(3)
            logger.info("EXPORTAÇÃO XML (MDF-E) clicado")
            client.browser.screenshot('mdfe_nav_3_export.png')

            # Verificar URL
            current_url = client.browser.driver.current_url
            logger.info(f"URL após clique: {current_url}")

            if 'mdfe' in current_url.lower():
                return True
    else:
        logger.warning("Menu MDF-E não encontrado no submenu FISCAL")

    # MDF-E não tem "EXPORTAÇÃO XML" no submenu
    # A exportação de MDF-e pode estar em:
    # 1. Portal Contador XML (SISTEMA > Portal Contador XML)
    # 2. Ou precisamos buscar em outro lugar

    # Tentar via JavaScript para clicar em MDF-E e ver submenu
    logger.info("Tentando clicar via JavaScript...")
    result = client.browser.driver.execute_script("""
        // Procurar link MDF-E
        var links = document.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            var text = links[i].innerText.trim();
            if (text === 'MDF-E') {
                links[i].click();
                return 'clicked_mdfe';
            }
        }
        return 'not_found';
    """)
    logger.info(f"Clique JS MDF-E: {result}")

    if result == 'clicked_mdfe':
        time.sleep(2)
        client.browser.screenshot('mdfe_nav_2_mdfe_js.png')

        # Procurar link que contenha 'mdfe' e 'xml' na URL
        result2 = client.browser.driver.execute_script("""
            var links = document.querySelectorAll('a');
            for (var i = 0; i < links.length; i++) {
                var href = links[i].getAttribute('href') || '';
                if (href.toLowerCase().includes('mdfe') && href.toLowerCase().includes('xml')) {
                    links[i].click();
                    return 'clicked_mdfe_xml';
                }
            }
            return 'not_found';
        """)
        logger.info(f"Clique JS mdfe+xml: {result2}")

        if result2 != 'not_found':
            time.sleep(3)
            return True

    # Tentar via SISTEMA > Portal Contador XML (pode ter MDF-e também)
    logger.info("Tentando via SISTEMA > Portal Contador XML...")

    # Clicar em SISTEMA
    sistema = client._wait_and_find_element([
        (By.XPATH, '//span[text()="SISTEMA"]'),
        (By.XPATH, '//a[contains(., "SISTEMA")]'),
    ], timeout=5)

    if sistema:
        client._safe_click(sistema)
        time.sleep(2)
        logger.info("Menu SISTEMA clicado")

        # Procurar Portal Contador XML
        portal = client._wait_and_find_element([
            (By.XPATH, '//a[contains(., "Portal Contador XML")]'),
            (By.XPATH, '//span[contains(., "Portal Contador XML")]'),
            (By.XPATH, '//a[contains(@href, "Portal-Contador-xml")]'),
        ], timeout=5)

        if portal:
            client._safe_click(portal)
            time.sleep(3)
            logger.info("Portal Contador XML clicado")

            current_url = client.browser.driver.current_url
            logger.info(f"URL Portal: {current_url}")

            if 'Portal' in current_url or 'Contador' in current_url:
                return True

    # Último fallback: navegação direta via hash
    logger.info("Forçando navegação direta via hash...")

    # Usar window.location.hash que funciona melhor com AngularJS
    client.browser.driver.execute_script("window.location.hash = '/mdfe-tela-xml';")
    time.sleep(3)

    current_url = client.browser.driver.current_url
    logger.info(f"URL após hash: {current_url}")

    # Se ainda não funcionou, tentar Portal Contador XML para MDF-e
    if 'mdfe' not in current_url.lower():
        logger.info("Tentando Portal Contador XML direto...")
        client.browser.driver.execute_script("window.location.hash = '/Portal-Contador-xml';")
        time.sleep(5)

    current_url = client.browser.driver.current_url
    logger.info(f"URL final: {current_url}")

    return 'mdfe' in current_url.lower() or 'Portal' in current_url or 'Contador' in current_url


def apply_date_filter_mdfe(client, target_date: str):
    """Aplica filtro de data para MDF-e"""

    try:
        # Clicar em "Criar filtro"
        criar_filtro = client._wait_and_find_element([
            (By.XPATH, '//*[contains(text(), "Criar filtro")]'),
            (By.CSS_SELECTOR, '.dx-datagrid-filter-panel-text'),
        ], timeout=5)

        if criar_filtro:
            client._safe_click(criar_filtro)
            time.sleep(2)
            logger.info("Construtor de filtro aberto")

            # Tentar aplicar filtro via API DevExpress
            result = client.browser.driver.execute_script(f"""
                try {{
                    var filterBuilder = $('.dx-filterbuilder').dxFilterBuilder('instance');
                    if (filterBuilder) {{
                        filterBuilder.option('value', [['dhEmi', 'contains', '{target_date}']]);
                        return 'api_applied';
                    }}
                    return 'not_found';
                }} catch(e) {{
                    return 'error: ' + e.message;
                }}
            """)
            logger.info(f"Filtro via API: {result}")

            # Clicar OK
            ok_btn = client._wait_and_find_element([
                (By.XPATH, '//button[text()="OK"]'),
                (By.CSS_SELECTOR, '.dx-popup-bottom .dx-button'),
            ], timeout=5)

            if ok_btn:
                client._safe_click(ok_btn)
                time.sleep(2)
                logger.info("Filtro aplicado")

    except Exception as e:
        logger.warning(f"Erro ao aplicar filtro: {e}")


def check_no_data(client) -> bool:
    """Verifica se não há dados"""
    try:
        no_data = client.browser.driver.find_element(By.CSS_SELECTOR, ".dx-datagrid-nodata")
        if no_data.is_displayed():
            return True
    except:
        pass

    body_text = client.browser.driver.find_element(By.TAG_NAME, 'body').text.lower()
    return 'sem dados' in body_text or 'nenhum registro' in body_text


def select_all_records(client):
    """Seleciona todos os registros"""
    try:
        result = client.browser.driver.execute_script("""
            var headerCheckbox = document.querySelector('.dx-header-row .dx-checkbox, .dx-datagrid-headers .dx-checkbox');
            if (headerCheckbox) {
                headerCheckbox.click();
                return 'clicked';
            }
            return 'not_found';
        """)
        logger.info(f"Seleção: {result}")
    except Exception as e:
        logger.warning(f"Erro na seleção: {e}")


def click_download_button(client):
    """Clica no botão de download"""
    download_btn = client._find_element_multiple_strategies([
        (By.XPATH, '//button[contains(., "Download")]'),
        (By.XPATH, '//button[contains(., "XML")]'),
        (By.CSS_SELECTOR, 'button[data-original-title*="Download"]'),
    ])

    if download_btn:
        client._safe_click(download_btn)
        logger.info("Botão Download clicado")
        time.sleep(2)
    else:
        # Via JS
        result = client.browser.driver.execute_script("""
            var buttons = document.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].innerText.includes('Download')) {
                    buttons[i].click();
                    return 'clicked';
                }
            }
            return 'not_found';
        """)
        logger.info(f"Download via JS: {result}")


def wait_for_download(doc_type: str, target_date: str, timeout: int = 120) -> bool:
    """Aguarda download completar"""
    import glob

    logger.info(f"Aguardando download de {doc_type.upper()}...")
    start_time = time.time()

    while time.time() - start_time < timeout:
        zip_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.zip"))
        downloading = glob.glob(os.path.join(DOWNLOAD_DIR, "*.crdownload"))

        if downloading:
            time.sleep(2)
            continue

        if zip_files:
            latest_file = max(zip_files, key=os.path.getctime)
            # Verificar se é arquivo novo (criado nos últimos 2 minutos)
            if time.time() - os.path.getctime(latest_file) < 120:
                logger.info(f"Download concluído: {os.path.basename(latest_file)}")

                # Renomear
                date_str = target_date.replace('/', '-')
                new_name = f"{doc_type}_{date_str}_{os.path.basename(latest_file)}"
                new_path = os.path.join(DOWNLOAD_DIR, new_name)

                try:
                    os.rename(latest_file, new_path)
                    logger.info(f"Renomeado para: {new_name}")
                except:
                    pass

                return True

        time.sleep(2)

    logger.warning("Timeout aguardando download")
    return False


if __name__ == "__main__":
    target_date = "05/12/2025"

    if len(sys.argv) > 1:
        target_date = sys.argv[1]

    success = download_mdfe_by_date(target_date)
    sys.exit(0 if success else 1)
