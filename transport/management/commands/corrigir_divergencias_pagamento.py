"""
Comando para corrigir divergencias entre CTeDocumento.pago,
PagamentoAgregado.status e PagamentoProprio.status.

Uso:
    python manage.py corrigir_divergencias_pagamento [--dry-run]
"""
from django.core.management.base import BaseCommand
from django.db.models import Q

from transport.models import CTeDocumento, PagamentoAgregado, PagamentoProprio
from transport.services.pagamento_service import atualizar_status_pagamento_cte


class Command(BaseCommand):
    help = "Corrige divergencias de status de pagamento entre CT-e e pagamentos vinculados."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Apenas simula as correcoes sem salvar no banco.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('MODO SIMULACAO (dry-run): nenhuma alteracao sera salva.'))

        corrigidos = {
            'pagamento_agregado_pago_cte_nao_pago': 0,
            'pagamento_proprio_pago_cte_nao_pago': 0,
            'cte_pago_pagamento_pendente': 0,
            'cte_cancelado_marcado_pago': 0,
        }

        # 1. Pagamentos agregados pagos com CT-e nao marcado pago
        pagamentos_agregados = PagamentoAgregado.objects.filter(
            status='pago',
            cte__pago=False,
        ).select_related('cte')

        for pagamento in pagamentos_agregados:
            self.stdout.write(
                f"[AGREGADO PAGO -> CTE NAO PAGO] CT-e {pagamento.cte.chave}"
            )
            if not dry_run:
                atualizar_status_pagamento_cte(
                    pagamento.cte,
                    pago=True,
                    data_pagamento=pagamento.data_pagamento,
                    atualizar_pagamentos=False,
                )
            corrigidos['pagamento_agregado_pago_cte_nao_pago'] += 1

        # 2. Pagamentos proprios pagos com CT-e nao marcado pago
        pagamentos_proprios = PagamentoProprio.objects.filter(
            status='pago',
            cte__pago=False,
        ).select_related('cte')

        for pagamento in pagamentos_proprios:
            self.stdout.write(
                f"[PROPRIO PAGO -> CTE NAO PAGO] CT-e {pagamento.cte.chave}"
            )
            if not dry_run:
                atualizar_status_pagamento_cte(
                    pagamento.cte,
                    pago=True,
                    data_pagamento=pagamento.data_pagamento,
                    atualizar_pagamentos=False,
                )
            corrigidos['pagamento_proprio_pago_cte_nao_pago'] += 1

        # 3. CT-es marcados pagos com pagamento pendente
        ctes_pagos_agregado_pendente = CTeDocumento.objects.filter(
            pago=True,
            pagamento_agregado__status='pendente',
        )
        ctes_pagos_proprio_pendente = CTeDocumento.objects.filter(
            pago=True,
            pagamento_proprio__status='pendente',
        )

        ctes_para_corrigir = set(
            list(ctes_pagos_agregado_pendente.values_list('id', flat=True)) +
            list(ctes_pagos_proprio_pendente.values_list('id', flat=True))
        )

        for cte in CTeDocumento.objects.filter(id__in=ctes_para_corrigir):
            self.stdout.write(
                f"[CTE PAGO -> PAGAMENTO PENDENTE] CT-e {cte.chave}"
            )
            if not dry_run:
                atualizar_status_pagamento_cte(
                    cte,
                    pago=True,
                    data_pagamento=cte.data_pagamento,
                )
            corrigidos['cte_pago_pagamento_pendente'] += 1

        # 4. CT-es cancelados marcados como pagos
        ctes_cancelados_pagos = CTeDocumento.objects.filter(
            pago=True,
            cancelamento__c_stat=135,
        )

        for cte in ctes_cancelados_pagos:
            self.stdout.write(
                f"[CTE CANCELADO -> MARCADO PAGO] CT-e {cte.chave}"
            )
            if not dry_run:
                atualizar_status_pagamento_cte(
                    cte,
                    pago=False,
                )
            corrigidos['cte_cancelado_marcado_pago'] += 1

        # Resumo
        total = sum(corrigidos.values())
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("Resumo das correcoes:"))
        self.stdout.write(f"  - Pagamentos agregados pagos -> CT-e nao pago: {corrigidos['pagamento_agregado_pago_cte_nao_pago']}")
        self.stdout.write(f"  - Pagamentos proprios pagos -> CT-e nao pago: {corrigidos['pagamento_proprio_pago_cte_nao_pago']}")
        self.stdout.write(f"  - CT-e pago -> pagamento pendente: {corrigidos['cte_pago_pagamento_pendente']}")
        self.stdout.write(f"  - Total de CT-es afetados: {total}")

        if dry_run:
            self.stdout.write(self.style.WARNING('Modo simulacao: nenhuma alteracao foi salva.'))
        else:
            if total > 0:
                self.stdout.write(self.style.SUCCESS('Correcoes aplicadas com sucesso.'))
            else:
                self.stdout.write(self.style.SUCCESS('Nenhuma divergencia encontrada.'))
