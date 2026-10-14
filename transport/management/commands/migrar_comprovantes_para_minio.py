# transport/management/commands/migrar_comprovantes_para_minio.py
"""
Migra campos 'comprovante' de vários modelos do storage local para o MinIO/S3.

Uso:
    python manage.py migrar_comprovantes_para_minio [--dry-run]

Requer USE_MINIO=true e as variáveis MINIO_* configuradas.
"""

import os
from pathlib import Path

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from storages.backends.s3 import S3Storage

from transport.models import (
    PagamentoAgregado,
    PagamentoProprio,
    ContaPagar,
    DespesaViagem,
    Abastecimento,
    Multa,
    Sinistro,
    Pedagio,
    CTeDocumento,
)


MODELOS = [
    ("PagamentoAgregado", PagamentoAgregado, "comprovante"),
    ("PagamentoProprio", PagamentoProprio, "comprovante"),
    ("ContaPagar", ContaPagar, "comprovante"),
    ("DespesaViagem", DespesaViagem, "comprovante"),
    ("Abastecimento", Abastecimento, "comprovante"),
    ("Multa", Multa, "comprovante"),
    ("Sinistro", Sinistro, "comprovante"),
    ("Pedagio", Pedagio, "comprovante"),
    ("CTeDocumento", CTeDocumento, "comprovante_pagamento"),
]


class Command(BaseCommand):
    help = "Migra campos 'comprovante' de vários modelos para o MinIO/S3."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Lista os arquivos que seriam migrados sem enviar nada.",
        )
        parser.add_argument(
            "--local-root",
            type=str,
            default="/app/media",
            help="Caminho raiz da pasta de mídia local (padrão: /app/media).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        local_root = Path(options["local_root"]).resolve()

        if not isinstance(default_storage, S3Storage):
            self.stdout.write(
                self.style.WARNING(
                    "Storage padrão não é S3. Verifique USE_MINIO=true e as variáveis MINIO_* no .env."
                )
            )
            return

        total_geral = 0
        migrados_geral = 0
        ausentes_geral = 0
        erros_geral = 0
        ignorados_geral = 0

        for nome_modelo, modelo, campo in MODELOS:
            if not hasattr(modelo, campo):
                self.stdout.write(self.style.WARNING(f"{nome_modelo} não tem campo {campo}, pulando."))
                continue

            qs = modelo.objects.exclude(**{campo: ""}).exclude(**{f"{campo}__isnull": True})
            total = qs.count()
            self.stdout.write(f"\n{nome_modelo}.{campo}: {total} registro(s) com arquivo")
            total_geral += total

            for obj in qs.iterator():
                campo_file = getattr(obj, campo)
                caminho = campo_file.name
                if not caminho:
                    ignorados_geral += 1
                    continue

                if caminho.startswith("http://") or caminho.startswith("https://"):
                    self.stdout.write(f"  [IGNORADO] já remoto: {caminho}")
                    ignorados_geral += 1
                    continue

                local_path = local_root / caminho
                if default_storage.exists(caminho):
                    self.stdout.write(f"  [IGNORADO] já existe no storage: {caminho}")
                    ignorados_geral += 1
                    continue
                if not local_path.exists():
                    self.stdout.write(self.style.WARNING(f"  [AUSENTE] {caminho}"))
                    ausentes_geral += 1
                    continue

                if dry_run:
                    self.stdout.write(f"  [DRY-RUN] {caminho}")
                    migrados_geral += 1
                    continue

                try:
                    with open(local_path, "rb") as f:
                        nome_salvo = default_storage.save(caminho, f)
                    if nome_salvo != caminho:
                        default_storage.delete(nome_salvo)
                        raise RuntimeError(
                            f"Storage alterou o nome para '{nome_salvo}'; cópia removida para evitar órfão."
                        )

                    # Garante que o caminho relativo seja mantido no banco
                    campo_file.name = caminho
                    obj.save(update_fields=[campo])

                    self.stdout.write(f"  [OK] {caminho}")
                    migrados_geral += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  [ERRO] {caminho}: {e}"))
                    erros_geral += 1

        self.stdout.write("\n=== RESUMO GERAL ===")
        self.stdout.write(f"Total verificado: {total_geral}")
        self.stdout.write(f"Migrados/dry-run: {migrados_geral}")
        self.stdout.write(f"Ausentes: {ausentes_geral}")
        self.stdout.write(f"Erros: {erros_geral}")
        self.stdout.write(f"Ignorados: {ignorados_geral}")

        if dry_run:
            self.stdout.write(self.style.NOTICE("Execução em dry-run. Nenhum arquivo foi enviado."))
        elif erros_geral:
            raise CommandError(f"Migração terminou com {erros_geral} erro(s).")
