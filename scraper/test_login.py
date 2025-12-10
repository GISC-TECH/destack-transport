#!/usr/bin/env python3
"""
Teste rápido de login no EGS Sistemas
Executa localmente para verificar se o scraper consegue fazer login
"""
import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

# Configurações - Carregar do .env
from dotenv import load_dotenv
load_dotenv()

EGS_LOGIN_URL = os.getenv('EGS_LOGIN_URL', 'https://app.egssistemas.com.br/login')
EGS_USERNAME = os.getenv('EGS_USERNAME', 'DESTACK')
EGS_PASSWORD = os.getenv('EGS_PASSWORD', '1234567')
EGS_ACCESS_KEY = os.getenv('EGS_ACCESS_KEY', '57226')

# Diretorio para screenshots
SCREENSHOT_DIR = os.path.join(os.getcwd(), 'logs')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def create_browser():
    """Cria browser Chrome para teste"""
    options = Options()
    # options.add_argument('--headless=new') # Comentado para ver o browser rodando no teste (opcional)
    options.add_argument('--headless=new') 
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')

    # User agent
    options.add_argument(
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    # Webdriver Manager (Windows/Linux/Mac)
    from webdriver_manager.chrome import ChromeDriverManager
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)

    driver.set_page_load_timeout(60)
    return driver

def test_login():
    """Testa login no EGS"""
    print("=" * 60)
    print("Teste de Login no EGS Sistemas")
    print("=" * 60)

    driver = None
    try:
        print("\n[1/5] Iniciando browser Chrome...")
        driver = create_browser()
        print("     ✓ Browser iniciado com sucesso!")

        print(f"\n[2/5] Navegando para {EGS_LOGIN_URL}...")
        driver.get(EGS_LOGIN_URL)
        time.sleep(5)  # Aguardar Angular carregar
        print(f"     ✓ Página carregada: {driver.title}")

        # Screenshot da página de login
        screenshot_path = os.path.join(SCREENSHOT_DIR, '01_login_page.png')
        driver.save_screenshot(screenshot_path)
        print(f"     Screenshot salvo: {screenshot_path}")

        print("\n[3/5] Procurando campos de login...")

        # Tentar encontrar campos
        username_field = None
        password_field = None
        access_key_field = None

        # Estratégias para encontrar campo de usuário
        for selector in ['input[name="username"]', 'input[name="login"]', 'input[name="user"]',
                         'input#username', 'input#login', 'input[type="text"]']:
            try:
                username_field = driver.find_element(By.CSS_SELECTOR, selector)
                print(f"     ✓ Campo usuário encontrado: {selector}")
                break
            except:
                continue

        # Estratégias para encontrar campo de senha
        for selector in ['input[name="password"]', 'input[name="senha"]',
                         'input#password', 'input#senha', 'input[type="password"]']:
            try:
                password_field = driver.find_element(By.CSS_SELECTOR, selector)
                print(f"     ✓ Campo senha encontrado: {selector}")
                break
            except:
                continue

        # Campo de chave de acesso (opcional) - EGS usa chaveAcesso
        for selector in ['input[name="chaveAcesso"]', 'input[name="chave"]',
                         'input[name="access_key"]', 'input[name="key"]', 'input#chave']:
            try:
                access_key_field = driver.find_element(By.CSS_SELECTOR, selector)
                print(f"     ✓ Campo chave encontrado: {selector}")
                break
            except:
                continue

        if not username_field or not password_field:
            print("     ✗ Campos de login não encontrados!")
            print("\n     Elementos na página:")
            inputs = driver.find_elements(By.TAG_NAME, 'input')
            for inp in inputs[:10]:
                print(f"       - <input name='{inp.get_attribute('name')}' type='{inp.get_attribute('type')}' id='{inp.get_attribute('id')}'>")
            return False

        print("\n[4/5] Preenchendo credenciais...")
        username_field.clear()
        username_field.send_keys(EGS_USERNAME)
        print(f"     ✓ Usuário preenchido: {EGS_USERNAME}")

        password_field.clear()
        password_field.send_keys(EGS_PASSWORD)
        print(f"     ✓ Senha preenchida: {'*' * len(EGS_PASSWORD)}")

        if access_key_field:
            access_key_field.clear()
            access_key_field.send_keys(EGS_ACCESS_KEY)
            print(f"     ✓ Chave de acesso preenchida: {EGS_ACCESS_KEY}")

        # Screenshot antes do submit
        screenshot_path = os.path.join(SCREENSHOT_DIR, '02_before_submit.png')
        driver.save_screenshot(screenshot_path)

        # Tentar encontrar botão de login
        login_btn = None
        for selector in ['button[type="submit"]', 'input[type="submit"]',
                         '//button[contains(text(), "Entrar")]',
                         '//button[contains(text(), "Login")]']:
            try:
                if selector.startswith('//'):
                    login_btn = driver.find_element(By.XPATH, selector)
                else:
                    login_btn = driver.find_element(By.CSS_SELECTOR, selector)
                print(f"     ✓ Botão login encontrado")
                break
            except:
                continue

        print("\n[5/5] Fazendo login...")
        if login_btn:
            login_btn.click()
        else:
            password_field.send_keys(Keys.RETURN)

        time.sleep(8)  # Angular pode demorar para redirecionar

        # Screenshot após login
        screenshot_path = os.path.join(SCREENSHOT_DIR, '03_after_login.png')
        driver.save_screenshot(screenshot_path)
        print(f"     Screenshot salvo: {screenshot_path}")

        current_url = driver.current_url
        print(f"\n     URL após login: {current_url}")
        print(f"     Título: {driver.title}")

        # Verificar se login foi bem sucedido
        if 'login' in current_url.lower() or 'erro' in current_url.lower():
            # Verificar mensagens de erro (múltiplos seletores)
            error_found = False
            for selector in ['.error', '.alert-danger', '.msg-error', '.alert',
                            '.toast-error', '.notification-error', '[class*="error"]',
                            '.text-danger', 'span.error', 'div.alert']:
                try:
                    errors = driver.find_elements(By.CSS_SELECTOR, selector)
                    for error in errors:
                        if error.text.strip():
                            print(f"\n     ✗ ERRO ({selector}): {error.text.strip()}")
                            error_found = True
                except:
                    continue

            if not error_found:
                # Tentar encontrar via ng-show/ng-if (Angular)
                try:
                    # Verificar o body inteiro para textos de erro
                    body_text = driver.find_element(By.TAG_NAME, 'body').text
                    if 'inválid' in body_text.lower() or 'incorrect' in body_text.lower():
                        print(f"\n     ✗ Possível erro de credenciais detectado no texto da página")
                except:
                    pass
                print("\n     ✗ Login parece ter falhado (ainda na página de login)")
            return False
        else:
            print("\n     ✓ LOGIN BEM SUCEDIDO!")
            return True

    except Exception as e:
        print(f"\n     ✗ ERRO: {e}")
        if driver:
            screenshot_path = os.path.join(SCREENSHOT_DIR, 'error.png')
            driver.save_screenshot(screenshot_path)
        return False

    finally:
        if driver:
            driver.quit()
            print("\n[*] Browser fechado")

if __name__ == '__main__':
    success = test_login()
    print("\n" + "=" * 60)
    if success:
        print("RESULTADO: ✓ SUCESSO")
    else:
        print("RESULTADO: ✗ FALHA")
    print("=" * 60)
