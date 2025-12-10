# Dockerfile para o EGS XML Collector
FROM python:3.11-slim

# Instalar dependencias do sistema para Selenium/Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    ca-certificates \
    # Dependencias do Chrome
    fonts-liberation \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Instalar Chrome usando a nova forma recomendada (sem apt-key)
RUN wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get update \
    && apt-get install -y /tmp/google-chrome.deb \
    && rm /tmp/google-chrome.deb \
    && rm -rf /var/lib/apt/lists/*

# Instalar ChromeDriver usando Chrome for Testing
RUN CHROME_VERSION=$(google-chrome --version | awk '{print $3}') \
    && CHROME_MAJOR=$(echo $CHROME_VERSION | cut -d'.' -f1) \
    && echo "Chrome version: $CHROME_VERSION (major: $CHROME_MAJOR)" \
    && CHROMEDRIVER_URL="https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chromedriver-linux64.zip" \
    && echo "Trying ChromeDriver URL: $CHROMEDRIVER_URL" \
    && (wget -q "$CHROMEDRIVER_URL" -O /tmp/chromedriver.zip || \
        (LATEST_URL="https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${CHROME_MAJOR}" \
        && LATEST_VERSION=$(wget -q -O - "$LATEST_URL") \
        && echo "Latest version for Chrome $CHROME_MAJOR: $LATEST_VERSION" \
        && wget -q "https://storage.googleapis.com/chrome-for-testing-public/${LATEST_VERSION}/linux64/chromedriver-linux64.zip" -O /tmp/chromedriver.zip)) \
    && unzip -o /tmp/chromedriver.zip -d /tmp/ \
    && mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver \
    && chmod +x /usr/local/bin/chromedriver \
    && rm -rf /tmp/*

# Diretorio de trabalho
WORKDIR /app

# Copiar requirements e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar codigo
COPY . .

# Criar diretorios necessarios
RUN mkdir -p /app/downloads /app/logs /app/data

# Variaveis de ambiente
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99
ENV RUN_ON_START=true
ENV TZ=America/Sao_Paulo

# Comando padrao - scheduler que roda a cada 6 horas
CMD ["python", "scheduler.py"]
