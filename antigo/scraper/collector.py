#!/usr/bin/env python3
"""
EGS XML Collector - Script principal
Coleta XMLs de CT-e e MDF-e do EGS Sistemas e envia para o Destack Transport
"""
import os
import json
import time
import signal
import sys
from datetime import datetime
from typing import Set

import schedule

from config import (
    COLLECT_INTERVAL_MINUTES, PROCESSED_FILE, DOWNLOAD_DIR
)
from logger_setup import setup_logger
from browser import BrowserManager
from egs_client import EGSClient
from destack_client import DestackClient

logger = setup_logger('collector')

# Flag para shutdown graceful
shutdown_requested = False


def signal_handler(signum, frame):
    """Handler para sinais de shutdown"""
    global shutdown_requested
    logger.info(f"Sinal {signum} recebido. Iniciando shutdown graceful...")
    shutdown_requested = True


def load_processed_xmls() -> Set[str]:
    """Carrega lista de XMLs ja processados"""
    try:
        if os.path.exists(PROCESSED_FILE):
            with open(PROCESSED_FILE, 'r') as f:
                data = json.load(f)
                return set(data.get('processed', []))
    except Exception as e:
        logger.warning(f"Erro ao carregar processados: {e}")
    return set()


def save_processed_xmls(processed: Set[str]):
    """Salva lista de XMLs processados"""
    try:
        os.makedirs(os.path.dirname(PROCESSED_FILE), exist_ok=True)
        with open(PROCESSED_FILE, 'w') as f:
            json.dump({
                'processed': list(processed),
                'last_update': datetime.now().isoformat()
            }, f, indent=2)
    except Exception as e:
        logger.error(f"Erro ao salvar processados: {e}")


def cleanup_downloads():
    """Limpa arquivos da pasta de downloads"""
    try:
        if os.path.exists(DOWNLOAD_DIR):
            for f in os.listdir(DOWNLOAD_DIR):
                filepath = os.path.join(DOWNLOAD_DIR, f)
                if os.path.isfile(filepath):
                    os.remove(filepath)
            logger.debug("Pasta de downloads limpa")
    except Exception as e:
        logger.warning(f"Erro ao limpar downloads: {e}")


def collect_and_upload():
    """
    Funcao principal de coleta e upload.
    Executada periodicamente pelo scheduler.
    """
    logger.info("=" * 60)
    logger.info("Iniciando ciclo de coleta...")
    logger.info("=" * 60)

    start_time = datetime.now()
    stats = {
        'cte_collected': 0,
        'mdfe_collected': 0,
        'uploaded': 0,
        'duplicates': 0,
        'errors': 0
    }

    browser = None

    try:
        # Carregar XMLs ja processados
        processed_xmls = load_processed_xmls()
        logger.info(f"XMLs ja processados: {len(processed_xmls)}")

        # Limpar downloads anteriores
        cleanup_downloads()

        # Inicializar cliente Destack
        destack = DestackClient()

        # Verificar se API esta acessivel
        if not destack.check_health():
            logger.error("API Destack nao esta acessivel. Abortando coleta.")
            return stats

        # Autenticar na API
        if not destack.login():
            logger.error("Falha na autenticacao com Destack. Abortando coleta.")
            return stats

        # Inicializar browser
        browser = BrowserManager()
        browser.start()

        # Inicializar cliente EGS
        egs = EGSClient(browser)

        # Fazer login no EGS
        if not egs.login():
            logger.error("Falha no login EGS. Abortando coleta.")
            return stats

        # Coletar CT-es
        logger.info("-" * 40)
        logger.info("Coletando CT-e...")
        cte_xmls = egs.collect_cte_xmls()
        stats['cte_collected'] = len(cte_xmls)

        # Coletar MDF-es
        logger.info("-" * 40)
        logger.info("Coletando MDF-e...")
        mdfe_xmls = egs.collect_mdfe_xmls()
        stats['mdfe_collected'] = len(mdfe_xmls)

        # Combinar todos os XMLs
        all_xmls = cte_xmls + mdfe_xmls
        logger.info(f"Total de XMLs coletados: {len(all_xmls)}")

        # Filtrar XMLs novos (nao processados)
        new_xmls = []
        for xml_info in all_xmls:
            chave = xml_info.get('chave')
            arquivo = xml_info.get('arquivo')

            # Usar chave ou nome do arquivo como identificador
            identifier = chave or os.path.basename(arquivo) if arquivo else None

            if identifier and identifier not in processed_xmls:
                new_xmls.append(xml_info)
            else:
                logger.debug(f"XML ja processado: {identifier}")

        logger.info(f"XMLs novos para enviar: {len(new_xmls)}")

        # Enviar XMLs novos para o Destack
        for xml_info in new_xmls:
            arquivo = xml_info.get('arquivo')
            if not arquivo or not os.path.exists(arquivo):
                continue

            result = destack.upload_xml(arquivo)

            # Marcar como processado
            identifier = xml_info.get('chave') or os.path.basename(arquivo)

            if result.get('success'):
                stats['uploaded'] += 1
                processed_xmls.add(identifier)
            elif result.get('duplicate'):
                stats['duplicates'] += 1
                processed_xmls.add(identifier)  # Marcar duplicado como processado
            else:
                stats['errors'] += 1
                logger.error(f"Erro ao enviar {identifier}: {result.get('error')}")

        # Salvar lista atualizada de processados
        save_processed_xmls(processed_xmls)

    except Exception as e:
        logger.error(f"Erro durante coleta: {e}")
        stats['errors'] += 1

    finally:
        # Fechar browser
        if browser:
            browser.stop()

        # Limpar downloads
        cleanup_downloads()

    # Log de estatisticas
    duration = (datetime.now() - start_time).total_seconds()
    logger.info("=" * 60)
    logger.info("Ciclo de coleta finalizado!")
    logger.info(f"Duracao: {duration:.1f} segundos")
    logger.info(f"CT-e coletados: {stats['cte_collected']}")
    logger.info(f"MDF-e coletados: {stats['mdfe_collected']}")
    logger.info(f"Enviados com sucesso: {stats['uploaded']}")
    logger.info(f"Duplicados ignorados: {stats['duplicates']}")
    logger.info(f"Erros: {stats['errors']}")
    logger.info("=" * 60)

    return stats


def run_scheduler():
    """Executa o scheduler para coletas periodicas"""
    global shutdown_requested

    # Configurar handlers de sinal
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("=" * 60)
    logger.info("EGS XML Collector iniciado!")
    logger.info(f"Intervalo de coleta: {COLLECT_INTERVAL_MINUTES} minutos")
    logger.info("=" * 60)

    # Executar coleta imediatamente ao iniciar
    logger.info("Executando coleta inicial...")
    collect_and_upload()

    # Agendar coletas periodicas
    schedule.every(COLLECT_INTERVAL_MINUTES).minutes.do(collect_and_upload)

    # Loop principal
    while not shutdown_requested:
        schedule.run_pending()
        time.sleep(10)  # Verificar a cada 10 segundos

    logger.info("Collector encerrado.")


def run_once():
    """Executa uma unica coleta (para testes)"""
    logger.info("Modo de execucao unica")
    collect_and_upload()


if __name__ == '__main__':
    # Verificar argumentos
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        run_once()
    else:
        run_scheduler()
