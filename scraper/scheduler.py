"""
Scheduler para download automático de XMLs a cada 6 horas.
Roda em background dentro do container Docker.

Uso:
    python scheduler.py
"""
import os
import sys
import time
import signal
import schedule
from datetime import datetime
from pathlib import Path

from daily_download import download_daily_xmls
from logger_setup import setup_logger

logger = setup_logger('scheduler')

# Flag para controle de parada
running = True
STATE_DIR = Path(os.getenv("SCRAPER_STATE_DIR", "/app/data"))
LAST_SUCCESS_FILE = STATE_DIR / "last_success"
LAST_FAILURE_FILE = STATE_DIR / "last_job_failed"


def signal_handler(signum, frame):
    """Handler para sinais de parada (SIGTERM, SIGINT)"""
    global running
    logger.info(f"Sinal {signum} recebido. Encerrando scheduler...")
    running = False


def record_job_result(success: bool):
    """Persiste o resultado para o healthcheck externo do container."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().isoformat()

    if success:
        temp_file = LAST_SUCCESS_FILE.with_suffix(".tmp")
        temp_file.write_text(timestamp, encoding="utf-8")
        temp_file.replace(LAST_SUCCESS_FILE)
        LAST_FAILURE_FILE.unlink(missing_ok=True)
        return

    LAST_FAILURE_FILE.write_text(timestamp, encoding="utf-8")


def job_download():
    """Job que executa o download de XMLs (1 retentativa apos falha)."""
    logger.info("=" * 60)
    logger.info(f"INICIANDO JOB DE DOWNLOAD - {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    logger.info("=" * 60)

    success = False
    try:
        success = download_daily_xmls()
        if not success:
            logger.warning("Primeira tentativa falhou — retentando em 120s...")
            time.sleep(120)
            success = download_daily_xmls()
    except Exception as e:
        logger.error(f"Erro no job: {e}")
        import traceback
        traceback.print_exc()

    if success:
        logger.info("Job concluído com SUCESSO")
    else:
        logger.error("Job concluído com FALHA (apos retentativa)")

    try:
        record_job_result(success)
    except Exception as e:
        logger.error(f"Não foi possível gravar o estado do job: {e}")

    logger.info("Próxima execução no horário agendado (00/06/12/18)")
    logger.info("")


def main():
    """Função principal do scheduler"""
    global running

    # Registrar handlers de sinal
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    logger.info("=" * 60)
    logger.info("SCHEDULER DE DOWNLOAD DE XMLs")
    logger.info(f"Iniciado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    logger.info("Intervalo: 6 horas")
    logger.info("=" * 60)

    # Configurar horários de execução (a cada 6 horas)
    # 00:00, 06:00, 12:00, 18:00
    schedule.every().day.at("00:00").do(job_download)
    schedule.every().day.at("06:00").do(job_download)
    schedule.every().day.at("12:00").do(job_download)
    schedule.every().day.at("18:00").do(job_download)

    logger.info("Horários agendados: 00:00, 06:00, 12:00, 18:00")

    # Executar uma vez no início (opcional - comente se não quiser)
    run_on_start = os.getenv('RUN_ON_START', 'true').lower() == 'true'
    if run_on_start:
        logger.info("Executando download inicial...")
        job_download()

    # Loop principal
    logger.info("Scheduler rodando. Aguardando próxima execução...")

    while running:
        schedule.run_pending()
        time.sleep(60)  # Verifica a cada 1 minuto

    logger.info("Scheduler encerrado.")


if __name__ == "__main__":
    main()
