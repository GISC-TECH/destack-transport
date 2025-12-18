"""
Configuracao de logging para o EGS XML Collector
"""
import logging
import os
from datetime import datetime
import colorlog

from config import LOG_DIR, LOG_LEVEL


def setup_logger(name: str = 'egs_collector') -> logging.Logger:
    """
    Configura e retorna um logger com formatacao colorida no console
    e arquivo de log diario.
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))

    # Evitar duplicacao de handlers
    if logger.handlers:
        return logger

    # Formato para console (colorido)
    console_formatter = colorlog.ColoredFormatter(
        '%(log_color)s%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        log_colors={
            'DEBUG': 'cyan',
            'INFO': 'green',
            'WARNING': 'yellow',
            'ERROR': 'red',
            'CRITICAL': 'red,bg_white',
        }
    )

    # Handler para console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # Criar diretorio de logs se nao existir
    os.makedirs(LOG_DIR, exist_ok=True)

    # Handler para arquivo
    log_filename = os.path.join(
        LOG_DIR,
        f'collector_{datetime.now().strftime("%Y%m%d")}.log'
    )
    file_formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler = logging.FileHandler(log_filename, encoding='utf-8')
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    return logger
