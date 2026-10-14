import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat schedule - backup diario, alertas e pre-aquecimento de cache.
app.conf.beat_schedule = {
    'database-backup-daily': {
        'task': 'transport.tasks.backup_database',
        'schedule': crontab(hour=2, minute=0),
    },
    'alertas-inteligentes-daily': {
        'task': 'transport.tasks.gerar_alertas_inteligentes',
        'schedule': crontab(hour=7, minute=30),
    },
    'warm-dashboard-cache': {
        'task': 'transport.tasks.warm_dashboard_cache',
        'schedule': crontab(minute='*/20'),  # a cada 20 minutos
    },
    'sincronizar-gps': {
        'task': 'transport.tasks.sincronizar_gps',
        'schedule': crontab(minute='*/10'),  # a cada 10 minutos
    },
}


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')