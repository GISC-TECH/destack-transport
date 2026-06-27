"""
Comando para recalcular distâncias (dist_km) dos CT-es via OSRM + Nominatim.

Uso:
    python manage.py recalcular_distancias_cte
    python manage.py recalcular_distancias_cte --somente-null
    python manage.py recalcular_distancias_cte --limit 100
"""
import logging

from django.core.management.base import BaseCommand
from django.db.models import Q

from transport.models import CTeDocumento
from transport.services.distancia_service import calcular_distancia_cidade_uf

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Recalcula dist_km dos CT-es usando OSRM + Nominatim (OpenStreetMap)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--somente-null",
            action="store_true",
            help="Processa apenas CT-es com dist_km nulo.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limita quantidade de CT-es a processar.",
        )
        parser.add_argument(
            "--somente-validos",
            action="store_true",
            help="Processa apenas CT-es processados e autorizados.",
        )

    def handle(self, *args, **options):
        somente_null = options["somente_null"]
        limit = options["limit"]
        somente_validos = options["somente_validos"]

        filtro = Q(processado=True)
        if somente_validos:
            filtro &= Q(protocolo__codigo_status=100) & ~Q(cancelamento__c_stat=135)
        if somente_null:
            filtro &= Q(identificacao__dist_km__isnull=True)

        qs = CTeDocumento.objects.filter(filtro).select_related("identificacao")
        if limit:
            qs = qs[:limit]

        total = qs.count()
        self.stdout.write(self.style.NOTICE(f"CT-es a processar: {total}"))

        atualizados = 0
        ignorados = 0
        erros = 0

        for idx, cte in enumerate(qs.iterator(), start=1):
            ident = getattr(cte, "identificacao", None)
            if not ident:
                ignorados += 1
                continue

            if not ident.nome_mun_ini or not ident.nome_mun_fim:
                ignorados += 1
                continue

            distancia = calcular_distancia_cidade_uf(
                cidade_origem=ident.nome_mun_ini,
                uf_origem=ident.uf_ini,
                cidade_destino=ident.nome_mun_fim,
                uf_destino=ident.uf_fim,
            )

            if distancia:
                ident.dist_km = distancia
                ident.save(update_fields=["dist_km"])
                atualizados += 1
                self.stdout.write(
                    f"[{idx}/{total}] CT-e {cte.chave}: {distancia} km"
                )
            else:
                ignorados += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"[{idx}/{total}] CT-e {cte.chave}: distância não calculada"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nResumo: {atualizados} atualizados, {ignorados} ignorados, {erros} erros."
            )
        )
