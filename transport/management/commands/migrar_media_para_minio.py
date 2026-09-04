# transport/management/commands/migrar_media_para_minio.py
"""
Migra arquivos de mídia do storage local para o MinIO/S3.

Uso:
    python manage.py migrar_media_para_minio [--dry-run]

Requer USE_MINIO=true e as variáveis MINIO_* configuradas.
"""

import os
from pathlib import Path

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from storages.backends.s3 import S3Storage

from transport.models import DocumentoAnexo


class Command(BaseCommand):
    help = "Migra arquivos de mídia do storage local para o MinIO/S3."

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

        anexos = DocumentoAnexo.objects.exclude(arquivo="").exclude(arquivo__isnull=True)
        total = anexos.count()
        self.stdout.write(f"Total de anexos a verificar: {total}")

        migrados = 0
        ausentes = 0
        erros = 0
        ignorados = 0

        for anexo in anexos.iterator():
            caminho = anexo.arquivo.name
            if not caminho:
                ignorados += 1
                continue

            # Se já estiver no S3 (URL começa com http), pula
            if caminho.startswith("http://") or caminho.startswith("https://"):
                self.stdout.write(f"  [IGNORADO] já remoto: {caminho}")
                ignorados += 1
                continue

            local_path = local_root / caminho
            if default_storage.exists(caminho):
                self.stdout.write(f"  [IGNORADO] já existe no storage: {caminho}")
                ignorados += 1
                continue
            if not local_path.exists():
                self.stdout.write(
                    self.style.WARNING(f"  [AUSENTE] {caminho}")
                )
                ausentes += 1
                continue

            if dry_run:
                self.stdout.write(f"  [DRY-RUN] {caminho}")
                migrados += 1
                continue

            try:
                with open(local_path, "rb") as f:
                    # Salva no storage padrão (S3) mantendo o caminho relativo
                    nome_salvo = default_storage.save(caminho, f)
                if nome_salvo != caminho:
                    default_storage.delete(nome_salvo)
                    raise RuntimeError(
                        f"Storage alterou o nome para '{nome_salvo}'; cópia removida para evitar órfão."
                    )

                # Atualiza o campo para garantir que o caminho relativo seja mantido
                anexo.arquivo.name = caminho
                anexo.save(update_fields=["arquivo"])

                self.stdout.write(f"  [OK] {caminho}")
                migrados += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  [ERRO] {caminho}: {e}"))
                erros += 1

        self.stdout.write("\n=== RESUMO ===")
        self.stdout.write(f"Total: {total}")
        self.stdout.write(f"Migrados/dry-run: {migrados}")
        self.stdout.write(f"Ausentes: {ausentes}")
        self.stdout.write(f"Erros: {erros}")
        self.stdout.write(f"Ignorados: {ignorados}")

        if dry_run:
            self.stdout.write(self.style.NOTICE("Execução em dry-run. Nenhum arquivo foi enviado."))
        elif erros:
            raise CommandError(f"Migração terminou com {erros} erro(s).")
