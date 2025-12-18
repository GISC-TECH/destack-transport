#!/usr/bin/env python3
"""
Script de teste para o EGS Client
Executa o login e coleta de XMLs para validar o funcionamento
"""
import sys
import os

# Adicionar diretório ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from browser import BrowserManager
from egs_client import EGSClient
from config import SELENIUM_HEADLESS, DOWNLOAD_DIR
from logger_setup import setup_logger

logger = setup_logger('test_egs')


def test_login_only():
    """Testa apenas o login no sistema EGS"""
    logger.info("=" * 60)
    logger.info("TESTE: Login no EGS Sistemas")
    logger.info("=" * 60)

    browser = None
    try:
        # Inicializar browser
        browser = BrowserManager()
        browser.start()

        # Criar cliente EGS
        egs = EGSClient(browser)

        # Fazer login
        success = egs.login()

        if success:
            logger.info("LOGIN BEM SUCEDIDO!")
            return True
        else:
            logger.error("LOGIN FALHOU!")
            return False

    except Exception as e:
        logger.error(f"Erro no teste: {e}")
        return False

    finally:
        if browser:
            input("Pressione ENTER para fechar o browser...")
            browser.stop()


def test_navigate_portal():
    """Testa login e navegação para Portal Contador XML"""
    logger.info("=" * 60)
    logger.info("TESTE: Navegação para Portal Contador XML")
    logger.info("=" * 60)

    browser = None
    try:
        # Inicializar browser
        browser = BrowserManager()
        browser.start()

        # Criar cliente EGS
        egs = EGSClient(browser)

        # Fazer login
        if not egs.login():
            logger.error("Login falhou!")
            return False

        # Navegar para Portal
        if not egs.navigate_to_portal_contador_xml():
            logger.error("Navegação para Portal falhou!")
            return False

        # Aguardar grid
        if not egs._wait_for_devexpress_grid():
            logger.error("Grid não carregou!")
            return False

        logger.info("NAVEGAÇÃO BEM SUCEDIDA!")
        return True

    except Exception as e:
        logger.error(f"Erro no teste: {e}")
        return False

    finally:
        if browser:
            input("Pressione ENTER para fechar o browser...")
            browser.stop()


def test_full_collection():
    """Testa o fluxo completo de coleta de XMLs"""
    logger.info("=" * 60)
    logger.info("TESTE: Coleta completa de XMLs")
    logger.info("=" * 60)

    browser = None
    try:
        # Criar diretório de downloads
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)

        # Inicializar browser
        browser = BrowserManager()
        browser.start()

        # Criar cliente EGS
        egs = EGSClient(browser)

        # Fazer login
        if not egs.login():
            logger.error("Login falhou!")
            return False

        # Coletar XMLs
        xmls = egs.collect_xmls_from_portal()

        if xmls:
            logger.info(f"COLETA BEM SUCEDIDA! {len(xmls)} arquivo(s) baixado(s)")
            for xml in xmls:
                logger.info(f"  - {xml.get('arquivo', 'N/A')}")
            return True
        else:
            logger.warning("Nenhum XML coletado (pode estar sem dados)")
            return True  # Não é necessariamente um erro

    except Exception as e:
        logger.error(f"Erro no teste: {e}")
        return False

    finally:
        if browser:
            input("Pressione ENTER para fechar o browser...")
            browser.stop()


def main():
    """Menu principal de testes"""
    print("\n" + "=" * 60)
    print("EGS XML Collector - Script de Teste")
    print("=" * 60)
    print("\nSelecione o teste a executar:")
    print("1. Apenas Login")
    print("2. Login + Navegação para Portal")
    print("3. Coleta Completa de XMLs")
    print("0. Sair")
    print()

    try:
        choice = input("Opção: ").strip()

        if choice == "1":
            test_login_only()
        elif choice == "2":
            test_navigate_portal()
        elif choice == "3":
            test_full_collection()
        elif choice == "0":
            print("Saindo...")
        else:
            print("Opção inválida!")

    except KeyboardInterrupt:
        print("\nInterrompido pelo usuário")


if __name__ == '__main__':
    # Se passou argumento, executar diretamente
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == '--login':
            test_login_only()
        elif arg == '--navigate':
            test_navigate_portal()
        elif arg == '--full':
            test_full_collection()
        else:
            print(f"Argumento desconhecido: {arg}")
            print("Use: --login, --navigate, ou --full")
    else:
        main()
