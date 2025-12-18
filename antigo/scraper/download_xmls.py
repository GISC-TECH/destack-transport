"""
Script para baixar XMLs de CT-e e MDF-e do EGS Sistemas
"""
import os
import sys
import time
import glob
import zipfile
import shutil
from datetime import datetime, timedelta

from browser import BrowserManager
from egs_client import EGSClient
from config import DOWNLOAD_DIR
from logger_setup import setup_logger

logger = setup_logger('download_xmls')


def download_xmls_by_month(month: int, year: int, doc_types: list = None):
    """
    Baixa XMLs de CT-e e/ou MDF-e para um mês inteiro.
    Os XMLs são salvos em pastas separadas: cte_MM_YYYY e mdfe_MM_YYYY

    Args:
        month: Mês (1-12)
        year: Ano (ex: 2025)
        doc_types: Lista de tipos de documento ['cte', 'mdfe'] ou None para ambos
    """
    if doc_types is None:
        doc_types = ['cte', 'mdfe']

    # Formatar período
    start_date = f"01/{month:02d}/{year}"

    # Último dia do mês
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    last_day = (next_month - timedelta(days=1)).day

    # Se for o mês atual, usar a data de hoje
    today = datetime.now()
    if month == today.month and year == today.year:
        last_day = today.day

    end_date = f"{last_day:02d}/{month:02d}/{year}"

    logger.info("=" * 60)
    logger.info(f"DOWNLOAD DE XMLs - Período: {start_date} a {end_date}")
    logger.info(f"Tipos: {', '.join(doc_types).upper()}")
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

        # Criar pastas de destino
        cte_folder = os.path.join(DOWNLOAD_DIR, f"cte_{month:02d}_{year}")
        mdfe_folder = os.path.join(DOWNLOAD_DIR, f"mdfe_{month:02d}_{year}")

        if 'cte' in doc_types:
            os.makedirs(cte_folder, exist_ok=True)
            logger.info(f"Pasta CT-e: {cte_folder}")

        if 'mdfe' in doc_types:
            os.makedirs(mdfe_folder, exist_ok=True)
            logger.info(f"Pasta MDF-e: {mdfe_folder}")

        # Baixar CT-e se solicitado
        if 'cte' in doc_types:
            logger.info("-" * 40)
            logger.info("PASSO 2: Baixando CT-e...")
            logger.info("-" * 40)
            download_cte_xmls_by_period(client, start_date, end_date, cte_folder)

        # Baixar MDF-e se solicitado
        if 'mdfe' in doc_types:
            logger.info("-" * 40)
            logger.info("PASSO 3: Baixando MDF-e...")
            logger.info("-" * 40)
            download_mdfe_xmls_by_period(client, start_date, end_date, mdfe_folder)

        logger.info("=" * 60)
        logger.info("DOWNLOAD CONCLUÍDO!")
        if 'cte' in doc_types:
            cte_count = len(glob.glob(os.path.join(cte_folder, "*.xml")))
            logger.info(f"CT-e: {cte_count} XMLs em {cte_folder}")
        if 'mdfe' in doc_types:
            mdfe_count = len(glob.glob(os.path.join(mdfe_folder, "*.xml")))
            logger.info(f"MDF-e: {mdfe_count} XMLs em {mdfe_folder}")
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


def download_cte_xmls_by_period(client: EGSClient, start_date: str, end_date: str, output_folder: str):
    """Baixa XMLs de CT-e para um período e extrai para pasta específica"""
    from selenium.webdriver.common.by import By

    logger.info(f"Navegando para exportação de CT-e...")
    logger.info(f"Período: {start_date} a {end_date}")

    try:
        # Fechar banner de comunicados se aparecer
        close_communication_banner(client)
        time.sleep(1)

        # Navegar via menu: FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML
        logger.info("Navegando via menu FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML...")

        # Clicar no menu FISCAL
        fiscal_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "FISCAL")]'),
            (By.XPATH, '//a[contains(., "FISCAL")]'),
            (By.XPATH, '//li[contains(., "FISCAL")]'),
        ], timeout=10)

        if fiscal_menu:
            client._safe_click(fiscal_menu)
            time.sleep(1)
            logger.info("Menu FISCAL clicado")

        # Clicar em CT-E / CT-E OS
        cte_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "CT-E")]'),
            (By.XPATH, '//a[contains(., "CT-E")]'),
            (By.XPATH, '//*[contains(text(), "CT-E / CT-E OS")]'),
        ], timeout=10)

        if cte_menu:
            client._safe_click(cte_menu)
            time.sleep(1)
            logger.info("Menu CT-E clicado")

        # Clicar em EXPORTAÇÃO XML
        export_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//a[contains(., "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//*[contains(text(), "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//a[contains(@href, "cte-tela-xml")]'),
        ], timeout=10)

        if export_menu:
            client._safe_click(export_menu)
            time.sleep(3)
            logger.info("Menu EXPORTAÇÃO XML clicado")

        # Alternativa: Navegar via JavaScript
        if not export_menu:
            logger.info("Tentando navegação via JavaScript...")
            client.browser.driver.execute_script("window.location.hash = '#/cte-tela-xml';")
            time.sleep(3)

        client.browser.screenshot('cte_page.png')

        # Aguardar grid carregar
        if not client._wait_for_devexpress_grid(timeout=30):
            logger.warning("Grid não carregou completamente...")

        # Aplicar filtro de período
        logger.info(f"Aplicando filtro para período: {start_date} a {end_date}")
        filter_success = apply_period_filter(client, start_date, end_date)
        time.sleep(3)

        # Aguardar grid recarregar
        client._wait_for_devexpress_grid(timeout=30)
        client.browser.screenshot('cte_filtered.png')

        # Verificar contagem após filtro
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros após filtro: {page_info}")
        except:
            pass

        # Verificar se há dados
        if check_no_data(client):
            logger.warning(f"Nenhum CT-e encontrado para o período")
            return True

        # Selecionar todos os registros
        logger.info("Selecionando todos os registros...")
        select_all_records(client)
        time.sleep(1)
        client.browser.screenshot('cte_selected.png')

        # Clicar em Download XML
        logger.info("Iniciando download...")
        click_download_button(client, 'cte')

        # Aguardar download e extrair
        downloaded = wait_for_download_and_extract(client, 'cte', output_folder)

        if downloaded:
            logger.info("CT-e XMLs baixados com sucesso!")

        return downloaded

    except Exception as e:
        logger.error(f"Erro ao baixar CT-e: {e}")
        import traceback
        traceback.print_exc()
        client.browser.screenshot('cte_error.png')
        return False


def download_mdfe_xmls_by_period(client: EGSClient, start_date: str, end_date: str, output_folder: str):
    """Baixa XMLs de MDF-e para um período via página /mdfe (EMISSÃO DE MDF-E)"""
    from selenium.webdriver.common.by import By

    logger.info(f"Baixando MDF-e da página de Emissão de MDF-e...")
    logger.info(f"Período: {start_date} a {end_date}")

    try:
        # Fechar banner de comunicados se aparecer
        close_communication_banner(client)
        time.sleep(1)

        # Navegar diretamente para a página de MDF-e
        logger.info("Navegando para https://app.egssistemas.com.br/mdfe...")
        client.browser.driver.get('https://app.egssistemas.com.br/mdfe')
        time.sleep(5)

        # Fechar comunicados novamente
        close_communication_banner(client)
        time.sleep(1)

        client.browser.screenshot('mdfe_page.png')

        # Verificar se estamos na página correta
        current_url = client.browser.driver.current_url
        logger.info(f"URL atual: {current_url}")

        # Aguardar grid carregar
        if not client._wait_for_devexpress_grid(timeout=30):
            logger.warning("Grid não carregou completamente...")

        # Verificar contagem de registros
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid: {page_info}")
        except:
            pass

        # Limpar filtros existentes (se houver)
        logger.info("Limpando filtros existentes...")
        try:
            limpar_filtro = client.browser.driver.find_element(By.XPATH, '//button[contains(., "Limpar filtro")]')
            if limpar_filtro and limpar_filtro.is_displayed():
                client._safe_click(limpar_filtro)
                time.sleep(2)
                logger.info("Filtros limpos")
        except:
            pass

        # Aplicar filtro de período na coluna "Data emissão" usando o campo de filtro de célula
        logger.info(f"Aplicando filtro de período: {start_date} a {end_date}")

        # Extrair mês/ano do período para filtrar
        start_parts = start_date.split('/')
        target_month = start_parts[1]  # MM
        target_year = start_parts[2]   # YYYY

        # Usar o filtro de célula na coluna Data emissão
        # O filtro aceita texto parcial, então podemos filtrar por mês/ano
        filter_value = f"{target_month}/{target_year}"  # Ex: "12/2025"

        filter_applied = client.browser.driver.execute_script(f"""
            // Encontrar o input de filtro na coluna Data emissão
            var filterRow = document.querySelector('.dx-datagrid-filter-row');
            if (!filterRow) return 'filter_row_not_found';

            var cells = filterRow.querySelectorAll('td');
            for (var i = 0; i < cells.length; i++) {{
                var input = cells[i].querySelector('input.dx-texteditor-input');
                if (input) {{
                    // Verificar se é a coluna de data (pode ter placeholder ou aria-label)
                    var ariaLabel = input.getAttribute('aria-label') || '';
                    var ariaDescribedBy = input.getAttribute('aria-describedby') || '';

                    // A coluna de Data emissão geralmente é a 5ª coluna (índice 4)
                    // Mas vamos verificar pelo contexto
                    if (i >= 3 && i <= 5) {{  // Colunas prováveis de data
                        // Limpar e preencher
                        input.value = '{filter_value}';
                        input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        input.dispatchEvent(new Event('change', {{ bubbles: true }}));

                        // Pressionar Enter para aplicar
                        var enterEvent = new KeyboardEvent('keydown', {{
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true
                        }});
                        input.dispatchEvent(enterEvent);

                        return 'filtered_column_' + i;
                    }}
                }}
            }}
            return 'input_not_found';
        """)
        logger.info(f"Filtro de data aplicado: {filter_applied}")
        time.sleep(3)

        # Aguardar grid recarregar
        client._wait_for_devexpress_grid(timeout=30)
        client.browser.screenshot('mdfe_filtered.png')

        # Verificar contagem após filtro
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros após filtro: {page_info}")
        except:
            pass

        # Verificar se há dados
        if check_no_data(client):
            logger.warning(f"Nenhum MDF-e encontrado para o período")
            return True

        # Selecionar TODOS os registros usando checkbox do header
        logger.info("Selecionando todos os registros...")
        select_result = client.browser.driver.execute_script("""
            // Encontrar checkbox do header (selecionar todos)
            var headerCheckbox = document.querySelector('.dx-header-row .dx-checkbox');
            if (headerCheckbox) {
                headerCheckbox.click();
                return 'clicked_header_checkbox';
            }
            return 'header_checkbox_not_found';
        """)
        logger.info(f"Seleção: {select_result}")
        time.sleep(2)

        # Verificar quantos estão selecionados
        selected_count = client.browser.driver.execute_script("""
            var checked = document.querySelectorAll('.dx-datagrid-rowsview .dx-checkbox-checked');
            return checked.length;
        """)
        logger.info(f"Registros selecionados: {selected_count}")

        if selected_count == 0:
            logger.warning("Nenhum registro selecionado!")
            return True

        client.browser.screenshot('mdfe_selected.png')

        # Clicar no botão "Baixar xml" (ng-click="downloadXml()")
        logger.info("Clicando em Baixar XML...")
        download_result = client.browser.driver.execute_script("""
            // Procurar botão de download XML pelo ng-click
            var downloadBtn = document.querySelector("button[ng-click='downloadXml()']");
            if (downloadBtn) {
                downloadBtn.click();
                return 'clicked_downloadXml';
            }
            return 'not_found';
        """)
        logger.info(f"Resultado do clique em Download: {download_result}")

        if download_result == 'not_found':
            logger.error("Botão de download não encontrado!")
            return False

        time.sleep(2)

        # Aguardar download e extrair
        downloaded = wait_for_download_and_extract(client, 'mdfe', output_folder)

        if downloaded:
            logger.info("MDF-e XMLs baixados com sucesso!")

        return downloaded

    except Exception as e:
        logger.error(f"Erro ao baixar MDF-e: {e}")
        import traceback
        traceback.print_exc()
        client.browser.screenshot('mdfe_error.png')
        return False


def apply_period_filter(client: EGSClient, start_date: str, end_date: str):
    """Aplica filtro de período na grid usando o Construtor de Filtro DevExpress"""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys

    logger.info(f"Aplicando filtro de período: {start_date} a {end_date}")

    try:
        # Primeiro, fechar qualquer modal aberto
        try:
            cancel_btn = client.browser.driver.find_element(By.XPATH, '//button[contains(text(), "Cancelar")]')
            if cancel_btn.is_displayed():
                cancel_btn.click()
                time.sleep(1)
        except:
            pass

        # Clicar em "Criar filtro" para abrir o construtor
        criar_filtro = client._wait_and_find_element([
            (By.XPATH, '//*[contains(text(), "Criar filtro")]'),
            (By.CSS_SELECTOR, '.dx-datagrid-filter-panel-text'),
            (By.XPATH, '//span[contains(text(), "Criar filtro")]'),
        ], timeout=5)

        if criar_filtro:
            logger.info("Abrindo Construtor de Filtro...")
            client._safe_click(criar_filtro)
            time.sleep(2)
            client.browser.screenshot('filter_builder_opened.png')

            # Usar JavaScript para configurar o filtro DevExpress com período
            # Filtro: Data Emissão >= start_date AND Data Emissão <= end_date
            filter_applied = client.browser.driver.execute_script(f"""
                try {{
                    // Tentar via API DevExpress
                    var grid = $('.dx-datagrid').dxDataGrid('instance');
                    if (grid) {{
                        // Filtro com período (between)
                        grid.filter([
                            ['dataEmissao', '>=', '{start_date}'],
                            'and',
                            ['dataEmissao', '<=', '{end_date}']
                        ]);
                        return 'api_applied';
                    }}

                    // Procurar o botão de adicionar condição ("+")
                    var addBtn = document.querySelector('.dx-filterbuilder-add-condition');
                    if (addBtn) {{
                        addBtn.click();
                        return 'add_clicked';
                    }}

                    return 'not_found';
                }} catch(e) {{
                    return 'error: ' + e.message;
                }}
            """)

            logger.info(f"Resultado do construtor de filtro: {filter_applied}")

            if filter_applied == 'api_applied':
                time.sleep(2)
                return True

            # Se conseguiu abrir, configurar manualmente
            time.sleep(1)

            # Fechar o modal do construtor de filtro
            close_btn = client._find_element_multiple_strategies([
                (By.XPATH, '//button[text()="Cancelar"]'),
                (By.CSS_SELECTOR, '.dx-popup-bottom .dx-button:last-child'),
            ])
            if close_btn:
                client._safe_click(close_btn)
                time.sleep(1)

        # Método alternativo: Usar JavaScript para aplicar filtro direto na grid
        logger.info("Aplicando filtro via JavaScript...")

        result = client.browser.driver.execute_script(f"""
            try {{
                var grid = $('.dx-datagrid').dxDataGrid('instance');
                if (grid) {{
                    // Tentar diferentes nomes de coluna
                    var columnNames = ['dataEmissao', 'Data Emissão', 'Data', 'dtEmissao', 'emissao'];
                    for (var i = 0; i < columnNames.length; i++) {{
                        try {{
                            grid.filter([
                                [columnNames[i], '>=', '{start_date}'],
                                'and',
                                [columnNames[i], '<=', '{end_date}']
                            ]);
                            return 'filtered_by_' + columnNames[i];
                        }} catch(e) {{
                            continue;
                        }}
                    }}
                    return 'column_not_found';
                }}
                return 'grid_not_found';
            }} catch(e) {{
                return 'error: ' + e.message;
            }}
        """)

        logger.info(f"Resultado do filtro JS: {result}")

        if 'filtered' in str(result):
            return True

        return False

    except Exception as e:
        logger.warning(f"Erro ao aplicar filtro: {e}")
        import traceback
        traceback.print_exc()
        return False


def wait_for_download_and_extract(client: EGSClient, doc_type: str, output_folder: str, timeout: int = 180):
    """Aguarda o download completar e extrai os XMLs para a pasta de destino"""

    logger.info(f"Aguardando download de {doc_type.upper()}...")

    start_time = time.time()

    while time.time() - start_time < timeout:
        # Verificar arquivos baixados
        xml_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.xml"))
        zip_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.zip"))

        # Verificar se há arquivos .crdownload (download em progresso)
        downloading = glob.glob(os.path.join(DOWNLOAD_DIR, "*.crdownload"))

        if downloading:
            logger.debug("Download em progresso...")
            time.sleep(2)
            continue

        if zip_files:
            # Encontrar o arquivo mais recente
            latest_zip = max(zip_files, key=os.path.getctime)
            logger.info(f"Download concluído: {os.path.basename(latest_zip)}")

            # Extrair XMLs para a pasta de destino
            logger.info(f"Extraindo XMLs para {output_folder}...")
            extract_count = 0
            try:
                with zipfile.ZipFile(latest_zip, 'r') as zf:
                    for file_info in zf.namelist():
                        if file_info.endswith('.xml'):
                            # Extrair apenas o arquivo XML
                            zf.extract(file_info, output_folder)
                            extract_count += 1
                logger.info(f"Extraídos {extract_count} XMLs")
            except Exception as e:
                logger.error(f"Erro ao extrair ZIP: {e}")

            # Mover arquivos de subpastas para a pasta principal
            for root, dirs, files in os.walk(output_folder):
                for file in files:
                    if file.endswith('.xml') and root != output_folder:
                        src = os.path.join(root, file)
                        dst = os.path.join(output_folder, file)
                        if not os.path.exists(dst):
                            shutil.move(src, dst)

            # Remover subpastas vazias
            for root, dirs, files in os.walk(output_folder, topdown=False):
                for dir_name in dirs:
                    dir_path = os.path.join(root, dir_name)
                    try:
                        os.rmdir(dir_path)
                    except:
                        pass

            # Remover o ZIP
            try:
                os.remove(latest_zip)
                logger.info(f"ZIP removido: {os.path.basename(latest_zip)}")
            except:
                pass

            return True

        if xml_files:
            # Se baixou XML direto (sem ZIP)
            for xml_file in xml_files:
                dst = os.path.join(output_folder, os.path.basename(xml_file))
                if not os.path.exists(dst):
                    shutil.move(xml_file, dst)
            logger.info(f"XMLs movidos para {output_folder}")
            return True

        time.sleep(2)

    logger.warning("Timeout aguardando download")
    return False


def download_xmls_by_date(target_date: str, doc_types: list = None):
    """
    Baixa XMLs de CT-e e/ou MDF-e para uma data específica.

    Args:
        target_date: Data no formato DD/MM/YYYY
        doc_types: Lista de tipos de documento ['cte', 'mdfe'] ou None para ambos
    """
    if doc_types is None:
        doc_types = ['cte', 'mdfe']

    logger.info("=" * 60)
    logger.info(f"DOWNLOAD DE XMLs - Data: {target_date}")
    logger.info(f"Tipos: {', '.join(doc_types).upper()}")
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

        # Baixar CT-e se solicitado
        if 'cte' in doc_types:
            logger.info("-" * 40)
            logger.info("PASSO 2: Baixando CT-e...")
            logger.info("-" * 40)
            download_cte_xmls(client, target_date)

        # Baixar MDF-e se solicitado
        if 'mdfe' in doc_types:
            logger.info("-" * 40)
            logger.info("PASSO 3: Baixando MDF-e...")
            logger.info("-" * 40)
            download_mdfe_xmls(client, target_date)

        logger.info("=" * 60)
        logger.info("DOWNLOAD CONCLUÍDO!")
        logger.info(f"Arquivos salvos em: {DOWNLOAD_DIR}")
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


def close_communication_banner(client):
    """Fecha o banner de comunicados que aparece no topo"""
    from selenium.webdriver.common.by import By

    try:
        # Botão X para fechar o banner de comunicados
        close_btn = client._find_element_multiple_strategies([
            (By.CSS_SELECTOR, '.btn-close'),
            (By.XPATH, '//button[contains(@class, "close")]'),
            (By.XPATH, '//div[contains(@class, "alert")]//button'),
            (By.XPATH, '//span[text()="×"]'),
            (By.CSS_SELECTOR, '[data-dismiss="alert"]'),
        ])

        if close_btn and close_btn.is_displayed():
            client._safe_click(close_btn)
            logger.debug("Banner de comunicados fechado")
            time.sleep(0.5)
    except:
        pass


def download_cte_xmls(client: EGSClient, target_date: str):
    """Baixa XMLs de CT-e para uma data específica"""
    from selenium.webdriver.common.by import By

    logger.info(f"Navegando para exportação de CT-e...")

    try:
        # Fechar banner de comunicados se aparecer
        close_communication_banner(client)
        time.sleep(1)

        # Navegar via menu: FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML
        logger.info("Navegando via menu FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML...")

        # Clicar no menu FISCAL
        fiscal_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "FISCAL")]'),
            (By.XPATH, '//a[contains(., "FISCAL")]'),
            (By.XPATH, '//li[contains(., "FISCAL")]'),
        ], timeout=10)

        if fiscal_menu:
            client._safe_click(fiscal_menu)
            time.sleep(1)
            logger.info("Menu FISCAL clicado")

        # Clicar em CT-E / CT-E OS
        cte_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "CT-E")]'),
            (By.XPATH, '//a[contains(., "CT-E")]'),
            (By.XPATH, '//*[contains(text(), "CT-E / CT-E OS")]'),
        ], timeout=10)

        if cte_menu:
            client._safe_click(cte_menu)
            time.sleep(1)
            logger.info("Menu CT-E clicado")

        # Clicar em EXPORTAÇÃO XML
        export_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//a[contains(., "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//*[contains(text(), "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//a[contains(@href, "cte-tela-xml")]'),
        ], timeout=10)

        if export_menu:
            client._safe_click(export_menu)
            time.sleep(3)
            logger.info("Menu EXPORTAÇÃO XML clicado")

        # Alternativa: Navegar via JavaScript
        if not export_menu:
            logger.info("Tentando navegação via JavaScript...")
            client.browser.driver.execute_script("window.location.hash = '#/cte-tela-xml';")
            time.sleep(3)

        client.browser.screenshot('cte_page.png')

        # Aguardar grid carregar
        if not client._wait_for_devexpress_grid(timeout=30):
            logger.warning("Grid não carregou completamente...")

        # Verificar contagem de registros antes do filtro
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid: {page_info}")
        except:
            pass

        # Aplicar filtro de data
        logger.info(f"Aplicando filtro para data: {target_date}")
        filter_success = apply_date_filter(client, target_date)
        time.sleep(3)

        # Aguardar grid recarregar
        client._wait_for_devexpress_grid(timeout=30)
        client.browser.screenshot('cte_filtered.png')

        # Verificar contagem após filtro
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros após filtro: {page_info}")
        except:
            pass

        # Verificar se há dados
        if check_no_data(client):
            logger.warning(f"Nenhum CT-e encontrado para {target_date}")
            return True

        # Selecionar todos os registros
        logger.info("Selecionando todos os registros...")
        select_all_records(client)
        time.sleep(1)
        client.browser.screenshot('cte_selected.png')

        # Clicar em Download XML
        logger.info("Iniciando download...")
        click_download_button(client, 'cte')

        # Aguardar download
        downloaded = wait_for_download(client, 'cte', target_date)

        if downloaded:
            logger.info("CT-e XMLs baixados com sucesso!")

        return downloaded

    except Exception as e:
        logger.error(f"Erro ao baixar CT-e: {e}")
        import traceback
        traceback.print_exc()
        client.browser.screenshot('cte_error.png')
        return False


def download_mdfe_xmls(client: EGSClient, target_date: str):
    """Baixa XMLs de MDF-e para uma data específica via Portal Contador XML (modelo 58)"""
    from selenium.webdriver.common.by import By

    logger.info(f"Verificando existência de MDF-e (modelo 58) no Portal Contador XML...")

    try:
        # Fechar banner de comunicados se aparecer
        close_communication_banner(client)
        time.sleep(1)

        # Navegar para Portal Contador XML via menu
        logger.info("Navegando para SISTEMA > Portal Contador XML...")

        # Clicar no menu SISTEMA
        sistema_menu = client._wait_and_find_element([
            (By.XPATH, '//span[text()="SISTEMA"]'),
            (By.XPATH, '//a[contains(., "SISTEMA")]'),
        ], timeout=10)

        if sistema_menu:
            client._safe_click(sistema_menu)
            time.sleep(2)
            logger.info("Menu SISTEMA expandido")

            # Clicar em Portal Contador XML
            portal_menu = client._wait_and_find_element([
                (By.XPATH, '//a[contains(., "Portal Contador XML")]'),
                (By.XPATH, '//span[contains(text(), "Portal Contador XML")]'),
            ], timeout=10)

            if portal_menu:
                client._safe_click(portal_menu)
                time.sleep(3)
                logger.info("Portal Contador XML clicado")

        # Fechar comunicados novamente
        close_communication_banner(client)
        time.sleep(1)

        client.browser.screenshot('mdfe_portal_contador.png')

        # Verificar se estamos na página correta
        current_url = client.browser.driver.current_url
        logger.info(f"URL atual: {current_url}")

        # Aguardar grid carregar
        if not client._wait_for_devexpress_grid(timeout=30):
            logger.warning("Grid não carregou completamente...")

        # Verificar se existe modelo 58 (MDF-e) no Portal Contador XML
        logger.info("Verificando existência de MDF-e (modelo 58) na grid...")

        # Verificar modelos disponíveis no filtro da coluna Modelo
        filter_click = client.browser.driver.execute_script("""
            var headers = document.querySelectorAll('.dx-datagrid-headers .dx-header-row td');
            for (var i = 0; i < headers.length; i++) {
                if (headers[i].innerText.includes('Modelo')) {
                    var filterIcon = headers[i].querySelector('.dx-header-filter');
                    if (filterIcon) {
                        filterIcon.click();
                        return 'clicked';
                    }
                }
            }
            return 'not_found';
        """)
        logger.info(f"Clique no filtro Modelo: {filter_click}")

        if filter_click == 'clicked':
            time.sleep(3)  # Aguardar popup carregar

            client.browser.screenshot('mdfe_modelo_filter_options.png')

            # Verificar se 58 está nas opções
            available_models = client.browser.driver.execute_script("""
                var items = document.querySelectorAll('.dx-popup-content .dx-list-item, .dx-overlay-content .dx-list-item, .dx-scrollview-content .dx-item');
                var models = [];
                for (var i = 0; i < items.length; i++) {
                    var text = items[i].innerText.trim();
                    if (text && text !== '(Selecionar todos)' && text !== 'Selecionar todos') {
                        models.push(text);
                    }
                }
                return models;
            """)
            logger.info(f"Modelos disponíveis no filtro: {available_models}")

            if '58' not in available_models:
                # Fechar o popup
                client.browser.driver.execute_script("""
                    // Clicar em Cancelar ou fora do popup
                    var cancelBtn = document.querySelector('.dx-popup-bottom .dx-button:last-child');
                    if (cancelBtn) cancelBtn.click();
                    else document.body.click();
                """)
                time.sleep(1)

                logger.warning("=" * 60)
                logger.warning("NÃO EXISTEM MDF-e (modelo 58) NO SISTEMA!")
                logger.warning(f"Modelos disponíveis: {available_models}")
                logger.warning("O Portal Contador XML só possui CT-e (modelos 55 e 57).")
                logger.warning("Esta empresa não tem MDF-e cadastrados.")
                logger.warning("=" * 60)
                return True  # Retorna True pois não é erro, apenas não há dados

            # Selecionar apenas modelo 58
            logger.info("Selecionando modelo 58 (MDF-e)...")
            select_result = client.browser.driver.execute_script("""
                // Primeiro desmarcar todos
                var selectAll = document.querySelector('.dx-list-select-all-checkbox');
                if (selectAll && selectAll.classList.contains('dx-checkbox-checked')) {
                    selectAll.click();
                }

                // Marcar apenas 58
                var items = document.querySelectorAll('.dx-list-item');
                for (var i = 0; i < items.length; i++) {
                    var text = items[i].innerText.trim();
                    if (text === '58') {
                        var checkbox = items[i].querySelector('.dx-checkbox');
                        if (checkbox && !checkbox.classList.contains('dx-checkbox-checked')) {
                            checkbox.click();
                        }
                        return 'selected_58';
                    }
                }
                return 'not_found';
            """)
            logger.info(f"Seleção do modelo 58: {select_result}")

            # Clicar em OK
            client.browser.driver.execute_script("""
                var okBtn = document.querySelector('.dx-popup-bottom .dx-button:first-child');
                if (okBtn) okBtn.click();
            """)
            time.sleep(3)

        # Verificar contagem de registros
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid (MDF-e): {page_info}")
        except:
            pass

        # Aplicar filtro de data
        logger.info(f"Aplicando filtro para data: {target_date}")
        filter_success = apply_date_filter(client, target_date)
        time.sleep(3)

        # Aguardar grid recarregar
        client._wait_for_devexpress_grid(timeout=30)
        client.browser.screenshot('mdfe_filtered.png')

        # Verificar contagem após filtro
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros após filtro: {page_info}")
        except:
            pass

        # Verificar se há dados
        if check_no_data(client):
            logger.warning(f"Nenhum MDF-e encontrado para {target_date}")
            return True

        # Selecionar todos os registros
        logger.info("Selecionando todos os registros...")
        select_all_records(client)
        time.sleep(1)
        client.browser.screenshot('mdfe_selected.png')

        # Clicar em Download XML
        logger.info("Iniciando download...")
        click_download_button(client, 'mdfe')

        # Aguardar download
        downloaded = wait_for_download(client, 'mdfe', target_date)

        if downloaded:
            logger.info("MDF-e XMLs baixados com sucesso!")

        return downloaded

    except Exception as e:
        logger.error(f"Erro ao baixar MDF-e: {e}")
        import traceback
        traceback.print_exc()
        client.browser.screenshot('mdfe_error.png')
        return False


def apply_date_filter(client: EGSClient, target_date: str):
    """Aplica filtro de data na grid usando o Construtor de Filtro DevExpress"""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    logger.info(f"Aplicando filtro de data: {target_date}")

    try:
        # Primeiro, fechar qualquer modal aberto
        try:
            cancel_btn = client.browser.driver.find_element(By.XPATH, '//button[contains(text(), "Cancelar")]')
            if cancel_btn.is_displayed():
                cancel_btn.click()
                time.sleep(1)
        except:
            pass

        # Clicar em "Criar filtro" para abrir o construtor
        criar_filtro = client._wait_and_find_element([
            (By.XPATH, '//*[contains(text(), "Criar filtro")]'),
            (By.CSS_SELECTOR, '.dx-datagrid-filter-panel-text'),
            (By.XPATH, '//span[contains(text(), "Criar filtro")]'),
        ], timeout=5)

        if criar_filtro:
            logger.info("Abrindo Construtor de Filtro...")
            client._safe_click(criar_filtro)
            time.sleep(2)
            client.browser.screenshot('filter_builder_opened.png')

            # Usar JavaScript para configurar o filtro DevExpress
            # O filtro é por Data Emissão = target_date
            filter_applied = client.browser.driver.execute_script(f"""
                try {{
                    // Procurar o botão de adicionar condição ("+")
                    var addBtn = document.querySelector('.dx-filterbuilder-add-condition');
                    if (addBtn) {{
                        addBtn.click();
                        return 'add_clicked';
                    }}

                    // Alternativa: tentar via API DevExpress
                    var filterBuilder = $('.dx-filterbuilder').dxFilterBuilder('instance');
                    if (filterBuilder) {{
                        filterBuilder.option('value', [['dataEmissao', '=', '{target_date}']]);
                        return 'api_applied';
                    }}

                    return 'not_found';
                }} catch(e) {{
                    return 'error: ' + e.message;
                }}
            """)

            logger.info(f"Resultado do construtor de filtro: {filter_applied}")

            # Se conseguiu abrir, agora precisamos configurar manualmente
            # Clicar no primeiro campo (selecionar coluna)
            time.sleep(1)

            # Procurar dropdown de campo
            field_dropdown = client._find_element_multiple_strategies([
                (By.CSS_SELECTOR, '.dx-filterbuilder-item-field'),
                (By.XPATH, '//div[contains(@class, "dx-filterbuilder")]//div[contains(@class, "dx-selectbox")]'),
            ])

            if field_dropdown:
                client._safe_click(field_dropdown)
                time.sleep(1)

                # Procurar e selecionar "Data Emissão" ou similar
                data_option = client._find_element_multiple_strategies([
                    (By.XPATH, '//div[contains(@class, "dx-list-item") and contains(., "Data")]'),
                    (By.XPATH, '//div[contains(@class, "dx-list-item") and contains(., "Emissão")]'),
                    (By.XPATH, '//*[contains(text(), "Data Emissão")]'),
                ])

                if data_option:
                    client._safe_click(data_option)
                    time.sleep(1)

            # Procurar campo de valor e preencher data
            value_input = client._find_element_multiple_strategies([
                (By.CSS_SELECTOR, '.dx-filterbuilder-item-value input'),
                (By.CSS_SELECTOR, '.dx-datebox input'),
                (By.XPATH, '//div[contains(@class, "dx-filterbuilder")]//input'),
            ])

            if value_input:
                value_input.clear()
                value_input.send_keys(target_date)
                value_input.send_keys(Keys.TAB)
                time.sleep(1)

            # Clicar em OK para aplicar o filtro
            ok_btn = client._wait_and_find_element([
                (By.XPATH, '//button[text()="OK"]'),
                (By.XPATH, '//div[contains(@class, "dx-popup")]//button[contains(., "OK")]'),
                (By.CSS_SELECTOR, '.dx-popup-bottom .dx-button'),
            ], timeout=5)

            if ok_btn:
                client._safe_click(ok_btn)
                logger.info("Filtro aplicado via Construtor")
                time.sleep(2)
                client.browser.screenshot('filter_applied.png')
                return True

        # Método alternativo: Usar filtro de coluna diretamente na grid
        logger.info("Tentando filtro direto na coluna...")

        # Procurar ícone de filtro na coluna de data
        filter_icon = client._find_element_multiple_strategies([
            (By.CSS_SELECTOR, '.dx-header-filter'),
            (By.XPATH, '//td[contains(@aria-label, "Data")]//div[contains(@class, "dx-header-filter")]'),
        ])

        if filter_icon:
            client._safe_click(filter_icon)
            time.sleep(1)

            # Selecionar a data específica
            date_checkbox = client._find_element_multiple_strategies([
                (By.XPATH, f'//div[contains(@class, "dx-list-item") and contains(., "{target_date}")]'),
                (By.XPATH, f'//*[contains(text(), "{target_date}")]'),
            ])

            if date_checkbox:
                client._safe_click(date_checkbox)
                time.sleep(1)

                # Clicar OK
                ok_btn = client._find_element_multiple_strategies([
                    (By.XPATH, '//button[text()="OK"]'),
                    (By.CSS_SELECTOR, '.dx-popup-bottom .dx-button'),
                ])
                if ok_btn:
                    client._safe_click(ok_btn)
                    return True

        return False

    except Exception as e:
        logger.warning(f"Erro ao aplicar filtro: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_no_data(client: EGSClient) -> bool:
    """Verifica se a grid está sem dados"""
    from selenium.webdriver.common.by import By

    no_data = client.browser.find_element_safe(By.CSS_SELECTOR, ".dx-datagrid-nodata")
    if no_data and no_data.is_displayed():
        return True

    # Verificar texto na página
    body_text = client.browser.driver.find_element(By.TAG_NAME, 'body').text.lower()
    if 'sem dados' in body_text or 'nenhum registro' in body_text:
        return True

    return False


def select_all_records(client: EGSClient):
    """Seleciona todos os registros na grid"""
    from selenium.webdriver.common.by import By

    # Método 1: Clicar no checkbox do header
    try:
        result = client.browser.driver.execute_script("""
            // Procurar checkbox de selecionar todos no header
            var headerCheckbox = document.querySelector('.dx-header-row .dx-checkbox, .dx-datagrid-headers .dx-checkbox');
            if (headerCheckbox) {
                headerCheckbox.click();
                return 'clicked_header';
            }

            // Tentar via API DevExpress
            var grid = $('.dx-datagrid').dxDataGrid('instance');
            if (grid) {
                grid.selectAll();
                return 'api_select_all';
            }

            return 'not_found';
        """)
        logger.info(f"Seleção: {result}")
    except Exception as e:
        logger.warning(f"Erro na seleção via JS: {e}")

    # Método 2: Clicar nos checkboxes individualmente
    checkboxes = client.browser.driver.find_elements(
        By.CSS_SELECTOR, '.dx-datagrid-rowsview .dx-checkbox:not(.dx-checkbox-checked)'
    )

    for cb in checkboxes[:100]:  # Limitar
        try:
            client._safe_click(cb)
            time.sleep(0.1)
        except:
            continue


def click_download_button(client: EGSClient, doc_type: str):
    """Clica no botão de download"""
    from selenium.webdriver.common.by import By

    # Procurar botão de download
    download_btn = client._find_element_multiple_strategies([
        (By.XPATH, '//button[contains(., "Download XML")]'),
        (By.XPATH, '//button[contains(., "Download")]'),
        (By.XPATH, '//egs-button-common[@name="\'Download XML\'"]//button'),
        (By.CSS_SELECTOR, 'button[data-original-title*="Download"]'),
        (By.XPATH, '//button[contains(@class, "btn") and contains(., "XML")]'),
    ])

    if download_btn:
        client._safe_click(download_btn)
        logger.info("Botão Download clicado")
        time.sleep(2)
    else:
        # Tentar via JavaScript
        result = client.browser.driver.execute_script("""
            var buttons = document.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].innerText.includes('Download') ||
                    buttons[i].innerText.includes('XML')) {
                    buttons[i].click();
                    return 'clicked';
                }
            }
            return 'not_found';
        """)
        logger.info(f"Download via JS: {result}")


def wait_for_download(client: EGSClient, doc_type: str, target_date: str, timeout: int = 120):
    """Aguarda o download completar"""
    import glob

    logger.info(f"Aguardando download de {doc_type.upper()}...")

    start_time = time.time()

    while time.time() - start_time < timeout:
        # Verificar arquivos baixados
        xml_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.xml"))
        zip_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.zip"))

        # Verificar se há arquivos .crdownload (download em progresso)
        downloading = glob.glob(os.path.join(DOWNLOAD_DIR, "*.crdownload"))

        if downloading:
            logger.debug("Download em progresso...")
            time.sleep(2)
            continue

        if xml_files or zip_files:
            all_files = xml_files + zip_files
            latest_file = max(all_files, key=os.path.getctime)
            logger.info(f"Download concluído: {os.path.basename(latest_file)}")

            # Renomear arquivo com tipo e data
            date_str = target_date.replace('/', '-')
            new_name = f"{doc_type}_{date_str}_{os.path.basename(latest_file)}"
            new_path = os.path.join(DOWNLOAD_DIR, new_name)

            try:
                os.rename(latest_file, new_path)
                logger.info(f"Arquivo renomeado: {new_name}")
            except:
                pass

            return True

        time.sleep(2)

    logger.warning("Timeout aguardando download")
    return False


def download_all_xmls(year: int = None, doc_types: list = None):
    """
    Baixa TODOS os XMLs de CT-e e/ou MDF-e disponíveis no sistema.
    O EGS Sistemas não filtra por período corretamente, então baixa tudo de uma vez.

    Args:
        year: Ano para nomear a pasta (ex: 2025) - se None, usa o ano atual
        doc_types: Lista de tipos de documento ['cte', 'mdfe'] ou None para ambos
    """
    if doc_types is None:
        doc_types = ['cte', 'mdfe']

    if year is None:
        year = datetime.now().year

    logger.info("=" * 60)
    logger.info(f"DOWNLOAD DE TODOS OS XMLs - Ano: {year}")
    logger.info(f"Tipos: {', '.join(doc_types).upper()}")
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
        logger.info("Realizando login...")
        logger.info("-" * 40)

        if not client.login():
            logger.error("FALHA NO LOGIN!")
            return False

        logger.info("LOGIN OK!")

        # Criar pastas de destino
        cte_folder = os.path.join(DOWNLOAD_DIR, f"cte_{year}")
        mdfe_folder = os.path.join(DOWNLOAD_DIR, f"mdfe_{year}")

        # Baixar CT-e se solicitado
        if 'cte' in doc_types:
            os.makedirs(cte_folder, exist_ok=True)
            logger.info("-" * 40)
            logger.info(f"Baixando TODOS os CT-e para {cte_folder}...")
            logger.info("-" * 40)
            try:
                download_all_cte_xmls(client, cte_folder)
                cte_count = len(glob.glob(os.path.join(cte_folder, "*.xml")))
                logger.info(f"CT-e: {cte_count} XMLs baixados")
            except Exception as e:
                logger.error(f"Erro ao baixar CT-e: {e}")

        # Baixar MDF-e se solicitado
        if 'mdfe' in doc_types:
            os.makedirs(mdfe_folder, exist_ok=True)
            logger.info("-" * 40)
            logger.info(f"Baixando TODOS os MDF-e para {mdfe_folder}...")
            logger.info("-" * 40)
            try:
                download_all_mdfe_xmls(client, mdfe_folder)
                mdfe_count = len(glob.glob(os.path.join(mdfe_folder, "*.xml")))
                logger.info(f"MDF-e: {mdfe_count} XMLs baixados")
            except Exception as e:
                logger.error(f"Erro ao baixar MDF-e: {e}")

        # Resultado final
        logger.info("")
        logger.info("=" * 60)
        logger.info("DOWNLOAD CONCLUÍDO!")
        if 'cte' in doc_types:
            cte_count = len(glob.glob(os.path.join(cte_folder, "*.xml")))
            logger.info(f"CT-e: {cte_count} XMLs em {cte_folder}")
        if 'mdfe' in doc_types:
            mdfe_count = len(glob.glob(os.path.join(mdfe_folder, "*.xml")))
            logger.info(f"MDF-e: {mdfe_count} XMLs em {mdfe_folder}")
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


def download_all_cte_xmls(client: EGSClient, output_folder: str):
    """Baixa TODOS os XMLs de CT-e (sem filtro de período)"""
    from selenium.webdriver.common.by import By

    logger.info("Navegando para exportação de CT-e...")

    try:
        # Fechar banner de comunicados se aparecer
        close_communication_banner(client)
        time.sleep(1)

        # Navegar via menu: FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML
        logger.info("Navegando via menu FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML...")

        # Clicar no menu FISCAL
        fiscal_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "FISCAL")]'),
            (By.XPATH, '//a[contains(., "FISCAL")]'),
            (By.XPATH, '//li[contains(., "FISCAL")]'),
        ], timeout=10)

        if fiscal_menu:
            client._safe_click(fiscal_menu)
            time.sleep(1)
            logger.info("Menu FISCAL clicado")

        # Clicar em CT-E / CT-E OS
        cte_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "CT-E")]'),
            (By.XPATH, '//a[contains(., "CT-E")]'),
            (By.XPATH, '//*[contains(text(), "CT-E / CT-E OS")]'),
        ], timeout=10)

        if cte_menu:
            client._safe_click(cte_menu)
            time.sleep(1)
            logger.info("Menu CT-E clicado")

        # Clicar em EXPORTAÇÃO XML
        export_menu = client._wait_and_find_element([
            (By.XPATH, '//span[contains(text(), "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//a[contains(., "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//*[contains(text(), "EXPORTAÇÃO XML")]'),
            (By.XPATH, '//a[contains(@href, "cte-tela-xml")]'),
        ], timeout=10)

        if export_menu:
            client._safe_click(export_menu)
            time.sleep(3)
            logger.info("Menu EXPORTAÇÃO XML clicado")

        # Aguardar grid carregar
        if not client._wait_for_devexpress_grid(timeout=30):
            logger.warning("Grid não carregou completamente...")

        # Verificar contagem de registros
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid: {page_info}")
        except:
            pass

        # Verificar se há dados
        if check_no_data(client):
            logger.warning("Nenhum CT-e encontrado")
            return True

        # Selecionar todos os registros
        logger.info("Selecionando todos os registros...")
        select_all_records(client)
        time.sleep(1)

        # Clicar em Download XML
        logger.info("Iniciando download...")
        click_download_button(client, 'cte')

        # Aguardar download e extrair
        downloaded = wait_for_download_and_extract(client, 'cte', output_folder)

        if downloaded:
            logger.info("CT-e XMLs baixados com sucesso!")

        return downloaded

    except Exception as e:
        logger.error(f"Erro ao baixar CT-e: {e}")
        import traceback
        traceback.print_exc()
        return False


def download_all_mdfe_xmls(client: EGSClient, output_folder: str):
    """Baixa TODOS os XMLs de MDF-e (sem filtro de período)"""
    from selenium.webdriver.common.by import By

    logger.info("Navegando para página de MDF-e...")

    try:
        # Fechar banner de comunicados se aparecer
        close_communication_banner(client)
        time.sleep(1)

        # Navegar diretamente para a página de MDF-e
        logger.info("Navegando para https://app.egssistemas.com.br/mdfe...")
        client.browser.driver.get('https://app.egssistemas.com.br/mdfe')
        time.sleep(5)

        # Fechar comunicados novamente
        close_communication_banner(client)
        time.sleep(1)

        # Verificar se estamos na página correta
        current_url = client.browser.driver.current_url
        logger.info(f"URL atual: {current_url}")

        # Aguardar grid carregar
        if not client._wait_for_devexpress_grid(timeout=30):
            logger.warning("Grid não carregou completamente...")

        # Verificar contagem de registros
        try:
            page_info = client.browser.driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
            logger.info(f"Registros na grid: {page_info}")
        except:
            pass

        # Verificar se há dados
        if check_no_data(client):
            logger.warning("Nenhum MDF-e encontrado")
            return True

        # Selecionar TODOS os registros usando checkbox do header
        logger.info("Selecionando todos os registros...")
        select_result = client.browser.driver.execute_script("""
            // Encontrar checkbox do header (selecionar todos)
            var headerCheckbox = document.querySelector('.dx-header-row .dx-checkbox');
            if (headerCheckbox) {
                headerCheckbox.click();
                return 'clicked_header_checkbox';
            }
            return 'header_checkbox_not_found';
        """)
        logger.info(f"Seleção: {select_result}")
        time.sleep(2)

        # Verificar quantos estão selecionados
        selected_count = client.browser.driver.execute_script("""
            var checked = document.querySelectorAll('.dx-datagrid-rowsview .dx-checkbox-checked');
            return checked.length;
        """)
        logger.info(f"Registros selecionados: {selected_count}")

        if selected_count == 0:
            logger.warning("Nenhum registro selecionado!")
            return True

        # Clicar no botão "Baixar xml" (ng-click="downloadXml()")
        logger.info("Clicando em Baixar XML...")
        download_result = client.browser.driver.execute_script("""
            // Procurar botão de download XML pelo ng-click
            var downloadBtn = document.querySelector("button[ng-click='downloadXml()']");
            if (downloadBtn) {
                downloadBtn.click();
                return 'clicked_downloadXml';
            }
            return 'not_found';
        """)
        logger.info(f"Resultado do clique em Download: {download_result}")

        if download_result == 'not_found':
            logger.error("Botão de download não encontrado!")
            return False

        time.sleep(2)

        # Aguardar download e extrair
        downloaded = wait_for_download_and_extract(client, 'mdfe', output_folder)

        if downloaded:
            logger.info("MDF-e XMLs baixados com sucesso!")

        return downloaded

    except Exception as e:
        logger.error(f"Erro ao baixar MDF-e: {e}")
        import traceback
        traceback.print_exc()
        return False


def download_xmls_full_year(year: int, doc_types: list = None):
    """
    Alias para download_all_xmls para manter compatibilidade.
    """
    return download_all_xmls(year, doc_types)


if __name__ == "__main__":
    # Data padrão: 05/12/2025
    target_date = "05/12/2025"

    # Verificar argumentos
    if len(sys.argv) > 1:
        target_date = sys.argv[1]

    # Executar download
    success = download_xmls_by_date(target_date, ['cte', 'mdfe'])

    sys.exit(0 if success else 1)
