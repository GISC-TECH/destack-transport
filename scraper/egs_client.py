"""
Cliente para o sistema EGS Sistemas
Realiza login e coleta de XMLs de CT-e e MDF-e
Versão atualizada com suporte a:
- Gestão de sessão concorrente (desconectar usuários)
- DevExpress DataGrid
- Seletores robustos
"""
import os
import time
import re
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException

from browser import BrowserManager
from config import (
    EGS_LOGIN_URL, EGS_BASE_URL,
    EGS_USERNAME, EGS_PASSWORD, EGS_ACCESS_KEY,
    DOWNLOAD_DIR, DAYS_LOOKBACK
)
from logger_setup import setup_logger

logger = setup_logger('egs_client')


class EGSClient:
    """Cliente para interagir com o sistema EGS Sistemas"""

    # URLs do sistema
    PORTAL_CONTADOR_XML_URL = f"{EGS_BASE_URL}/Portal-Contador-xml"
    CTE_EXPORTACAO_URL = f"{EGS_BASE_URL}/cte-tela-xml"
    EMISSAO_CTE_URL = f"{EGS_BASE_URL}/emissao-cte"

    def __init__(self, browser: BrowserManager):
        self.browser = browser
        self.logged_in = False

    def login(self) -> bool:
        """
        Realiza login no sistema EGS.
        Trata conflitos de sessão (outro usuário já logado).
        """
        logger.info("Iniciando login no EGS Sistemas...")

        try:
            # Navegar para página de login
            if not self.browser.get(EGS_LOGIN_URL):
                logger.error("Falha ao carregar página de login")
                return False

            time.sleep(3)  # Aguardar Angular carregar
            self.browser.screenshot('01_login_page.png')

            # Preencher credenciais
            if not self._fill_login_form():
                return False

            # Clicar no botão de login
            if not self._click_login_button():
                return False

            time.sleep(10)  # Aguardar resposta do servidor (aumentado para 10s)

            # Verificar se há conflito de sessão
            if self._check_session_conflict():
                logger.warning("Conflito de sessão detectado. Tentando resolver...")
                if not self._handle_session_conflict():
                    logger.error("Falha ao resolver conflito de sessão")
                    return False

                # Fazer login novamente após resolver conflito
                time.sleep(2)
                if not self._fill_login_form():
                    return False
                if not self._click_login_button():
                    return False
                time.sleep(5)

            # Verificar se login foi bem sucedido
            if not self._verify_login_success():
                return False

            self.logged_in = True
            logger.info("Login realizado com sucesso!")
            self.browser.screenshot('02_login_success.png')
            return True

        except Exception as e:
            logger.error(f"Erro durante login: {e}")
            self.browser.screenshot('login_exception.png')
            return False

    def _fill_login_form(self) -> bool:
        """Preenche o formulário de login"""
        try:
            # Tentar encontrar campos de login (múltiplas estratégias)
            username_field = self._find_element_multiple_strategies([
                (By.NAME, 'username'),
                (By.NAME, 'login'),
                (By.NAME, 'user'),
                (By.ID, 'username'),
                (By.ID, 'login'),
                (By.CSS_SELECTOR, 'input[type="text"][ng-model*="user"]'),
                (By.CSS_SELECTOR, 'input[type="text"]'),
            ])

            password_field = self._find_element_multiple_strategies([
                (By.NAME, 'password'),
                (By.NAME, 'senha'),
                (By.ID, 'password'),
                (By.ID, 'senha'),
                (By.CSS_SELECTOR, 'input[type="password"]'),
            ])

            if not username_field or not password_field:
                logger.error("Campos de login não encontrados")
                self.browser.screenshot('login_fields_not_found.png')
                return False

            # Limpar e preencher usuário
            username_field.clear()
            time.sleep(0.2)
            username_field.send_keys(EGS_USERNAME)
            logger.debug(f"Usuário preenchido: {EGS_USERNAME}")
            time.sleep(0.3)

            # Limpar e preencher senha
            password_field.clear()
            time.sleep(0.2)
            password_field.send_keys(EGS_PASSWORD)
            logger.debug("Senha preenchida")
            time.sleep(0.3)

            # Campo de chave de acesso (pode existir ou não)
            access_key_field = self._find_element_multiple_strategies([
                (By.NAME, 'chaveAcesso'),
                (By.NAME, 'chave'),
                (By.NAME, 'accessKey'),
                (By.ID, 'chaveAcesso'),
                (By.ID, 'chave'),
                (By.CSS_SELECTOR, 'input[ng-model*="chave"]'),
            ])

            if access_key_field and EGS_ACCESS_KEY:
                access_key_field.clear()
                time.sleep(0.2)
                access_key_field.send_keys(EGS_ACCESS_KEY)
                logger.debug(f"Chave de acesso preenchida: {EGS_ACCESS_KEY}")
                time.sleep(0.3)

            return True

        except Exception as e:
            logger.error(f"Erro ao preencher formulário: {e}")
            return False

    def _click_login_button(self) -> bool:
        """Clica no botão de login"""
        try:
            # Primeiro, fechar qualquer popup/modal que esteja interceptando
            self._close_any_overlays()
            time.sleep(0.5)

            login_button = self._find_element_multiple_strategies([
                (By.CSS_SELECTOR, 'button[type="submit"]'),
                (By.CSS_SELECTOR, 'input[type="submit"]'),
                (By.XPATH, '//button[contains(text(), "Entrar")]'),
                (By.XPATH, '//button[contains(text(), "Login")]'),
                (By.XPATH, '//button[contains(text(), "Acessar")]'),
                (By.XPATH, '//input[@value="Entrar"]'),
                (By.CSS_SELECTOR, '.btn-login'),
                (By.CSS_SELECTOR, 'button.btn-primary'),
            ])

            if login_button:
                # Tentar clique via JavaScript (mais confiável quando há overlays)
                try:
                    self.browser.driver.execute_script("arguments[0].click();", login_button)
                    logger.debug("Botão de login clicado via JS")
                    return True
                except:
                    # Fallback para clique normal
                    login_button.click()
                    logger.debug("Botão de login clicado")
                    return True
            else:
                # Tentar submit pelo Enter no campo de senha
                password_field = self.browser.find_element_safe(By.CSS_SELECTOR, 'input[type="password"]')
                if password_field:
                    password_field.send_keys(Keys.RETURN)
                    logger.debug("Login enviado via Enter")
                    return True

            logger.error("Botão de login não encontrado")
            return False

        except Exception as e:
            logger.error(f"Erro ao clicar no botão de login: {e}")
            return False

    def _close_any_overlays(self):
        """Fecha qualquer overlay/popup que esteja na frente"""
        try:
            # Clicar em qualquer área vazia para fechar popups
            body = self.browser.driver.find_element(By.TAG_NAME, 'body')

            # Fechar modais com ESC
            from selenium.webdriver.common.keys import Keys
            body.send_keys(Keys.ESCAPE)
            time.sleep(0.2)

            # Fechar qualquer dropdown aberto
            overlays = self.browser.driver.find_elements(By.CSS_SELECTOR, '.dropdown-menu.show, .modal.show, [class*="overlay"]')
            for overlay in overlays:
                try:
                    close_btn = overlay.find_element(By.CSS_SELECTOR, '.close, .btn-close')
                    if close_btn.is_displayed():
                        close_btn.click()
                except:
                    pass
        except:
            pass

    def _check_session_conflict(self) -> bool:
        """Verifica se há conflito de sessão (outro usuário logado)"""
        try:
            body_text = self.browser.driver.find_element(By.TAG_NAME, 'body').text.lower()

            conflict_indicators = [
                'acessos já estão sendo utilizados',
                'todos os seus acessos',
                'sessão já está em uso',
                'usuário já está logado',
                'limite de usuários',
                'sessão ativa',
            ]

            for indicator in conflict_indicators:
                if indicator in body_text:
                    logger.info(f"Indicador de conflito encontrado: '{indicator}'")
                    return True

            # Verificar se há modal de conflito
            conflict_modal = self._find_element_multiple_strategies([
                (By.CSS_SELECTOR, '.modal.show'),
                (By.CSS_SELECTOR, '.modal[style*="display: block"]'),
                (By.CSS_SELECTOR, '[class*="session-conflict"]'),
                (By.XPATH, '//div[contains(@class, "modal")]//span[contains(text(), "acessos")]'),
            ])

            if conflict_modal:
                return True

            return False

        except Exception as e:
            logger.warning(f"Erro ao verificar conflito de sessão: {e}")
            return False

    def _handle_session_conflict(self) -> bool:
        """
        Trata o conflito de sessão seguindo o fluxo completo:
        1. Clicar em OK no popup "Todos os seus acessos já estão sendo utilizados"
        2. Na tela "Limite de usuários atingido", clicar em Desconectar
        3. Clicar em "Sim" para confirmar desconexão
        4. Clicar em "OK" no popup de sucesso
        5. Clicar em "Sair" para fechar modal
        6. Retornar para fazer login novamente
        """
        logger.info("Tratando conflito de sessão...")
        self.browser.screenshot('03_session_conflict.png')

        try:
            # ========== PASSO 1: Clicar em OK no popup de aviso ==========
            logger.info("Clicando em OK no popup de aviso...")
            time.sleep(1)

            ok_btn = self._wait_and_find_element([
                (By.XPATH, '//button[text()="OK"]'),
                (By.XPATH, '//button[contains(text(), "OK")]'),
                (By.CSS_SELECTOR, 'button.swal2-confirm'),
                (By.CSS_SELECTOR, '.swal2-popup button'),
                (By.CSS_SELECTOR, '.swal2-actions button'),
            ], timeout=10)

            if ok_btn:
                self._safe_click(ok_btn)
                logger.info("Botão OK clicado no popup inicial")
                time.sleep(2)
                self.browser.screenshot('03b_after_ok.png')
            else:
                logger.warning("Botão OK não encontrado no popup inicial")

            # ========== PASSO 2: Selecionar o usuário na tabela ==========
            logger.info("Selecionando usuário na tabela...")
            time.sleep(1)

            # Primeiro, precisamos marcar o checkbox do usuário na tabela
            user_checkbox = self._wait_and_find_element([
                # Checkbox na linha da tabela
                (By.XPATH, '//table//tr//td//input[@type="checkbox"]'),
                (By.CSS_SELECTOR, 'table tbody tr td input[type="checkbox"]'),
                (By.XPATH, '//tr[contains(.,"DESTACK")]//input[@type="checkbox"]'),
                # DevExpress checkbox
                (By.CSS_SELECTOR, '.dx-checkbox'),
                (By.XPATH, '//table//tr//td[1]//div[contains(@class, "checkbox")]'),
            ], timeout=5)

            if user_checkbox:
                self._safe_click(user_checkbox)
                logger.info("Checkbox do usuário selecionado")
                time.sleep(1)
                self.browser.screenshot('03c_user_selected.png')

            # ========== PASSO 3: Clicar em "Desconectar" ==========
            logger.info("Clicando em 'Desconectar'...")
            time.sleep(2)  # Aguardar mais tempo para botão ficar clicável

            # Estratégia: encontrar todos os elementos com texto "Desconectar" e clicar
            disconnect_clicked = False

            # Método 1: Buscar via JavaScript diretamente
            try:
                result = self.browser.driver.execute_script("""
                    // Procurar por botões com texto Desconectar
                    var buttons = document.querySelectorAll('button');
                    for (var i = 0; i < buttons.length; i++) {
                        if (buttons[i].innerText.includes('Desconectar')) {
                            buttons[i].click();
                            return 'clicked_button';
                        }
                    }
                    // Procurar spans com texto Desconectar
                    var spans = document.querySelectorAll('span');
                    for (var i = 0; i < spans.length; i++) {
                        if (spans[i].innerText.includes('Desconectar')) {
                            spans[i].click();
                            return 'clicked_span';
                        }
                    }
                    return 'not_found';
                """)
                if result and result != 'not_found':
                    logger.info(f"Botão 'Desconectar' clicado via JS puro: {result}")
                    disconnect_clicked = True
            except Exception as e:
                logger.warning(f"Erro no clique JS puro: {e}")

            # Método 2: Se JS puro não funcionou, tentar via Selenium
            if not disconnect_clicked:
                disconnect_btn = self._wait_and_find_element([
                    (By.XPATH, '//button[.//span[contains(text(), "Desconectar")]]'),
                    (By.XPATH, '//span[contains(text(), "Desconectar")]'),
                    (By.XPATH, '//button[contains(., "Desconectar")]'),
                    (By.CSS_SELECTOR, 'button.btn-edit'),
                ], timeout=5)

                if disconnect_btn:
                    # Usar ActionChains para clique mais robusto
                    from selenium.webdriver.common.action_chains import ActionChains
                    try:
                        actions = ActionChains(self.browser.driver)
                        actions.move_to_element(disconnect_btn).click().perform()
                        logger.info("Botão 'Desconectar' clicado via ActionChains")
                        disconnect_clicked = True
                    except Exception as e:
                        logger.warning(f"Erro no ActionChains: {e}")
                        self._safe_click(disconnect_btn)
                        disconnect_clicked = True

            if disconnect_clicked:
                time.sleep(3)  # Aguardar popup de confirmação
                self.browser.screenshot('04_after_disconnect_click.png')
            else:
                logger.warning("Botão 'Desconectar' não encontrado ou não clicado")

            # ========== PASSO 4: Clicar em "Sim" para confirmar ==========
            logger.info("Clicando em 'Sim'...")
            time.sleep(1)

            sim_btn = self._wait_and_find_element([
                (By.XPATH, '//button[text()="Sim"]'),
                (By.XPATH, '//button[contains(text(), "Sim")]'),
                (By.CSS_SELECTOR, 'button.swal2-confirm'),
                (By.XPATH, '//button[contains(@class, "swal2-confirm")]'),
            ], timeout=10)

            if sim_btn:
                self._safe_click(sim_btn)
                logger.info("Botão 'Sim' clicado para confirmar desconexão")
                time.sleep(2)
                self.browser.screenshot('04b_after_sim.png')
            else:
                logger.warning("Botão 'Sim' não encontrado")

            # ========== PASSO 5: Clicar em "OK" no popup de sucesso ==========
            logger.info("Clicando em 'OK' (Sucesso)...")
            time.sleep(1)

            ok_success_btn = self._wait_and_find_element([
                (By.XPATH, '//button[text()="OK"]'),
                (By.XPATH, '//button[contains(text(), "OK")]'),
                (By.CSS_SELECTOR, 'button.swal2-confirm'),
                (By.CSS_SELECTOR, '.swal2-actions button'),
            ], timeout=10)

            if ok_success_btn:
                self._safe_click(ok_success_btn)
                logger.info("Clicado em 'OK' (Sucesso)")
                time.sleep(2)
                self.browser.screenshot('04c_after_ok_success.png')
            else:
                logger.warning("Botão OK de sucesso não encontrado")

            # ========== PASSO 6: Fechar modal via botão "Sair"/Close ==========
            logger.info("Fechando modal via botão 'Sair'/Close...")
            time.sleep(1)

            sair_btn = self._wait_and_find_element([
                (By.XPATH, '//button[text()="Sair"]'),
                (By.XPATH, '//button[contains(text(), "Sair")]'),
                (By.XPATH, '//a[text()="Sair"]'),
                (By.CSS_SELECTOR, 'button.close'),
                (By.CSS_SELECTOR, '.modal-header button.close'),
                (By.CSS_SELECTOR, '[data-dismiss="modal"]'),
            ], timeout=10)

            if sair_btn:
                self._safe_click(sair_btn)
                logger.info("Modal fechado via botão 'Sair'/Close")
                time.sleep(2)
            else:
                # Tentar fechar com ESC
                try:
                    from selenium.webdriver.common.keys import Keys
                    body = self.browser.driver.find_element(By.TAG_NAME, 'body')
                    body.send_keys(Keys.ESCAPE)
                    time.sleep(1)
                    logger.info("Modal fechado via ESC")
                except:
                    pass

            self.browser.screenshot('05_conflict_resolved.png')
            logger.info("Conflito de sessão resolvido com sucesso!")
            return True

        except Exception as e:
            logger.error(f"Erro ao tratar conflito de sessão: {e}")
            self.browser.screenshot('session_conflict_error.png')
            return False

    def _wait_and_find_element(self, strategies: List[tuple], timeout: int = 10):
        """
        Aguarda e tenta encontrar um elemento usando múltiplas estratégias.
        Diferente de _find_element_multiple_strategies, este método espera ativamente.
        """
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        end_time = time.time() + timeout

        while time.time() < end_time:
            for by, value in strategies:
                try:
                    element = WebDriverWait(self.browser.driver, 1).until(
                        EC.element_to_be_clickable((by, value))
                    )
                    if element and element.is_displayed():
                        return element
                except:
                    continue
            time.sleep(0.5)

        # Fallback: tentar encontrar sem esperar clicável
        for by, value in strategies:
            element = self.browser.find_element_safe(by, value)
            if element:
                return element

        return None

    def _close_all_modals(self):
        """Fecha todos os modais abertos"""
        try:
            modals = self.browser.driver.find_elements(By.CSS_SELECTOR, '.modal.show, .modal[style*="display: block"]')
            for modal in modals:
                close_btns = modal.find_elements(By.CSS_SELECTOR, '.close, .btn-close, button[data-dismiss="modal"]')
                for btn in close_btns:
                    try:
                        btn.click()
                        time.sleep(0.3)
                    except:
                        pass
        except:
            pass

    def _verify_login_success(self) -> bool:
        """Verifica se o login foi bem sucedido"""
        try:
            current_url = self.browser.driver.current_url
            logger.debug(f"URL atual: {current_url}")
            logger.info(f"Verificando sucesso do login. URL: {current_url}")

            # Se a URL mudou para algo diferente de login, provavelmente funcionou
            if 'login' not in current_url.lower():
                logger.info("Login bem sucedido - URL mudou de /login")
                return True

            # Se ainda está na página de login, verificar se há erro ou se o Angular ainda está carregando
            time.sleep(3)  # Dar mais tempo para o Angular processar

            # Re-verificar a URL
            current_url = self.browser.driver.current_url
            if 'login' not in current_url.lower():
                logger.info("Login bem sucedido após espera adicional")
                return True

            # Verificar mensagens de erro
            error_selectors = [
                '.error', '.alert-danger', '.msg-error', '.text-danger',
                '[class*="error"]', '[class*="invalid"]', '.swal2-popup'
            ]
            for selector in error_selectors:
                error_el = self.browser.find_element_safe(By.CSS_SELECTOR, selector)
                if error_el and error_el.text.strip():
                    error_text = error_el.text.strip()
                    # Ignorar se for mensagem de sucesso ou conflito de sessão
                    if 'sucesso' not in error_text.lower() and 'acessos' not in error_text.lower():
                        logger.error(f"Erro de login: {error_text}")
                        self.browser.screenshot('login_failed.png')
                        return False

            # Verificar elementos que indicam sucesso (dashboard, menu, etc.)
            success_indicators = [
                (By.CSS_SELECTOR, '.box-menu'),
                (By.CSS_SELECTOR, '.menu-dashboard'),
                (By.CSS_SELECTOR, '#menu-container-main'),
                (By.CSS_SELECTOR, '.box-company-name'),
                (By.XPATH, '//div[contains(@class, "box-main")]'),
                (By.CSS_SELECTOR, '.navbar'),
                (By.CSS_SELECTOR, '[ng-controller]'),  # AngularJS controller carregado
                (By.CSS_SELECTOR, '.sidebar'),
                (By.CSS_SELECTOR, '.content-wrapper'),
            ]

            for by, selector in success_indicators:
                element = self.browser.find_element_safe(by, selector)
                if element:
                    logger.info(f"Indicador de sucesso encontrado: {selector}")
                    return True

            logger.error("Login falhou - ainda na pagina de login")
            self.browser.screenshot('login_failed.png')
            return False

        except Exception as e:
            logger.error(f"Erro ao verificar sucesso do login: {e}")
            return False

    def navigate_to_portal_contador_xml(self) -> bool:
        """Navega para o Portal Contador XML"""
        logger.info("Navegando para Portal Contador XML...")

        try:
            # Primeiro, fechar qualquer banner/notificação que possa estar na frente
            self._close_notifications()
            time.sleep(1)

            # Navegar diretamente pela URL (mais confiável que menu)
            logger.info("Navegando diretamente pela URL...")
            if not self.browser.get(self.PORTAL_CONTADOR_XML_URL):
                logger.error("Falha ao navegar para Portal Contador XML")
                return False

            time.sleep(5)  # Aguardar Angular carregar

            # Aguardar página carregar
            self._wait_for_page_load()
            self.browser.screenshot('06_portal_contador_xml.png')

            # Verificar se chegou na página correta
            current_url = self.browser.driver.current_url
            logger.debug(f"URL atual: {current_url}")

            page_title = self._find_element_multiple_strategies([
                (By.XPATH, '//li[contains(., "Portal Contador XML")]'),
                (By.XPATH, '//ol[@class="breadcrumb"]//li[contains(., "Portal")]'),
                (By.XPATH, '//*[contains(text(), "Portal Contador XML")]'),
            ])

            if 'Portal-Contador' in current_url or page_title:
                logger.info("Portal Contador XML carregado com sucesso!")
                return True

            logger.warning(f"URL atual: {current_url} - verificando se página carregou")
            return True  # Continuar mesmo assim

        except Exception as e:
            logger.error(f"Erro ao navegar para Portal Contador XML: {e}")
            return False

    def _close_notifications(self):
        """Fecha notificações e banners que possam estar sobrepondo a tela"""
        try:
            # Fechar banner de comunicados (X no canto)
            close_btns = [
                (By.XPATH, '//div[contains(@class, "alert")]//button[contains(@class, "close")]'),
                (By.XPATH, '//button[contains(text(), "×")]'),
                (By.CSS_SELECTOR, '.modal .close'),
                (By.CSS_SELECTOR, 'button.btn-close'),
                (By.CSS_SELECTOR, '[data-dismiss="alert"]'),
            ]
            for by, selector in close_btns:
                elements = self.browser.driver.find_elements(by, selector)
                for el in elements:
                    try:
                        if el.is_displayed():
                            el.click()
                            logger.debug(f"Fechou notificação: {selector}")
                            time.sleep(0.3)
                    except:
                        pass
        except:
            pass

    def _wait_for_page_load(self, timeout: int = 30):
        """Aguarda a página carregar completamente"""
        try:
            # Aguardar loader sumir
            WebDriverWait(self.browser.driver, timeout).until(
                EC.invisibility_of_element_located((By.CSS_SELECTOR, '.load.jqmOverlay'))
            )
        except:
            pass

        try:
            # Aguardar Angular terminar
            self.browser.driver.execute_script(
                "return (typeof angular !== 'undefined') ? "
                "angular.element(document.body).injector().get('$http').pendingRequests.length === 0 : true"
            )
        except:
            pass

    def _wait_for_devexpress_grid(self, timeout: int = 30) -> bool:
        """
        Aguarda o carregamento completo da grid DevExpress.
        Espera em camadas:
        1. Container da grid aparecer
        2. Spinner de loading sumir
        3. Dados serem carregados (ou mensagem "sem dados")
        """
        logger.info("Aguardando carregamento da grid DevExpress...")

        try:
            # Passo 1: Verificar se há iframe
            iframes = self.browser.driver.find_elements(By.TAG_NAME, "iframe")
            if iframes:
                logger.debug(f"Encontrados {len(iframes)} iframe(s)")
                # Se necessário, trocar para o iframe
                # self.browser.driver.switch_to.frame(0)

            # Passo 2: Aguardar container da grid aparecer
            logger.debug("Aguardando container .dx-datagrid...")
            grid_container = WebDriverWait(self.browser.driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".dx-datagrid"))
            )
            logger.debug("Container .dx-datagrid encontrado")

            # Passo 3: Aguardar loading panel sumir
            try:
                logger.debug("Aguardando loading panel sumir...")
                WebDriverWait(self.browser.driver, 10).until(
                    EC.invisibility_of_element_located((By.CSS_SELECTOR, ".dx-loadpanel-content"))
                )
                logger.debug("Loading panel não está mais visível")
            except TimeoutException:
                logger.debug("Loading panel não encontrado ou já sumiu")

            # Passo 4: Aguardar conteúdo (linhas de dados ou mensagem "sem dados")
            try:
                WebDriverWait(self.browser.driver, timeout).until(
                    lambda d: d.find_elements(By.CSS_SELECTOR, ".dx-datagrid-rowsview .dx-row") or
                              d.find_elements(By.CSS_SELECTOR, ".dx-datagrid-nodata")
                )
            except TimeoutException:
                logger.warning("Timeout aguardando linhas da grid")

            # Passo 5: Log das colunas encontradas (debug)
            self._log_grid_columns()

            logger.info("Grid DevExpress carregada com sucesso")
            return True

        except TimeoutException as e:
            logger.error(f"Timeout aguardando grid DevExpress: {e}")
            self.browser.screenshot('grid_timeout_error.png')
            return False
        except Exception as e:
            logger.error(f"Erro ao aguardar grid DevExpress: {e}")
            self.browser.screenshot('grid_error.png')
            return False

    def _log_grid_columns(self):
        """Log das colunas encontradas na grid (para debug)"""
        try:
            # Método 1: Headers da tabela
            headers = self.browser.driver.find_elements(
                By.CSS_SELECTOR, ".dx-datagrid-headers .dx-header-row td"
            )
            if headers:
                columns = [h.text.strip() for h in headers if h.text.strip()]
                logger.debug(f"Colunas encontradas (headers): {columns}")
                return

            # Método 2: Column chooser (se disponível)
            chooser_items = self.browser.driver.find_elements(
                By.CSS_SELECTOR, ".dx-datagrid-column-chooser .dx-treeview-item-content span"
            )
            if chooser_items:
                columns = [item.text.strip() for item in chooser_items if item.text.strip()]
                logger.debug(f"Colunas encontradas (chooser): {columns}")

        except Exception as e:
            logger.debug(f"Não foi possível obter colunas: {e}")

    def collect_xmls_from_portal(self, start_date: str = None, end_date: str = None) -> List[Dict]:
        """
        Coleta XMLs do Portal Contador XML.

        Args:
            start_date: Data inicial no formato DD/MM/YYYY (opcional)
            end_date: Data final no formato DD/MM/YYYY (opcional)

        Returns:
            Lista de dicts com informações dos XMLs baixados
        """
        logger.info("Coletando XMLs do Portal Contador XML...")
        collected = []

        try:
            # Navegar para o portal
            if not self.navigate_to_portal_contador_xml():
                logger.error("Falha ao navegar para Portal Contador XML")
                return collected

            # Aguardar grid carregar
            if not self._wait_for_devexpress_grid():
                logger.error("Falha ao carregar grid")
                return collected

            # Aplicar filtro de data (se especificado)
            if start_date or end_date:
                self._apply_date_filter_devexpress(start_date, end_date)
                time.sleep(2)
                self._wait_for_devexpress_grid()

            # Verificar se há dados
            no_data = self.browser.find_element_safe(By.CSS_SELECTOR, ".dx-datagrid-nodata")
            if no_data and no_data.is_displayed():
                logger.warning("Grid sem dados. Verifique os filtros aplicados.")
                return collected

            # Selecionar todos os registros
            if not self._select_all_grid_rows():
                logger.warning("Não foi possível selecionar registros")

            # Clicar em Download XML
            downloaded_file = self._click_download_xml()
            if downloaded_file:
                collected.append({
                    'tipo': 'MIXED',  # Portal pode ter CT-e e MDF-e
                    'arquivo': downloaded_file,
                    'timestamp': datetime.now().isoformat()
                })

            logger.info(f"Coleta finalizada. {len(collected)} arquivo(s) baixado(s)")
            return collected

        except Exception as e:
            logger.error(f"Erro ao coletar XMLs: {e}")
            self.browser.screenshot('collect_error.png')
            return collected

    def _apply_date_filter_devexpress(self, start_date: str = None, end_date: str = None):
        """
        Aplica filtro de data na grid DevExpress.
        Busca o input de filtro na coluna Data Emissão.
        """
        logger.info(f"Aplicando filtro de data: {start_date} a {end_date}")

        try:
            # Calcular datas padrão se não especificadas
            if not end_date:
                end_date = datetime.now().strftime('%d/%m/%Y')
            if not start_date:
                start_date = (datetime.now() - timedelta(days=DAYS_LOOKBACK)).strftime('%d/%m/%Y')

            # Método 1: Filtro na própria coluna da grid (DevExpress filter row)
            # Procurar input de filtro na coluna de Data
            filter_input = self._find_element_multiple_strategies([
                # Por aria-label
                (By.XPATH, '//td[contains(@aria-label, "Data")]//input'),
                (By.XPATH, '//td[contains(@aria-label, "Emissão")]//input'),
                # Por classe do DevExpress
                (By.CSS_SELECTOR, '.dx-datagrid-filter-row input[type="text"]'),
                # Por placeholder
                (By.XPATH, '//input[contains(@placeholder, "Data")]'),
            ])

            if filter_input:
                filter_input.click()
                time.sleep(0.3)
                filter_input.clear()
                # Para DevExpress, usar formato de range ou data única
                filter_input.send_keys(start_date)
                filter_input.send_keys(Keys.RETURN)
                logger.debug(f"Filtro de data aplicado: {start_date}")
                time.sleep(1)
                return True

            # Método 2: Usar botão de filtro do sistema EGS
            filter_btn = self._find_element_multiple_strategies([
                (By.ID, 'meus-filtros'),
                (By.CSS_SELECTOR, 'button[ng-click*="Filter"]'),
                (By.XPATH, '//button[contains(., "Filtro")]'),
            ])

            if filter_btn:
                self._safe_click(filter_btn)
                time.sleep(1)
                # Preencher campos de data no modal de filtro
                # ... implementar se necessário
                logger.debug("Usando filtro do sistema EGS")

            # Método 3: Criar filtro via DevExpress (Create Filter)
            create_filter = self.browser.find_element_safe(
                By.CSS_SELECTOR, '.dx-datagrid-filter-panel-text'
            )
            if create_filter:
                self._safe_click(create_filter)
                time.sleep(1)
                # ... implementar lógica de filtro avançado

            return False

        except Exception as e:
            logger.warning(f"Não foi possível aplicar filtro de data: {e}")
            return False

    def _select_all_grid_rows(self) -> bool:
        """Seleciona todos os registros na grid DevExpress"""
        logger.debug("Selecionando todos os registros...")

        try:
            # Método 1: Checkbox "Selecionar Todos" no header
            select_all_checkbox = self._find_element_multiple_strategies([
                (By.CSS_SELECTOR, '.dx-header-row .dx-checkbox'),
                (By.CSS_SELECTOR, '.dx-datagrid-headers .dx-checkbox'),
                (By.XPATH, '//tr[contains(@class, "dx-header-row")]//div[contains(@class, "dx-checkbox")]'),
            ])

            if select_all_checkbox:
                # Verificar se já está marcado
                is_checked = 'dx-checkbox-checked' in select_all_checkbox.get_attribute('class')
                if not is_checked:
                    self._safe_click(select_all_checkbox)
                    time.sleep(0.5)
                    logger.debug("Checkbox 'Selecionar Todos' marcado")
                return True

            # Método 2: Selecionar via JavaScript (DevExpress API)
            try:
                self.browser.driver.execute_script("""
                    var grid = $('#gridContainer').dxDataGrid('instance');
                    if (grid) {
                        grid.selectAll();
                    }
                """)
                logger.debug("Registros selecionados via API DevExpress")
                return True
            except:
                pass

            # Método 3: Clicar em cada checkbox individualmente
            checkboxes = self.browser.driver.find_elements(
                By.CSS_SELECTOR, '.dx-datagrid-rowsview .dx-checkbox:not(.dx-checkbox-checked)'
            )
            for cb in checkboxes[:50]:  # Limitar a 50 para não travar
                try:
                    self._safe_click(cb)
                    time.sleep(0.1)
                except:
                    continue

            if checkboxes:
                logger.debug(f"Selecionados {len(checkboxes)} registros individualmente")
                return True

            return False

        except Exception as e:
            logger.warning(f"Erro ao selecionar registros: {e}")
            return False

    def _click_download_xml(self) -> Optional[str]:
        """Clica no botão Download XML e aguarda o download"""
        logger.info("Clicando em Download XML...")

        try:
            # Limpar pasta de downloads
            self._clear_downloads()

            # Encontrar botão de download
            download_btn = self._find_element_multiple_strategies([
                (By.XPATH, '//button[contains(., "Download XML")]'),
                (By.XPATH, '//egs-button-common[@name="\'Download XML\'"]//button'),
                (By.CSS_SELECTOR, 'egs-button-common[ng-click="download()"] button'),
                (By.CSS_SELECTOR, 'button[data-original-title="Download XML"]'),
                (By.XPATH, '//button[@data-original-title="Download XML"]'),
            ])

            if not download_btn:
                logger.error("Botão Download XML não encontrado")
                self.browser.screenshot('download_btn_not_found.png')
                return None

            self._safe_click(download_btn)
            logger.debug("Botão Download XML clicado")
            time.sleep(2)

            # Aguardar download completar
            downloaded_file = self.browser.wait_for_download('.xml', timeout=60)

            if downloaded_file:
                # Pode ser um ZIP se múltiplos XMLs
                if downloaded_file.endswith('.zip'):
                    downloaded_file = self.browser.wait_for_download('.zip', timeout=60)

                logger.info(f"Download concluído: {os.path.basename(downloaded_file)}")
                self.browser.screenshot('07_download_complete.png')
                return downloaded_file
            else:
                logger.warning("Download não completou no tempo esperado")
                return None

        except Exception as e:
            logger.error(f"Erro ao fazer download: {e}")
            self.browser.screenshot('download_error.png')
            return None

    def collect_cte_xmls(self) -> List[Dict]:
        """
        Coleta XMLs de CT-e do sistema EGS.
        Usa o Portal Contador XML como fonte principal.
        """
        logger.info("Coletando XMLs de CT-e...")
        return self.collect_xmls_from_portal()

    def collect_mdfe_xmls(self) -> List[Dict]:
        """
        Coleta XMLs de MDF-e do sistema EGS.
        Usa o Portal Contador XML como fonte principal.
        """
        logger.info("Coletando XMLs de MDF-e...")
        # Portal Contador XML já retorna CT-e e MDF-e juntos
        # Se precisar separar, implementar navegação específica
        return []

    # ========== Métodos Auxiliares ==========

    def _find_element_multiple_strategies(self, strategies: List[tuple]):
        """
        Tenta encontrar elemento usando múltiplas estratégias.
        Retorna o primeiro elemento encontrado ou None.
        """
        for by, value in strategies:
            element = self.browser.find_element_safe(by, value)
            if element:
                return element
        return None

    def _safe_click(self, element, retries: int = 3, use_js: bool = True):
        """
        Clica em um elemento de forma segura.
        Por padrão usa JavaScript click (mais confiável para modais/popups).
        """
        for attempt in range(retries):
            try:
                # Scroll para o elemento
                self.browser.driver.execute_script(
                    "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});",
                    element
                )
                time.sleep(0.3)

                if use_js:
                    # Usar JavaScript click diretamente (mais confiável para modais)
                    self.browser.driver.execute_script("arguments[0].click();", element)
                    return True
                else:
                    # Tentar click normal
                    element.click()
                    return True

            except ElementClickInterceptedException:
                # Fallback para JavaScript se click normal falhou
                try:
                    self.browser.driver.execute_script("arguments[0].click();", element)
                    return True
                except:
                    time.sleep(0.5)

            except Exception as e:
                if attempt == retries - 1:
                    logger.warning(f"Falha ao clicar após {retries} tentativas: {e}")
                time.sleep(0.5)

        return False

    def _clear_downloads(self):
        """Limpa pasta de downloads"""
        try:
            for f in os.listdir(DOWNLOAD_DIR):
                filepath = os.path.join(DOWNLOAD_DIR, f)
                if os.path.isfile(filepath) and not f.endswith('.png'):
                    os.remove(filepath)
        except Exception as e:
            logger.warning(f"Erro ao limpar downloads: {e}")
