@echo off
REM Script para executar download diario de XMLs
REM Pode ser agendado no Task Scheduler do Windows

cd /d D:\WORKSPACE\DESTACK\destack\scraper
call venv\Scripts\activate
python daily_download.py

REM Registrar execucao
echo %date% %time% - Download executado >> logs\scheduler.log
