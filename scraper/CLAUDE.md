# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EGS XML Collector** is a Selenium-based web scraper that downloads CT-e (Conhecimento de Transporte Eletrônico) and MDF-e (Manifesto de Documentos Fiscais Eletrônicos) XML files from the EGS Sistemas web application (https://app.egssistemas.com.br). It runs as a scheduled background service inside Docker, executing every 6 hours.

## Development Commands

### Local Development (Windows)
```bash
# Activate virtual environment
cd scraper
.\venv\Scripts\activate

# Test login
python test_egs.py --login

# Download XMLs manually
python daily_download.py                    # Download all XMLs
python daily_download.py 05/12/2025         # Download specific date

# Download all XMLs for a year
python -c "from download_xmls import download_all_xmls; download_all_xmls(2025)"

# Run scheduler (continuous - every 6 hours)
python scheduler.py
```

### Docker
```bash
# Build image
docker build -t egs-scraper ./scraper

# Run container
docker run -d --name egs-scraper \
  -v $(pwd)/downloads:/app/downloads \
  -e RUN_ON_START=true \
  egs-scraper

# View logs
docker logs -f egs-scraper
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        scheduler.py                              │
│              (runs every 6h: 00:00, 06:00, 12:00, 18:00)        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     daily_download.py                            │
│                    (orchestrates download)                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│    egs_client.py    │         │   download_xmls.py  │
│  (login, session)   │         │  (CT-e/MDF-e logic) │
└─────────┬───────────┘         └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│    browser.py       │
│ (Selenium Chrome)   │
└─────────────────────┘
```

### Key Components

| File | Purpose |
|------|---------|
| `scheduler.py` | Main entry point for Docker. Runs `daily_download` every 6 hours |
| `daily_download.py` | Downloads all CT-e and MDF-e XMLs |
| `download_xmls.py` | Core download logic with functions for bulk downloads |
| `egs_client.py` | EGS Sistemas client: login, session conflict handling, DevExpress grid interaction |
| `browser.py` | Selenium WebDriver management with Chrome/Edge fallback |
| `config.py` | Environment variables and configuration |

## EGS Sistemas Navigation

The EGS system uses AngularJS with DevExpress DataGrid components:

- **CT-e Export**: Menu FISCAL > CT-E / CT-E OS > EXPORTAÇÃO XML → `/cte-tela-xml`
- **MDF-e Page**: Direct navigation to `/mdfe` (has `ng-click="downloadXml()"` button)

### DevExpress Grid Patterns

```python
# Wait for grid to load
client._wait_for_devexpress_grid(timeout=30)

# Select all records via header checkbox
driver.execute_script("""
    var checkbox = document.querySelector('.dx-header-row .dx-checkbox');
    if (checkbox) checkbox.click();
""")

# Get page info
page_info = driver.find_element(By.CSS_SELECTOR, '.dx-pager .dx-info').text
# Returns: "Página 1 de 27 (524 registros)"
```

### Session Conflict Handling

EGS allows only one active session per user. When another session is active:
1. A modal appears with "acessos já estão sendo utilizados"
2. User must click "OK" → select user in table → click "Desconectar" → "Sim" → "OK"

This is handled automatically by `egs_client._handle_session_conflict()`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EGS_USERNAME` | DESTACK | EGS login username |
| `EGS_PASSWORD` | 1234567 | EGS login password |
| `EGS_ACCESS_KEY` | 57226 | EGS access key |
| `SELENIUM_HEADLESS` | false | Run Chrome headless |
| `RUN_ON_START` | true | Execute download immediately on scheduler start |
| `DOWNLOAD_DIR` | ./downloads | XMLs output directory |
| `TZ` | America/Sao_Paulo | Timezone for scheduler |

## Output Structure

```
downloads/
├── cte_2025/           # All CT-e XMLs
├── mdfe_2025/          # All MDF-e XMLs
└── xmls_DD-MM-YYYY/    # Daily downloads (scheduler)
```

## Common Issues

1. **Session conflict**: Another user is logged in. The scraper auto-handles this by disconnecting the other session.

2. **Element not interactable**: Usually means Chrome windows are overlapping. Kill all Chrome processes and retry:
   ```bash
   taskkill /F /IM chromedriver.exe & taskkill /F /IM chrome.exe
   ```

3. **Grid filter not working**: The EGS system doesn't properly filter by date range. Use `download_all_xmls()` instead of filtered downloads.

4. **Download timeout**: Increase timeout in `wait_for_download_and_extract()`. Default is 180 seconds.
