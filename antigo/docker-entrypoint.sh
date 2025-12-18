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

# Criar superusuário se não existir
echo "Verificando superusuário..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@destack.local', 'admin123')
    print('Superusuário admin criado!')
else:
    print('Superusuário admin já existe')
"

echo "=== Iniciando aplicação ==="

# Executar comando passado (gunicorn por padrão)
exec "$@"
