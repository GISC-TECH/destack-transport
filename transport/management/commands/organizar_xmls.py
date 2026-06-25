"""
Comando para organizar e arquivar XMLs de CT-e e MDF-e no filesystem.

Gera checksum SHA-256, salva o arquivo em media/xmls/<ano>/<mes>/<tipo>/<chave>.xml
 e atualiza o caminho_arquivo no banco. Pode opcionalmente limpar xml_original.

Uso:
    python manage.py organizar_xmls [--mover] [--dry-run] [--ano YYYY]
"""
import hashlib
import os
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand

from transport.models import CTeDocumento, MDFeDocumento


XML_DIR = "xmls"
TIPO_CTE = "cte"
TIPO_MDFE = "mdfe"


def calcular_checksum(texto):
    """Retorna SHA-256 hexadecimal de uma string."""
    if not texto:
        return None
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def resolver_ano_mes(instance):
    """Retorna (ano, mes) para composicao do caminho do arquivo."""
    data_referencia = getattr(instance, "data_arquivamento", None) or instance.data_upload
    if not data_referencia:
        data_referencia = datetime.now()
    return data_referencia.year, data_referencia.month


def salvar_xml_no_filesystem(instance, tipo):
    """Salva xml_original em disco e retorna o caminho relativo."""
    if not instance.xml_original:
        return None

    ano, mes = resolver_ano_mes(instance)
    nome_arquivo = f"{instance.chave}.xml"
    caminho_relativo = os.path.join(XML_DIR, str(ano), f"{mes:02d}", tipo, nome_arquivo)
    caminho_absoluto = os.path.join(settings.MEDIA_ROOT, caminho_relativo)

    os.makedirs(os.path.dirname(caminho_absoluto), exist_ok=True)

    conteudo = instance.xml_original
    if isinstance(conteudo, bytes):
        conteudo = conteudo.decode("utf-8")

    with open(caminho_absoluto, "w", encoding="utf-8") as arquivo:
        arquivo.write(conteudo)

    return caminho_relativo


class Command(BaseCommand):
    help = "Organiza XMLs de CT-e e MDF-e no filesystem e atualiza metadados no banco."

    def add_arguments(self, parser):
        parser.add_argument(
            "--mover",
            action="store_true",
            help="Limpa o campo xml_original apos salvar o arquivo em disco.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas simula as operacoes sem alterar o banco ou criar arquivos.",
        )
        parser.add_argument(
            "--ano",
            type=int,
            help="Filtra documentos por ano de data_arquivamento.",
        )

    def handle(self, *args, **options):
        mover = options["mover"]
        dry_run = options["dry_run"]
        ano = options["ano"]

        if dry_run:
            self.stdout.write(self.style.WARNING("MODO SIMULACAO (dry-run): nenhuma alteracao sera salva."))

        estatisticas = {
            "cte_processados": 0,
            "cte_ignorados": 0,
            "mdfe_processados": 0,
            "mdfe_ignorados": 0,
            "erros": 0,
        }

        estatisticas.update(self._processar_modelo(CTeDocumento, TIPO_CTE, mover, dry_run, ano))
        estatisticas.update(self._processar_modelo(MDFeDocumento, TIPO_MDFE, mover, dry_run, ano))

        self.stdout.write("Resumo:")
        self.stdout.write(f"  CT-e processados: {estatisticas['cte_processados']}")
        self.stdout.write(f"  CT-e ignorados (sem xml_original): {estatisticas['cte_ignorados']}")
        self.stdout.write(f"  MDF-e processados: {estatisticas['mdfe_processados']}")
        self.stdout.write(f"  MDF-e ignorados (sem xml_original): {estatisticas['mdfe_ignorados']}")
        self.stdout.write(f"  Erros: {estatisticas['erros']}")

    def _processar_modelo(self, model, tipo, mover, dry_run, ano=None):
        prefixo = "cte" if tipo == TIPO_CTE else "mdfe"
        processados = 0
        ignorados = 0
        erros = 0

        queryset = model.objects.all()
        if ano is not None:
            queryset = queryset.filter(data_arquivamento__year=ano)

        for instance in queryset.iterator():
            if not instance.xml_original:
                ignorados += 1
                continue

            try:
                checksum = calcular_checksum(instance.xml_original)
                caminho_relativo = None

                if not dry_run:
                    caminho_relativo = salvar_xml_no_filesystem(instance, tipo)

                self.stdout.write(
                    f"[{tipo.upper()}] {instance.chave} -> {caminho_relativo or '<dry-run>'} (checksum: {checksum})"
                )

                if not dry_run:
                    update_fields = {"checksum": checksum}
                    if caminho_relativo:
                        update_fields["caminho_arquivo"] = caminho_relativo
                    if mover:
                        update_fields["xml_original"] = ""
                    model.objects.filter(pk=instance.pk).update(**update_fields)

                processados += 1
            except Exception as exc:
                erros += 1
                self.stdout.write(self.style.ERROR(f"Erro ao processar {tipo.upper()} {instance.chave}: {exc}"))

        return {
            f"{prefixo}_processados": processados,
            f"{prefixo}_ignorados": ignorados,
            "erros": erros,
        }
