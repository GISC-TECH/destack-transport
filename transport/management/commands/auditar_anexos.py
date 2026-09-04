"""
Comando de gerenciamento para auditar a integridade dos DocumentoAnexo.

Identifica registros cujo arquivo físico está ausente no storage,
permitindo limpar ou recuperar anexos corrompidos durante instabilidades.
"""

from django.core.management.base import BaseCommand
from transport.models import DocumentoAnexo


class Command(BaseCommand):
    help = 'Audita anexos e lista registros sem arquivo físico no storage.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--delete',
            action='store_true',
            help='Remove do banco os registros cujo arquivo físico está ausente.'
        )

    def handle(self, *args, **options):
        documentos = DocumentoAnexo.objects.all().order_by('-criado_em')
        total = documentos.count()
        ok = 0
        sem_arquivo_no_banco = 0
        orfaos = []

        for doc in documentos:
            if not doc.arquivo:
                sem_arquivo_no_banco += 1
                continue
            if doc.arquivo.storage.exists(doc.arquivo.name):
                ok += 1
            else:
                orfaos.append(doc)

        self.stdout.write(self.style.NOTICE(f'Total de documentos: {total}'))
        self.stdout.write(self.style.SUCCESS(f'Arquivos físicos OK: {ok}'))
        self.stdout.write(self.style.WARNING(f'Sem campo arquivo no banco: {sem_arquivo_no_banco}'))
        self.stdout.write(self.style.ERROR(f'Arquivos físicos ausentes (órfãos): {len(orfaos)}'))

        if orfaos:
            self.stdout.write('\nRegistros órfãos:')
            for doc in orfaos:
                entidade = (
                    doc.cliente or doc.motorista or doc.veiculo or doc.cte or 'N/A'
                )
                self.stdout.write(
                    f'  - id={doc.id} tipo={doc.tipo} nome={doc.nome} '
                    f'entidade={entidade} criado_em={doc.criado_em} '
                    f'caminho={doc.arquivo.name}'
                )

        if options['delete'] and orfaos:
            count = len(orfaos)
            for doc in orfaos:
                doc.delete()
            self.stdout.write(self.style.SUCCESS(f'\n{count} registros órfãos removidos.'))
