"""
Comando para executar backup do banco de dados imediatamente.

Uso:
    python manage.py backup_now
"""
from django.core.management.base import BaseCommand

from transport.tasks import backup_database


class Command(BaseCommand):
    help = "Executa backup do banco de dados imediatamente."

    def handle(self, *args, **options):
        self.stdout.write("Iniciando backup do banco de dados...")

        try:
            result = backup_database()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Backup concluido com sucesso: {result.get('path')}"
                )
            )
            if result.get("removed"):
                self.stdout.write(
                    f"Backups antigos removidos: {result['removed']}"
                )
        except Exception as exc:
            self.stdout.write(
                self.style.ERROR(f"Falha ao executar backup: {exc}")
            )
            raise
