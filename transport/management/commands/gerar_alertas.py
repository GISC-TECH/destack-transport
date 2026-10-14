# transport/management/commands/gerar_alertas.py
"""Command para gerar alertas inteligentes manualmente."""

from django.core.management.base import BaseCommand

from transport.tasks import gerar_alertas_inteligentes


class Command(BaseCommand):
    help = "Gera alertas inteligentes do sistema."

    def handle(self, *args, **options):
        result = gerar_alertas_inteligentes()
        self.stdout.write(
            self.style.SUCCESS(f"Alertas gerados: {result.get('alertas_criados', 0)}")
        )
