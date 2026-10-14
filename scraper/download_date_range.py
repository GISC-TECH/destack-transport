"""
Script para download de XMLs em um range de datas.

Uso:
    python download_date_range.py 01/07/2026 09/07/2026

Se nao passar argumentos, usa o mes atual (dia 01 ate hoje).
"""
import os
import sys
import time
from datetime import datetime, timedelta

from daily_download import download_daily_xmls
from logger_setup import setup_logger

logger = setup_logger('download_date_range')


def parse_date(date_str: str) -> datetime:
    """Parse data no formato DD/MM/YYYY."""
    return datetime.strptime(date_str, '%d/%m/%Y')


def daterange(start_date: datetime, end_date: datetime):
    """Gera datas entre start_date e end_date (inclusive)."""
    for n in range(int((end_date - start_date).days) + 1):
        yield start_date + timedelta(n)


def main():
    if len(sys.argv) >= 3:
        start_date = parse_date(sys.argv[1])
        end_date = parse_date(sys.argv[2])
    else:
        # Padrao: dia 01 do mes atual ate hoje
        today = datetime.now()
        start_date = today.replace(day=1)
        end_date = today

    logger.info("=" * 60)
    logger.info(f"DOWNLOAD DE XMLS POR PERIODO")
    logger.info(f"Inicio: {start_date.strftime('%d/%m/%Y')}")
    logger.info(f"Fim: {end_date.strftime('%d/%m/%Y')}")
    logger.info("=" * 60)

    total_success = 0
    total_failed = 0

    for current_date in daterange(start_date, end_date):
        date_str = current_date.strftime('%d/%m/%Y')
        logger.info("")
        logger.info(f"Processando data: {date_str}")
        logger.info("-" * 40)

        try:
            success = download_daily_xmls(date_str)
            if success:
                total_success += 1
                logger.info(f"Data {date_str}: SUCESSO")
            else:
                total_failed += 1
                logger.error(f"Data {date_str}: FALHA")
        except Exception as e:
            total_failed += 1
            logger.error(f"Erro ao processar {date_str}: {e}")

        # Pequena pausa entre dias para nao sobrecarregar
        time.sleep(2)

    logger.info("")
    logger.info("=" * 60)
    logger.info("PROCESSO DE RANGE FINALIZADO!")
    logger.info(f"Datas processadas com sucesso: {total_success}")
    logger.info(f"Datas com falha: {total_failed}")
    logger.info(f"Total de datas: {total_success + total_failed}")
    logger.info("=" * 60)

    sys.exit(0 if total_failed == 0 else 1)


if __name__ == "__main__":
    main()
