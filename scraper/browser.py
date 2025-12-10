"""
Modulo de gerenciamento do browser Selenium
"""
import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException

from config import (
    SELENIUM_HEADLESS, SELENIUM_TIMEOUT, PAGE_LOAD_TIMEOUT, DOWNLOAD_DIR
)
from logger_setup import setup_logger

logger = setup_logger('browser')


class BrowserManager:
    """Gerenciador do browser Selenium com Chrome"""

    def __init__(self):
        self.driver = None
        self.wait = None

    def start(self) -> webdriver.Chrome:
        """Inicia o browser Chrome com configuracoes otimizadas"""
        logger.info("Iniciando browser Chrome...")

        options = Options()

        # Modo headless
        if SELENIUM_HEADLESS:
            options.add_argument('--headless=new')
            logger.info("Modo headless ativado")

        # Configuracoes de performance e estabilidade
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-infobars')
        options.add_argument('--disable-notifications')
        options.add_argument('--disable-popup-blocking')
        options.add_argument('--start-maximized')

        # User agent para parecer um browser real
        options.add_argument(
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )

        # Configuracoes de download
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        # Usar caminho absoluto do Windows
        download_path = os.path.abspath(DOWNLOAD_DIR)

        prefs = {
            'download.default_directory': download_path,
            'download.prompt_for_download': False,
            'download.directory_upgrade': True,
            'safebrowsing.enabled': False,
            'plugins.always_open_pdf_externally': True
        }
        options.add_experimental_option('prefs', prefs)

        # Desabilitar logs excessivos
        options.add_experimental_option('excludeSwitches', ['enable-logging'])

        try:
            # Método 1: Tentar Selenium 4.6+ com driver automático
            try:
                logger.info("Tentando iniciar Chrome com driver automático...")
                self.driver = webdriver.Chrome(options=options)
                logger.info("Chrome iniciado com driver automático!")
            except Exception as e1:
                logger.warning(f"Driver automático falhou: {e1}")

                # Método 2: Usar webdriver-manager
                try:
                    logger.info("Tentando com webdriver-manager...")
                    from webdriver_manager.chrome import ChromeDriverManager
                    from webdriver_manager.core.os_manager import ChromeType

                    service = Service(ChromeDriverManager(chrome_type=ChromeType.CHROMIUM).install())
                    self.driver = webdriver.Chrome(service=service, options=options)
                    logger.info("Chrome iniciado com webdriver-manager!")
                except Exception as e2:
                    logger.warning(f"webdriver-manager falhou: {e2}")

                    # Método 3: Tentar Edge como fallback
                    try:
                        logger.info("Tentando Microsoft Edge como fallback...")
                        from selenium.webdriver.edge.options import Options as EdgeOptions
                        from selenium.webdriver.edge.service import Service as EdgeService

                        edge_options = EdgeOptions()
                        if SELENIUM_HEADLESS:
                            edge_options.add_argument('--headless=new')
                        edge_options.add_argument('--no-sandbox')
                        edge_options.add_argument('--disable-dev-shm-usage')
                        edge_options.add_argument('--window-size=1920,1080')
                        edge_options.add_argument('--start-maximized')
                        edge_options.add_experimental_option('prefs', prefs)

                        self.driver = webdriver.Edge(options=edge_options)
                        logger.info("Edge iniciado com sucesso!")
                    except Exception as e3:
                        logger.error(f"Todos os métodos falharam. Último erro: {e3}")
                        raise e1

            self.driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
            self.wait = WebDriverWait(self.driver, SELENIUM_TIMEOUT)

            logger.info("Browser iniciado com sucesso!")
            return self.driver

        except WebDriverException as e:
            logger.error(f"Erro ao iniciar browser: {e}")
            raise

    def stop(self):
        """Para o browser e libera recursos"""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("Browser encerrado")
            except Exception as e:
                logger.warning(f"Erro ao encerrar browser: {e}")
            finally:
                self.driver = None
                self.wait = None

    def get(self, url: str) -> bool:
        """Navega para uma URL"""
        try:
            logger.debug(f"Navegando para: {url}")
            self.driver.get(url)
            return True
        except TimeoutException:
            logger.error(f"Timeout ao carregar: {url}")
            return False
        except Exception as e:
            logger.error(f"Erro ao navegar para {url}: {e}")
            return False

    def wait_for_element(self, by: By, value: str, timeout: int = None):
        """Aguarda um elemento ficar visivel"""
        wait = WebDriverWait(self.driver, timeout or SELENIUM_TIMEOUT)
        try:
            element = wait.until(EC.visibility_of_element_located((by, value)))
            return element
        except TimeoutException:
            logger.warning(f"Timeout aguardando elemento: {by}={value}")
            return None

    def wait_for_clickable(self, by: By, value: str, timeout: int = None):
        """Aguarda um elemento ficar clicavel"""
        wait = WebDriverWait(self.driver, timeout or SELENIUM_TIMEOUT)
        try:
            element = wait.until(EC.element_to_be_clickable((by, value)))
            return element
        except TimeoutException:
            logger.warning(f"Timeout aguardando elemento clicavel: {by}={value}")
            return None

    def find_element_safe(self, by: By, value: str):
        """Encontra elemento de forma segura"""
        try:
            return self.driver.find_element(by, value)
        except Exception:
            return None

    def find_elements_safe(self, by: By, value: str):
        """Encontra elementos de forma segura"""
        try:
            return self.driver.find_elements(by, value)
        except Exception:
            return []

    def screenshot(self, filename: str):
        """Tira screenshot para debug"""
        try:
            path = os.path.join(DOWNLOAD_DIR, filename)
            self.driver.save_screenshot(path)
            logger.debug(f"Screenshot salvo: {path}")
        except Exception as e:
            logger.warning(f"Erro ao salvar screenshot: {e}")

    def wait_for_download(self, filename_pattern: str = None, timeout: int = 30) -> str:
        """Aguarda download completar e retorna o caminho do arquivo"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            files = os.listdir(DOWNLOAD_DIR)
            # Procurar arquivos que nao sejam temporarios (.crdownload)
            completed_files = [
                f for f in files
                if not f.endswith('.crdownload') and not f.endswith('.tmp')
            ]

            if filename_pattern:
                matching = [f for f in completed_files if filename_pattern in f]
                if matching:
                    return os.path.join(DOWNLOAD_DIR, matching[-1])
            elif completed_files:
                # Retorna o arquivo mais recente
                latest = max(
                    completed_files,
                    key=lambda f: os.path.getmtime(os.path.join(DOWNLOAD_DIR, f))
                )
                return os.path.join(DOWNLOAD_DIR, latest)

            time.sleep(0.5)

        return None
