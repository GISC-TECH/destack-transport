"""
Configuracoes do EGS XML Collector
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ===========================================
# EGS SISTEMAS - Credenciais
# ===========================================
EGS_BASE_URL = os.getenv('EGS_BASE_URL', 'https://app.egssistemas.com.br')
EGS_LOGIN_URL = os.getenv('EGS_LOGIN_URL', 'https://app.egssistemas.com.br/login')
EGS_CTE_URL = f"{EGS_BASE_URL}/cte"
EGS_MDFE_URL = f"{EGS_BASE_URL}/mdfe"

EGS_USERNAME = os.getenv('EGS_USERNAME', 'DESTACK')
EGS_PASSWORD = os.getenv('EGS_PASSWORD', '1234567')
EGS_ACCESS_KEY = os.getenv('EGS_ACCESS_KEY', '57226')

# ===========================================
# DESTACK API - Configuracoes
# ===========================================
DESTACK_API_URL = os.getenv('DESTACK_API_URL', 'http://web:8000/api')
DESTACK_USERNAME = os.getenv('DESTACK_USERNAME', 'admin')
DESTACK_PASSWORD = os.getenv('DESTACK_PASSWORD', 'admin123')

# ===========================================
# COLLECTOR - Configuracoes
# ===========================================
# Intervalo de coleta em minutos
COLLECT_INTERVAL_MINUTES = int(os.getenv('COLLECT_INTERVAL_MINUTES', '60'))

# Diretorio para downloads temporarios
DOWNLOAD_DIR = os.getenv('DOWNLOAD_DIR', os.path.join(os.getcwd(), 'downloads'))

# Diretorio para logs
LOG_DIR = os.getenv('LOG_DIR', os.path.join(os.getcwd(), 'logs'))

# Arquivo para controle de XMLs ja processados
PROCESSED_FILE = os.getenv('PROCESSED_FILE', os.path.join(os.getcwd(), 'data', 'processed_xmls.json'))

# Dias para buscar documentos (olhar para tras)
DAYS_LOOKBACK = int(os.getenv('DAYS_LOOKBACK', '7'))

# ===========================================
# SELENIUM - Configuracoes
# ===========================================
SELENIUM_HEADLESS = os.getenv('SELENIUM_HEADLESS', 'false').lower() == 'true'
SELENIUM_TIMEOUT = int(os.getenv('SELENIUM_TIMEOUT', '30'))
# Com Tor/Privoxy o EGS demora mais; 120s era curto em circuitos lentos
PAGE_LOAD_TIMEOUT = int(os.getenv('PAGE_LOAD_TIMEOUT', '180'))

# Proxy do Chrome: SEMPRE HTTP (Privoxy no container tor ou pproxy local).
# Nao usar socks5:// direto no Chrome — causa ERR_TIMED_OUT no container.
CHROME_PROXY_URL = os.getenv('CHROME_PROXY_URL', '')
# Upstream SOCKS do Tor (usado pelo entrypoint/pproxy se necessario)
TOR_SOCKS_URL = os.getenv('TOR_SOCKS_URL', 'socks5://destack_tor:9050')
# HTTP Privoxy exposto pelo container tor
TOR_HTTP_PROXY = os.getenv('TOR_HTTP_PROXY', 'http://destack_tor:8118')

# ===========================================
# LOGGING
# ===========================================
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
