# transport/management/commands/limpar_arquivos_ausentes.py
"""
Audita e remove registros de mídia cujos arquivos físicos estão ausentes no storage.

Uso:
    python manage.py limpar_arquivos_ausentes --dry-run   # apenas lista
    python manage.py limpar_arquivos_ausentes             # executa limpeza

Ações:
    - DocumentoAnexo: deleta o registro (o documento é o arquivo).
    - PagamentoAgregado/Proprio: limpa o campo comprovante (mantém o pagamento).
"""

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from transport.models import DocumentoAnexo, PagamentoAgregado, PagamentoProprio


class Command(BaseCommand):
    help = "Remove registros de mídia cujos arquivos físicos estão ausentes no storage."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Lista os registros ausentes sem remover.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # Documentos anexos
        docs_ausentes = []
        for doc in DocumentoAnexo.objects.iterator():
            if doc.arquivo and not default_storage.exists(doc.arquivo.name):
                docs_ausentes.append(doc)

        # Comprovantes agregados
        comp_agg_ausentes = []
        for pag in PagamentoAgregado.objects.exclude(comprovante="").exclude(comprovante__isnull=True).iterator():
            try:
                if not default_storage.exists(pag.comprovante.name):
                    comp_agg_ausentes.append(pag)
            except Exception:
                comp_agg_ausentes.append(pag)

        # Comprovantes próprios
        comp_prop_ausentes = []
        for pag in PagamentoProprio.objects.exclude(comprovante="").exclude(comprovante__isnull=True).iterator():
            try:
                if not default_storage.exists(pag.comprovante.name):
                    comp_prop_ausentes.append(pag)
            except Exception:
                comp_prop_ausentes.append(pag)

        self.stdout.write(self.style.NOTICE("=== AUDITORIA DE ARQUIVOS AUSENTES ==="))
        self.stdout.write(f"Documentos anexos ausentes: {len(docs_ausentes)}")
        self.stdout.write(f"Comprovantes agregados ausentes: {len(comp_agg_ausentes)}")
        self.stdout.write(f"Comprovantes próprios ausentes: {len(comp_prop_ausentes)}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Modo dry-run: nenhuma alteração realizada."))
            return

        if not any([docs_ausentes, comp_agg_ausentes, comp_prop_ausentes]):
            self.stdout.write(self.style.SUCCESS("Nenhum arquivo ausente encontrado."))
            return

        # Executa limpeza
        for doc in docs_ausentes:
            self.stdout.write(f"Removendo DocumentoAnexo {doc.id} ({doc.nome})")
            doc.delete()

        for pag in comp_agg_ausentes:
            self.stdout.write(f"Limpando comprovante do PagamentoAgregado {pag.id}")
            PagamentoAgregado.objects.filter(pk=pag.pk).update(comprovante=None)

        for pag in comp_prop_ausentes:
            self.stdout.write(f"Limpando comprovante do PagamentoProprio {pag.id}")
            PagamentoProprio.objects.filter(pk=pag.pk).update(comprovante=None)

        self.stdout.write(self.style.SUCCESS("Limpeza concluída."))
