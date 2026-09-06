# Backend Django - Dockerfile
FROM python:3.11-slim@sha256:9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=core.settings

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libpq5 \
    gcc \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Verify Django installation
RUN python -c "import django; print(f'Django version: {django.get_version()}')"

# Copy project files
COPY . .

# Create an unprivileged runtime user and writable application directories.
RUN groupadd --gid 10001 destack \
    && useradd --uid 10001 --gid destack --create-home --shell /usr/sbin/nologin destack \
    && mkdir -p /app/staticfiles /app/media /app/logs /app/backups \
    && chown -R destack:destack /app

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Preserve writable ownership without marking every source file executable.
RUN chmod -R u=rwX,go=rX /app

USER destack

# Expose port
EXPOSE 8000

# Health check - uses public health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

# Entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Run the application
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60", "core.wsgi:application"]
