"""
Modulo de gerenciamento do browser Selenium
"""
import os
import re
import subprocess
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

# Paginas de erro do Chrome (proxy/timeout) — nao sao login do EGS
CHROME_NET_ERROR_MARKERS = (
    'ERR_TIMED_OUT',
    'ERR_PROXY_CONNECTION_FAILED',
    'ERR_CONNECTION_TIMED_OUT',
    'ERR_CONNECTION_RESET',
    'ERR_NAME_NOT_RESOLVED',
    'ERR_TUNNEL_CONNECTION_FAILED',
    "This site can't be reached",
    'This site can’t be reached',
    'took too long to respond',
    'Checking the proxy and the firewall',
)


def normalize_chrome_proxy(proxy_url):
    """
    Chrome no container nao usa bem SOCKS5 cru (ERR_TIMED_OUT).
    Prefere HTTP via Privoxy do Tor (destack_tor:8118) ou pproxy local.
    """
    if not proxy_url:
        return None

    raw = proxy_url.strip()
    if re.match(r'^socks5?://', raw, re.I):
        # Preferencias: env explicito, privoxy do container tor, pproxy local
        candidates = [
            os.getenv('CHROME_HTTP_PROXY'),
            os.getenv('TOR_HTTP_PROXY'),
            'http://destack_tor:8118',
            'http://127.0.0.1:8118',
        ]
        for candidate in candidates:
            if candidate and _proxy_reachable(candidate):
                logger.warning(
                    "CHROME_PROXY_URL=%s e SOCKS; Chrome usa HTTP proxy: %s",
                    raw, candidate,
                )
                return candidate
        logger.error(
            "CHROME_PROXY_URL e SOCKS (%s) e nenhum proxy HTTP (Privoxy/pproxy) respondeu. "
            "Use CHROME_PROXY_URL=http://destack_tor:8118",
            raw,
        )
        # Ultimo recurso: tenta socks5h (DNS remoto) — ainda instavel no Chrome
        return raw.replace('socks5://', 'socks5h://', 1) if raw.startswith('socks5://') else raw

    return raw


def _proxy_reachable(proxy_url: str, timeout: int = 8) -> bool:
    """Testa se o proxy HTTP responde (via curl)."""
    try:
        result = subprocess.run(
            [
                'curl', '-s', '--max-time', str(timeout),
                '--proxy', proxy_url,
                'https://api.ipify.org',
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 2,
        )
        ok = result.returncode == 0 and bool(result.stdout.strip())
        if ok:
            logger.info("Proxy OK %s -> IP %s", proxy_url, result.stdout.strip())
        return ok
    except Exception as e:
        logger.debug("Proxy check falhou %s: %s", proxy_url, e)
        return False


class BrowserManager:
    """Gerenciador do browser Selenium com Chrome"""

    def __init__(self):
        self.driver = None
        self.wait = None
        self.proxy_url = None

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
        options.add_argument('--ignore-certificate-errors')

        # User agent para parecer um browser real
        options.add_argument(
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )

        # Proxy: sempre normalizar SOCKS -> HTTP (Privoxy/pproxy)
        proxy_url = normalize_chrome_proxy(os.getenv('CHROME_PROXY_URL'))
        self.proxy_url = proxy_url
        if proxy_url:
            logger.info(f"Configurando proxy: {proxy_url}")
            options.add_argument(f'--proxy-server={proxy_url}')
            # Chrome 150+ e SOCKS5 no container sao problematicos;
            # desabilita QUIC e forca caminho via proxy HTTP.
            options.add_argument('--disable-quic')
            options.add_argument('--disable-features=NetworkService,NetworkServiceInProcess')
            options.add_argument('--dns-over-https-mode=off')
            options.add_argument('--proxy-bypass-list=<-loopback>')

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
        """Para o browser e encerra processos Chrome remanescentes."""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("Browser encerrado")
            except Exception as e:
                logger.warning(f"Erro ao encerrar browser: {e}")
            finally:
                self.driver = None
                self.wait = None
        # Encerra processos ainda vivos; docker-init recolhe os estados defunct.
        try:
            subprocess.run(
                ['pkill', '-9', '-f', 'chrome|chromedriver|chromium'],
                capture_output=True,
                timeout=5,
            )
        except Exception:
            pass

    def get(self, url: str) -> bool:
        """Navega para uma URL e rejeita paginas de erro de rede do Chrome."""
        try:
            logger.info(f"Navegando para: {url}")
            self.driver.get(url)
            if self.is_chrome_network_error():
                logger.error(
                    "Chrome nao alcancou %s (proxy/timeout). url=%s title=%s",
                    url,
                    self.driver.current_url,
                    (self.driver.title or '')[:80],
                )
                self.screenshot('chrome_network_error.png')
                return False
            return True
        except TimeoutException:
            logger.error(f"Timeout ao carregar: {url}")
            # Mesmo com timeout, pode haver pagina de erro util
            try:
                if self.is_chrome_network_error():
                    self.screenshot('chrome_network_error.png')
            except Exception:
                pass
            return False
        except Exception as e:
            logger.error(f"Erro ao navegar para {url}: {e}")
            return False

    def is_chrome_network_error(self) -> bool:
        """True se a aba atual for pagina de erro de rede do Chrome."""
        if not self.driver:
            return False
        try:
            body = ''
            try:
                body = self.driver.find_element(By.TAG_NAME, 'body').text or ''
            except Exception:
                body = self.driver.page_source or ''
            page = f"{self.driver.title or ''}\n{body}\n{self.driver.current_url or ''}"
            return any(marker in page for marker in CHROME_NET_ERROR_MARKERS)
        except Exception:
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
