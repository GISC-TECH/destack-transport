#!/usr/bin/env python3
"""
Script de teste automatizado para o EGS Client
Executa sem interação do usuário
"""
import sys
import os
import time

# Adicionar diretório ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from browser import BrowserManager
from egs_client import EGSClient
from config import DOWNLOAD_DIR
from logger_setup import setup_logger

logger = setup_logger('run_test')


def run_test():
    """Executa teste completo automatizado"""
    logger.info("=" * 60)
    logger.info("TESTE AUTOMATIZADO: EGS XML Collector")
    logger.info("=" * 60)

    browser = None
    try:
        # Criar diretório de downloads
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)

        # Inicializar browser
        logger.info("Iniciando browser...")
        browser = BrowserManager()
        browser.start()

        # Criar cliente EGS
        egs = EGSClient(browser)

        # Passo 1: Login
        logger.info("-" * 40)
        logger.info("PASSO 1: Realizando login...")
        logger.info("-" * 40)

        if not egs.login():
            logger.error("FALHA NO LOGIN!")
            return False

        logger.info("LOGIN OK!")

        # Aguardar um pouco para visualizar
        time.sleep(3)

        # Passo 2: Navegar para Portal
        logger.info("-" * 40)
        logger.info("PASSO 2: Navegando para Portal Contador XML...")
        logger.info("-" * 40)

        if not egs.navigate_to_portal_contador_xml():
            logger.error("FALHA NA NAVEGAÇÃO!")
            return False

        logger.info("NAVEGAÇÃO OK!")

        # Aguardar para visualizar
        time.sleep(3)

        # Passo 3: Aguardar Grid
        logger.info("-" * 40)
        logger.info("PASSO 3: Aguardando grid DevExpress...")
        logger.info("-" * 40)

        if not egs._wait_for_devexpress_grid():
            logger.error("GRID NÃO CARREGOU!")
            return False

        logger.info("GRID CARREGADA!")

        # Aguardar para visualizar
        time.sleep(5)

        # Passo 4: Tentar selecionar registros
        logger.info("-" * 40)
        logger.info("PASSO 4: Selecionando registros...")
        logger.info("-" * 40)

        egs._select_all_grid_rows()

        time.sleep(3)

        # Resultado final
        logger.info("=" * 60)
        logger.info("TESTE CONCLUÍDO COM SUCESSO!")
        logger.info("=" * 60)

        # Manter browser aberto por 10 segundos para visualização
        logger.info("Browser ficará aberto por 10 segundos...")
        time.sleep(10)

        return True

    except Exception as e:
        logger.error(f"Erro no teste: {e}")
        import traceback
        traceback.print_exc()

        # Manter aberto para debug
        if browser:
            time.sleep(5)
        return False

    finally:
        if browser:
            logger.info("Fechando browser...")
            browser.stop()


if __name__ == '__main__':
    success = run_test()
    sys.exit(0 if success else 1)
