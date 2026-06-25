#!/bin/sh
set -e

echo "=== Destack Transport - Iniciando ==="

# Aguardar PostgreSQL ficar disponível
echo "Aguardando PostgreSQL..."
while ! pg_isready -h postgres -U ${POSTGRES_USER:-destack_user} -d ${POSTGRES_DB:-destack_db} 2>/dev/null; do
    echo "PostgreSQL não está pronto - aguardando..."
    sleep 2
done
echo "PostgreSQL está disponível!"

# Aplicar migrações
echo "Aplicando migrações do Django..."
python manage.py migrate --noinput

# Coletar arquivos estáticos
echo "Coletando arquivos estáticos..."
python manage.py collectstatic --noinput

# Criar superusuário apenas quando solicitado explicitamente.
if [ "${DJANGO_CREATE_SUPERUSER:-false}" = "true" ]; then
    echo "Verificando superusuário..."
    python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@destack.local')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

if not password:
    raise SystemExit('DJANGO_SUPERUSER_PASSWORD must be set when DJANGO_CREATE_SUPERUSER=true.')

User = get_user_model()
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print(f"Superusuário {username} criado.")
else:
    print(f"Superusuário {username} já existe.")
PY
else
    echo "Criação automática de superusuário desabilitada."
fi

echo "=== Iniciando aplicação ==="

# Executar comando passado (gunicorn por padrão)
exec "$@"
