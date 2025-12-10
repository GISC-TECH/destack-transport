from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
import time
import os
import struct
import traceback
import logging

# Substitua aqui se necessario
USERNAME = 'DESTACK'
PASSWORD = '1234567'
ACCESS_KEY = '57226'

# Caminho para salvar os XMLs
DOWNLOAD_DIR = os.path.join(os.getcwd(), 'downloads_xml')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper_debug.log', mode='w', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

def print_log(msg):
    logging.info(msg)

def setup_driver():
    """Configura o browser Chrome"""
    # Verificar arquitetura
    arch = struct.calcsize("P") * 8
    print_log(f"[*] Python Architecture: {arch}-bit")

    options = webdriver.ChromeOptions()
    # options.add_argument('--headless=new') 
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-gpu')
    options.add_argument('--start-maximized')
    
    # Configurar downloads automaticos
    prefs = {
        'download.default_directory': DOWNLOAD_DIR,
        'download.prompt_for_download': False,
        'download.directory_upgrade': True,
        'safebrowsing.enabled': False
    }
    options.add_experimental_option('prefs', prefs)
    
    driver = webdriver.Chrome(options=options)
    return driver

def main():
    driver = None
    try:
        print_log(f"[*] Iniciando automacao...")
        print_log(f"[*] Credenciais: {USERNAME} / **** / {ACCESS_KEY}")
        
        driver = setup_driver()
        wait = WebDriverWait(driver, 20)
        
        # 1. Login
        print_log("[*] Acessando pagina de login...")
        driver.get('https://app.egssistemas.com.br/login')
        
        try:
            # Verificar se estamos na pagina de login (campos visiveis)
            time.sleep(5)
            print_log("[*] Verificando estado do login...")
            
            is_login_page = False
            try:
                if driver.find_elements(By.NAME, 'login') or driver.find_elements(By.NAME, 'username'):
                     is_login_page = True
            except:
                pass

            if not is_login_page:
                 # Check if we are really logged in or just loading
                 if "Sair" in driver.page_source and "ng-hide" not in driver.find_element(By.ID, "menu-container-main").get_attribute("class"):
                     print_log("[*] Dashboard detectado e visivel. Pulando login.")
                 else:
                     # Fallback: se nao achou login nem dashboard, assume login page por seguranca ou reload
                     print_log("[*] Estado indeterminado. Tentando login...")
                     is_login_page = True
            
            if is_login_page:
                print_log("[*] Formulario de login detectado. Iniciando login...")
                user_selectors = [
                    'input[name="username"]', 
                    'input[name="login"]',
                    'input[name="user"]'
                ]
                
                user_input = None
                for selector in user_selectors:
                    try:
                        user_input = driver.find_element(By.CSS_SELECTOR, selector)
                        if user_input.is_displayed():
                            break
                    except:
                        continue
                
                if not user_input:
                    # Generic fallback
                    user_input = driver.find_element(By.TAG_NAME, 'input')

                user_input.clear()
                user_input.send_keys(USERNAME)
                
                pass_input = None
                try:
                    pass_input = driver.find_element(By.NAME, 'senha')
                except:
                    try:
                        pass_input = driver.find_element(By.NAME, 'password')
                    except:
                        pass_input = driver.find_element(By.CSS_SELECTOR, 'input[type="password"]')
                
                if pass_input:
                    pass_input.clear()
                    pass_input.send_keys(PASSWORD)
                
                try:
                    key_input = driver.find_element(By.NAME, 'chaveAcesso')
                    key_input.clear()
                    key_input.send_keys(ACCESS_KEY)
                except:
                    pass

                print_log("[*] Clicando em Entrar...")
                try:
                    btn = driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')
                    btn.click()
                except:
                    if pass_input:
                        pass_input.submit()
        except Exception as e:
            print_log(f"[ERROR] Falha no preenchimento do login: {e}")
            driver.save_screenshot(os.path.join(DOWNLOAD_DIR, 'login_fail.png'))
            return

        time.sleep(10)

        # 1.1 Verificar e tratar Limite de Sessao
        logging.info("Verificando avisos de sessao...")
        
        max_session_retries = 3
        for attempt in range(max_session_retries):
            logging.info(f"Tentativa de verificação de sessão {attempt+1}/{max_session_retries}")
            time.sleep(2)
            
            try:
                page_source = driver.page_source
                
                # Caso 1: Popup Simples "OK"
                if "Todos os seus acessos já estão sendo utilizados" in page_source:
                   logging.info("ALERTA: Popup simples de limite de sessão detectado.")
                   try:
                       ok_btn = driver.find_element(By.CSS_SELECTOR, "button.msgButton[ng-click='close()']")
                       if ok_btn.is_displayed():
                           logging.info("Clicando em OK no popup de aviso...")
                           driver.execute_script("arguments[0].click();", ok_btn)
                           time.sleep(3)
                           continue
                   except:
                       pass

                # Caso 2: Popup Grid "Desconectar"
                if "Limite de usuários" in page_source or "Desconectar" in page_source:
                    logging.info("ALERTA: Popup de lista de usuários detectado! Tentando resolver...")
                    
                    try:
                        logging.info("Aguardando carregamento da lista de usuários (5s)...")
                        time.sleep(5) 
                        
                        disconnect_selectors = [
                            "//span[contains(text(), 'Desconectar')]",
                            "//div[contains(@ng-click, 'disconnect')]",
                            "//div[contains(@class, 'dx-template-wrapper')]//div[contains(@style, 'cursor: pointer')]",
                            "//button[contains(., 'Desconectar')]" 
                        ]
                        
                        desconectar_btn = None
                        try:
                            combined_xpath = " | ".join(disconnect_selectors)
                            desconectar_btn = WebDriverWait(driver, 10).until(
                                EC.element_to_be_clickable((By.XPATH, combined_xpath))
                            )
                            logging.info("Botão 'Desconectar' encontrado via WebDriverWait.")
                        except:
                            for xpath in disconnect_selectors:
                                try:
                                    desconectar_btn = driver.find_element(By.XPATH, xpath)
                                    if desconectar_btn and desconectar_btn.is_displayed():
                                        break
                                except:
                                    continue

                        if desconectar_btn:
                            logging.info("Clicando em 'Desconectar'...")
                            driver.execute_script("arguments[0].scrollIntoView(true);", desconectar_btn)
                            time.sleep(1)
                            driver.execute_script("arguments[0].click();", desconectar_btn)
                                
                            logging.info("Clique realizado. Aguardando popup de confirmação...")
                            time.sleep(3)

                            # Handle Confirmation
                            try:
                                logging.info("Procurando botão 'Sim' para confirmar desconexão...")
                                sim_btn = WebDriverWait(driver, 5).until(
                                    EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Sim')]"))
                                )
                                if sim_btn:
                                    logging.info("Clicando em 'Sim'...")
                                    sim_btn.click()
                                    time.sleep(3)
                                    
                                    # Wait for Success "OK"
                                    logging.info("Aguardando popup de sucesso ('OK')...")
                                    try:
                                        success_ok_btn = WebDriverWait(driver, 5).until(
                                            EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'OK')] | //button[contains(@class, 'msgButton')]"))
                                        )
                                        if success_ok_btn:
                                             driver.execute_script("arguments[0].click();", success_ok_btn)
                                             logging.info("Clicado em 'OK' (Sucesso).")
                                             time.sleep(2)
                                    except:
                                        logging.info("Popup de sucesso 'OK' não apareceu ou foi ignorado.")

                                    # Close Modal ("Sair")
                                    logging.info("Fechando modal de lista de usuários...")
                                    try:
                                        close_modal_btn = driver.find_elements(By.XPATH, "//button[contains(., 'Sair')] | //a[contains(., 'Sair')] | //button[@class='close'] | //span[contains(@class, 'egs-close')]")
                                        closed = False
                                        for cmvb in close_modal_btn:
                                            if cmvb.is_displayed():
                                                cmvb.click()
                                                logging.info("Modal fechado via botão 'Sair'/Close.")
                                                closed = True
                                                break
                                        
                                        if not closed:
                                            ActionChains(driver).send_keys(Keys.ESCAPE).perform()
                                        time.sleep(2)
                                    except:
                                        try: ActionChains(driver).send_keys(Keys.ESCAPE).perform()
                                        except: pass

                            except Exception as sim_error:
                                logging.warning(f"Botão 'Sim' não encontrado ou erro ao clicar: {sim_error}")
                            
                            logging.info("Tentando fazer login novamente após desconexão...")
                            # Refill credentials logic
                            try:
                                driver.find_element(By.CSS_SELECTOR, 'input[name="username"], input[name="login"]').send_keys(USERNAME)
                            except: pass
                            try:
                                driver.find_element(By.CSS_SELECTOR, 'input[name="password"], input[name="senha"], input[type="password"]').send_keys(PASSWORD)
                            except: pass
                            try:
                                 driver.find_element(By.NAME, 'chaveAcesso').send_keys(ACCESS_KEY)
                            except: pass
                            
                            logging.info("Clicando em Entrar novamente...")
                            login_button = (
                                driver.find_elements(By.CSS_SELECTOR, 'button[type="submit"]') or
                                driver.find_elements(By.XPATH, '//button[contains(text(), "Entrar")]')
                            )
                            if login_button:
                                try:
                                    driver.execute_script("arguments[0].click();", login_button[0])
                                except:
                                    login_button[0].click()
                                time.sleep(10)
                                continue 
                        else:
                            logging.warning("Botão 'Desconectar' NÃO encontrado. Refreshing...")
                            driver.refresh()
                            time.sleep(5)
                            continue
                            
                    except Exception as btn_error:
                        logging.error(f"Erro ao tentar clicar em Desconectar: {btn_error}")
                        driver.refresh()
                        time.sleep(5)

                if "acessos já estão sendo utilizados" not in page_source and "Limite de usuários" not in page_source:
                    logging.info("Nenhum aviso de sessão detectado nesta verificação.")
                    break

            except Exception as e:
                logging.error(f"Erro no loop de sessão: {e}")
                traceback.print_exc()

            time.sleep(2)

        # 2. Navegar para CTE
        logging.info("Navegando para lista de CTEs via Dashboard...")
        try:
            try:
                cte_link = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, "div[ui-sref='cte']")))
                cte_link.click()
                logging.info("Clicado no link de CTE via seletor direto.")
                
                # Verify Navigation
                try:
                    WebDriverWait(driver, 5).until(EC.url_contains("/cte"))
                    logging.info("URL atualizada para /cte.")
                except:
                    logging.warning("Clique não alterou a URL. Forçando navegação direta...")
                    driver.get('https://app.egssistemas.com.br/cte')

            except Exception as click_error:
                logging.info(f"Link direto falhou ou não alterou página. Tentando buscar no menu...")
                try:
                    search_input = driver.find_element(By.CSS_SELECTOR, 'input[ng-model="searchMenu"]')
                    search_input.clear()
                    search_input.send_keys("CT-e")
                    time.sleep(2)
                    
                    menu_result = driver.find_element(By.XPATH, "//a[contains(., 'Emissão de CT-e')] | //div[contains(text(), 'Emissão de CT-e')]")
                    driver.execute_script("arguments[0].click();", menu_result)
                    logging.info("Clicado no link de CTE via Busca no Menu.")
                    
                    try:
                         WebDriverWait(driver, 5).until(EC.url_contains("/cte"))
                    except:
                         driver.get('https://app.egssistemas.com.br/cte')

                except Exception as search_err:
                     logging.info("Tentando navegação direta por URL...")
                     driver.get('https://app.egssistemas.com.br/cte')

            # Wait for Loader to disappear (User Solution 2)
            logging.info("Aguardando carregamento da tela (spinner)...")
            try:
                # Wait up to 15s for loader to vanish
                wait.until(EC.invisibility_of_element_located((By.CLASS_NAME, "loader-spin-wrapper")))
                wait.until(EC.invisibility_of_element_located((By.XPATH, "//*[contains(text(), 'Carregando')]")))
            except:
                logging.warning("Spinner 'Carregando' persistiu ou não foi detectado corretamente.")

            # Check for Server Connection Error (User Diagnosis)
            if "Você perdeu a conexão com o servidor" in driver.page_source or "serverNotFound" in driver.page_source:
                 logging.error("ERRO DE SERVIDOR DETECTADO: 'Você perdeu a conexão...'. Tentando refresh...")
                 driver.refresh()
                 time.sleep(10)
                 # Re-check navigation if needed, but for now let's hope refresh lands us back or we handle it in next run
            
            logging.info("Aguardando carregamento da grid de CTE...")
            
            # User Solution 1: Use Generic Selector for Grid
            # Instead of dx-col-105, find the header "Emissão"
            try:
                logging.info("Procurando cabeçalho da coluna 'Emissão' ou 'Data'...")
                # header_col = wait.until(EC.visibility_of_element_located((By.XPATH, "//td[contains(@class, 'dx-header-row')]//td[contains(., 'Emissão')]")))
                # Generic fallback if specific structure varies
                header_col = WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located((By.XPATH, "//td[contains(text(), 'Emissão')] | //td[contains(text(), 'Data Emissão')] | //div[contains(text(), 'Emissão')]"))
                )
                logging.info("Cabeçalho da grid encontrado (Grid carregada).")
            except Exception as grid_err:
                 logging.error(f"Erro ao achar grid (Timeout): {grid_err}")
                 # Force screenshot here
                 driver.save_screenshot(os.path.join(DOWNLOAD_DIR, 'erro_grid_debug.png'))
                 raise grid_err

            # --- STEP 1: Filter by Date ---
            target_date = "01/12/2025" 
            logging.info(f"Aplicando filtro de data: {target_date}")
            
            # Find the input associated with the date filter. 
            # Usually in the row below headers: .dx-datagrid-filter-row
            # We will try to find the FIRST date input in the filter row, which is a common safe bet for "Data Emissão" being often the first date column.
            try:
                date_filter_input = driver.find_element(By.XPATH, "//tr[contains(@class, 'dx-datagrid-filter-row')]//td//input[contains(@class, 'dx-texteditor-input')]")
            except:
                # Fallback: specific aria-label or just generic input
                date_filter_input = driver.find_element(By.XPATH, "(//tr[contains(@class, 'dx-datagrid-filter-row')]//input)[1]")

            # Set Filter Condition to "Igual"
            try:
                # The menu button is usually a sibling of the input's container
                filter_menu_btn = date_filter_input.find_element(By.XPATH, "./ancestor::div[contains(@class,'dx-editor-cell')]//div[contains(@class, 'dx-filter-menu-button')]")
                if filter_menu_btn:
                     driver.execute_script("arguments[0].click();", filter_menu_btn)
                     time.sleep(1)
                     igual_option = WebDriverWait(driver, 3).until(
                         EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'dx-menu-item-text') and contains(text(), 'Igual')]"))
                     )
                     igual_option.click()
                     logging.info("Condição 'Igual' selecionada.")
                     time.sleep(1)
            except Exception as e:
                logging.warning(f"Não foi possível selecionar condicao 'Igual' (pode não existir ou falhou): {e}")

            driver.execute_script("arguments[0].click();", date_filter_input)
            time.sleep(1)
            date_filter_input.clear()
            date_filter_input.send_keys(target_date)
            time.sleep(1)
            date_filter_input.send_keys(Keys.ENTER)
            logging.info("Filtro aplicado.")
            
            time.sleep(5)

            # --- STEP 2: Select All ---
            logging.info("Selecionando todos os itens...")
            select_all_checkbox = driver.find_element(By.CSS_SELECTOR, 'td[aria-label="Selecionar todos"] .dx-select-checkbox')
            driver.execute_script("arguments[0].click();", select_all_checkbox)
            logging.info("Checkbox 'Selecionar Todos' clicado.")

            # --- STEP 3: Download XML ---
            logging.info("Tentando clicar em 'Baixar XML'...")
            try:
                download_btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[@title='Baixar XML'] | //div[contains(text(), 'Baixar XML')] | //button[contains(., 'Baixar XML')]"))
                )
                driver.execute_script("arguments[0].click();", download_btn)
                logging.info("Botão 'Baixar XML' clicado com sucesso.")
                time.sleep(10) 
            except Exception as dl_error:
                logging.error(f"Erro ao clicar em Baixar XML: {dl_error}")

            with open(os.path.join(DOWNLOAD_DIR, 'cte_final_state.html'), 'w', encoding='utf-8') as f:
                f.write(driver.page_source)

        except Exception as e:
            logging.error(f"Falha ao navegar/baixar CTE: {e}")
            driver.save_screenshot(os.path.join(DOWNLOAD_DIR, 'cte_fail.png'))
            with open(os.path.join(DOWNLOAD_DIR, 'cte_fail.html'), 'w', encoding='utf-8') as f:
                f.write(driver.page_source)

        logging.info("Processo finalizado.")

    except Exception as e:
        print_log(f"[ERROR] Erro geral: {e}")
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()
