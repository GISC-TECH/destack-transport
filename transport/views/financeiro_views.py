# transport/views/financeiro_views.py
"""Views para contas a receber (Faturas) e dashboards financeiros."""

import csv
from datetime import date, datetime, timedelta
from decimal import Decimal
from io import StringIO

from django.db import transaction
from django.db.models import Q, Sum, Count
from django.db.models.functions import Coalesce, TruncDate, TruncWeek, TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from django.utils.timezone import make_aware
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    Cliente,
    CTeDocumento,
    CTeDuplicata,
    ContaPagar,
    Fatura,
    FaturaItem,
    ManutencaoVeiculo,
    PagamentoAgregado,
    PagamentoProprio,
)
from ..permissions import CapabilityPermission, TransportModelPermission
from ..serializers.conciliacao_serializers import ContaPagarSerializer
from ..serializers.fatura_serializers import (
    FaturaCreateUpdateSerializer,
    FaturaListSerializer,
    FaturaSerializer,
)
from ..utils import csv_response


# ===================================================================
# Faturas (Contas a Receber)
# ===================================================================
class FaturaViewSet(viewsets.ModelViewSet):
    """API para CRUD de faturas de contas a receber e geração em lote por CT-e."""

    queryset = (
        Fatura.objects.select_related('cliente')
        .prefetch_related('itens__cte', 'itens__cte__identificacao')
        .order_by('-data_emissao', '-criado_em')
    )
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return FaturaCreateUpdateSerializer
        if self.action == 'retrieve':
            return FaturaSerializer
        return FaturaListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        cliente = params.get('cliente')
        if cliente:
            queryset = queryset.filter(cliente_id=cliente)

        status_filter = params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        data_inicio = params.get('data_inicio')
        data_fim = params.get('data_fim')
        try:
            if data_inicio:
                data_inicio = datetime.strptime(data_inicio, '%Y-%m-%d').date()
                queryset = queryset.filter(data_vencimento__gte=data_inicio)
            if data_fim:
                data_fim = datetime.strptime(data_fim, '%Y-%m-%d').date()
                queryset = queryset.filter(data_vencimento__lte=data_fim)
        except ValueError:
            return Response(
                {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        vencidas = params.get('vencidas')
        if vencidas is not None:
            is_vencidas = vencidas.lower() in ('true', '1', 'sim')
            if is_vencidas:
                queryset = queryset.filter(
                    data_vencimento__lt=date.today(),
                    status__in=('rascunho', 'enviada', 'atrasada'),
                )
            else:
                queryset = queryset.filter(data_vencimento__gte=date.today())

        busca = params.get('q') or params.get('busca')
        if busca:
            queryset = queryset.filter(
                Q(numero__icontains=busca)
                | Q(cliente__razao_social__icontains=busca)
                | Q(cliente__nome_fantasia__icontains=busca)
                | Q(observacao__icontains=busca)
            )

        cte_numero = params.get('cte_numero')
        if cte_numero:
            queryset = queryset.filter(
                itens__cte__identificacao__numero__icontains=cte_numero
            ).distinct()

        return queryset

    @action(detail=False, methods=['post'], url_path='gerar_lote', url_name='gerar_lote')
    @transaction.atomic
    def gerar_lote(self, request):
        """
        Gera uma fatura em lote a partir de CT-es selecionados.

        Body:
        - cliente: ID do cliente (obrigatório)
        - cte_ids: lista de IDs de CT-es (obrigatório)
        - data_vencimento: YYYY-MM-DD (obrigatório)
        - observacao: texto opcional
        """
        cliente_id = request.data.get('cliente')
        cte_ids = request.data.get('cte_ids', [])
        data_vencimento_str = request.data.get('data_vencimento')
        observacao = request.data.get('observacao', '') or ''

        if not cliente_id:
            return Response(
                {'detail': 'O campo cliente é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(cte_ids, list) or not cte_ids:
            return Response(
                {'detail': 'Informe uma lista de CT-es em cte_ids.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not data_vencimento_str:
            return Response(
                {'detail': 'A data de vencimento é obrigatória.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cliente = Cliente.objects.get(pk=cliente_id)
        except Cliente.DoesNotExist:
            return Response(
                {'detail': 'Cliente não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            data_vencimento = datetime.strptime(data_vencimento_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'Formato de data de vencimento inválido. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ctes = CTeDocumento.objects.filter(id__in=cte_ids).select_related(
            'identificacao', 'prestacao'
        )

        encontrados = {str(cte.id) for cte in ctes}
        nao_encontrados = set(map(str, cte_ids)) - encontrados
        if nao_encontrados:
            return Response(
                {'detail': f'CT-es não encontrados: {", ".join(sorted(nao_encontrados))}'},
                status=status.HTTP_404_NOT_FOUND,
            )

        ja_faturados = FaturaItem.objects.filter(cte__in=ctes).select_related('fatura')
        if ja_faturados.exists():
            detalhes = [
                f"CT-e {item.cte.chave[-8:]} já faturado em {item.fatura.numero}"
                for item in ja_faturados
            ]
            return Response(
                {'detail': 'Alguns CT-es já possuem fatura.', 'ctes': detalhes},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hoje = date.today()
        prefixo = f"FAT-{hoje.strftime('%Y%m%d')}"
        sequencial = Fatura.objects.filter(numero__startswith=prefixo).count() + 1
        numero = f"{prefixo}-{sequencial:04d}"

        fatura = Fatura.objects.create(
            cliente=cliente,
            numero=numero,
            data_emissao=hoje,
            data_vencimento=data_vencimento,
            status='rascunho',
            observacao=observacao,
            valor_total=Decimal('0.00'),
        )

        total = Decimal('0.00')
        for cte in ctes:
            prestacao = getattr(cte, 'prestacao', None)
            valor = Decimal('0.00')
            if prestacao and prestacao.valor_total_prestado is not None:
                valor = prestacao.valor_total_prestado

            numero_cte = None
            if cte.identificacao:
                numero_cte = cte.identificacao.numero

            descricao = f"CT-e {numero_cte or cte.chave[-8:]}"
            FaturaItem.objects.create(
                fatura=fatura,
                cte=cte,
                descricao=descricao,
                valor=valor,
            )
            total += valor

        fatura.valor_total = total
        fatura.save(update_fields=['valor_total', 'atualizado_em'])

        serializer = FaturaSerializer(fatura)
        return Response(
            {'fatura': serializer.data, 'itens_criados': len(ctes)},
            status=status.HTTP_201_CREATED,
        )


# ===================================================================
# Dashboards financeiros
# ===================================================================


def _parse_date_query(value, field_name):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f"Formato inválido para '{field_name}'. Use YYYY-MM-DD.")


def _parse_periodo(params):
    """Retorna (data_inicio, data_fim) a partir dos parâmetros ou período padrão."""
    data_inicio_str = params.get('data_inicio')
    data_fim_str = params.get('data_fim')

    if data_inicio_str and data_fim_str:
        data_inicio = _parse_date_query(data_inicio_str, 'data_inicio')
        data_fim = _parse_date_query(data_fim_str, 'data_fim')
    else:
        periodo = params.get('periodo', 'mes')
        hoje = date.today()
        if periodo == 'hoje':
            data_inicio = data_fim = hoje
        elif periodo == 'semana':
            data_inicio = hoje - timedelta(days=hoje.weekday())
            data_fim = data_inicio + timedelta(days=6)
        elif periodo == 'mes':
            data_inicio = date(hoje.year, hoje.month, 1)
            data_fim = (
                date(hoje.year, hoje.month + 1, 1) - timedelta(days=1)
                if hoje.month != 12
                else date(hoje.year, 12, 31)
            )
        elif periodo == 'ano':
            data_inicio = date(hoje.year, 1, 1)
            data_fim = date(hoje.year, 12, 31)
        else:
            raise ValueError("Período inválido. Use hoje, semana, mes ou ano.")

    if data_fim < data_inicio:
        raise ValueError('A data final deve ser maior ou igual à data inicial.')

    return data_inicio, data_fim


def _cte_base_query():
    """CT-es válidos: processados, autorizados e não cancelados."""
    return Q(processado=True, protocolo__codigo_status=100) & ~Q(cancelamento__c_stat=135)


def _format_currency(value):
    if value is None:
        return '0,00'
    return f"{float(value):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


class InadimplenciaAPIView(APIView):
    """
    Dashboard de inadimplência.

    Lista faturas (duplicatas) em atraso agrupadas por cliente e o total em aberto.
    """

    permission_classes = [IsAuthenticated, CapabilityPermission]
    required_capability = 'financeiro.inadimplencia'

    def get(self, request):
        try:
            data_corte = _parse_date_query(
                request.query_params.get('data_corte'), 'data_corte'
            ) or date.today()
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        duplicatas = CTeDuplicata.objects.filter(
            data_vencimento__lt=data_corte,
            cobranca__cte__pago=False,
        ).select_related(
            'cobranca__cte',
            'cobranca__cte__destinatario',
            'cobranca__cte__prestacao',
        )

        faturas_atrasadas = Fatura.objects.filter(
            status__in=['enviada', 'atrasada'],
            data_vencimento__lt=data_corte,
        ).select_related('cliente')

        por_cliente = {}
        faturas_detalhe = []

        def _acumular_cliente(cliente, valor, dias_atraso):
            cnpj = cliente.cnpj or '' if cliente else ''
            nome = cliente.razao_social if cliente else 'Cliente não identificado'
            chave_cliente = cnpj or nome

            if chave_cliente not in por_cliente:
                por_cliente[chave_cliente] = {
                    'cnpj': cnpj,
                    'nome': nome,
                    'quantidade_faturas': 0,
                    'total_aberto': Decimal('0.00'),
                    'maior_atraso': 0,
                }

            por_cliente[chave_cliente]['quantidade_faturas'] += 1
            por_cliente[chave_cliente]['total_aberto'] += valor
            por_cliente[chave_cliente]['maior_atraso'] = max(
                por_cliente[chave_cliente]['maior_atraso'], dias_atraso
            )
            return nome, cnpj

        for dup in duplicatas:
            cte = dup.cobranca.cte
            cliente = cte.destinatario
            valor = dup.valor or Decimal('0.00')
            dias_atraso = (data_corte - dup.data_vencimento).days
            nome, cnpj = _acumular_cliente(cliente, valor, dias_atraso)

            faturas_detalhe.append({
                'tipo': 'duplicata',
                'cliente_nome': nome,
                'cliente_cnpj': cnpj,
                'cte_chave': cte.chave,
                'cte_numero': getattr(cte.identificacao, 'numero', None),
                'data_vencimento': dup.data_vencimento.isoformat() if dup.data_vencimento else None,
                'dias_atraso': dias_atraso,
                'valor': float(valor),
                'valor_original': float(dup.valor or 0),
            })

        for fatura in faturas_atrasadas:
            cliente = fatura.cliente
            valor = fatura.valor_total or Decimal('0.00')
            dias_atraso = (data_corte - fatura.data_vencimento).days
            nome, cnpj = _acumular_cliente(cliente, valor, dias_atraso)

            faturas_detalhe.append({
                'tipo': 'fatura',
                'cliente_nome': nome,
                'cliente_cnpj': cnpj,
                'fatura_id': str(fatura.id),
                'fatura_numero': fatura.numero,
                'data_vencimento': fatura.data_vencimento.isoformat() if fatura.data_vencimento else None,
                'dias_atraso': dias_atraso,
                'valor': float(valor),
                'valor_original': float(fatura.valor_total or 0),
            })

        clientes_list = []
        total_geral = Decimal('0.00')
        for item in por_cliente.values():
            total_geral += item['total_aberto']
            clientes_list.append({
                'cnpj': item['cnpj'],
                'nome': item['nome'],
                'quantidade_faturas': item['quantidade_faturas'],
                'total_aberto': float(item['total_aberto']),
                'maior_atraso': item['maior_atraso'],
            })

        clientes_list.sort(key=lambda x: x['total_aberto'], reverse=True)
        faturas_detalhe.sort(key=lambda x: x['dias_atraso'], reverse=True)

        return Response({
            'data_corte': data_corte.isoformat(),
            'total_em_aberto': float(total_geral),
            'quantidade_faturas': len(faturas_detalhe),
            'quantidade_clientes': len(clientes_list),
            'clientes': clientes_list,
            'faturas': faturas_detalhe,
        })


class FluxoCaixaAPIView(APIView):
    """
    Projeção de fluxo de caixa.

    Receitas: faturas a receber (duplicatas de CT-e).
    Despesas: pagamentos pendentes (agregados e próprios).
    Agrupamento por dia, semana ou mês.
    """

    permission_classes = [IsAuthenticated, CapabilityPermission]
    required_capability = 'financeiro.fluxo_caixa'

    def get(self, request):
        try:
            data_inicio, data_fim = _parse_periodo(request.query_params)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        agrupamento = request.query_params.get('agrupamento', 'dia')
        if agrupamento not in ('dia', 'semana', 'mes'):
            return Response(
                {'detail': "Agrupamento inválido. Use dia, semana ou mes."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data_fim_query = data_fim + timedelta(days=1)

        receitas_qs = CTeDuplicata.objects.filter(
            data_vencimento__gte=data_inicio,
            data_vencimento__lt=data_fim_query,
            cobranca__cte__pago=False,
        )

        despesas_agregados = PagamentoAgregado.objects.filter(
            status='pendente',
            data_prevista__gte=data_inicio,
            data_prevista__lt=data_fim_query,
        )
        despesas_proprios = PagamentoProprio.objects.filter(
            status='pendente',
            data_prevista__gte=data_inicio,
            data_prevista__lt=data_fim_query,
        )
        despesas_contas = ContaPagar.objects.filter(
            status__in=['pendente', 'atrasada'],
            data_vencimento__gte=data_inicio,
            data_vencimento__lt=data_fim_query,
        )

        def _agrupar_datefield(qs, campo_data, campo_valor):
            """Agrupa valores por período sem problemas de timezone em DateField."""
            if agrupamento == 'dia':
                return {
                    item[campo_data]: item['valor']
                    for item in qs.values(campo_data).annotate(
                        valor=Coalesce(Sum(campo_valor), Decimal('0.00'))
                    ).order_by(campo_data)
                    if item[campo_data]
                }
            trunc_map = {
                'semana': TruncWeek,
                'mes': TruncMonth,
            }
            trunc_fn = trunc_map[agrupamento]
            return {
                item['data_periodo']: item['valor']
                for item in qs.annotate(
                    data_periodo=trunc_fn(campo_data)
                ).values('data_periodo').annotate(
                    valor=Coalesce(Sum(campo_valor), Decimal('0.00'))
                ).order_by('data_periodo')
                if item['data_periodo']
            }

        receitas_agrupadas = _agrupar_datefield(receitas_qs, 'data_vencimento', 'valor')
        despesas_agrupadas = _agrupar_datefield(despesas_agregados, 'data_prevista', 'valor_repassado')
        despesas_proprios_agrupadas = _agrupar_datefield(
            despesas_proprios, 'data_prevista', 'valor_total_pagar'
        )
        despesas_contas_agrupadas = _agrupar_datefield(
            despesas_contas, 'data_vencimento', 'valor'
        )

        periodos = []
        if agrupamento == 'dia':
            current = data_inicio
            while current <= data_fim:
                periodos.append(current)
                current += timedelta(days=1)
        elif agrupamento == 'semana':
            current = data_inicio - timedelta(days=data_inicio.weekday())
            while current <= data_fim:
                periodos.append(current)
                current += timedelta(days=7)
        else:
            current = date(data_inicio.year, data_inicio.month, 1)
            while current <= data_fim:
                periodos.append(current)
                if current.month == 12:
                    current = date(current.year + 1, 1, 1)
                else:
                    current = date(current.year, current.month + 1, 1)

        saldo_acumulado = Decimal('0.00')
        serie = []
        for periodo in periodos:
            receita = receitas_agrupadas.get(periodo, Decimal('0.00'))
            despesa_agregado = despesas_agrupadas.get(periodo, Decimal('0.00'))
            despesa_proprio = despesas_proprios_agrupadas.get(periodo, Decimal('0.00'))
            despesa_contas = despesas_contas_agrupadas.get(periodo, Decimal('0.00'))
            despesa = despesa_agregado + despesa_proprio + despesa_contas
            saldo_periodo = receita - despesa
            saldo_acumulado += saldo_periodo

            label = periodo.isoformat()
            if agrupamento == 'mes':
                label = periodo.strftime('%Y-%m')
            elif agrupamento == 'semana':
                label = f"{periodo.isoformat()} a {(periodo + timedelta(days=6)).isoformat()}"

            serie.append({
                'periodo': label,
                'receitas': float(receita),
                'despesas_agregados': float(despesa_agregado),
                'despesas_proprios': float(despesa_proprio),
                'despesas': float(despesa),
                'saldo_periodo': float(saldo_periodo),
                'saldo_acumulado': float(saldo_acumulado),
            })

        total_receitas = sum(item['receitas'] for item in serie)
        total_despesas = sum(item['despesas'] for item in serie)

        return Response({
            'filtros': {
                'data_inicio': data_inicio.isoformat(),
                'data_fim': data_fim.isoformat(),
                'agrupamento': agrupamento,
            },
            'totais': {
                'receitas': total_receitas,
                'despesas': total_despesas,
                'saldo_projetado': total_receitas - total_despesas,
            },
            'serie': serie,
        })


class DREAPIView(APIView):
    """
    DRE simplificada: receita, custos e margem por período.

    Receita: CT-es válidos emitidos no período.
    Custos: pagamentos agregados, pagamentos próprios e manutenções.
    """

    permission_classes = [IsAuthenticated, CapabilityPermission]
    required_capability = 'financeiro.dre'

    def get(self, request):
        try:
            data_inicio, data_fim = _parse_periodo(request.query_params)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        data_fim_query = data_fim + timedelta(days=1)

        ctes_query = CTeDocumento.objects.filter(
            _cte_base_query(),
            identificacao__data_emissao__date__gte=data_inicio,
            identificacao__data_emissao__date__lt=data_fim_query,
        )

        receita_total = ctes_query.aggregate(
            total=Coalesce(Sum('prestacao__valor_total_prestado'), Decimal('0.00'))
        )['total']

        custos_agregados = PagamentoAgregado.objects.filter(
            cte__in=ctes_query.values('id'),
        ).aggregate(
            total=Coalesce(Sum('valor_repassado'), Decimal('0.00'))
        )['total']

        custos_proprios = PagamentoProprio.objects.filter(
            cte__in=ctes_query.values('id'),
        ).aggregate(
            total=Coalesce(Sum('valor_total_pagar'), Decimal('0.00'))
        )['total']

        manutencoes = ManutencaoVeiculo.objects.filter(
            Q(data_agendada__gte=data_inicio, data_agendada__lt=data_fim_query)
            | Q(data_realizada__gte=data_inicio, data_realizada__lt=data_fim_query)
            | Q(data_servico__gte=data_inicio, data_servico__lt=data_fim_query),
        ).aggregate(
            total=Coalesce(Sum('custo'), Decimal('0.00'))
        )['total']

        custo_total = custos_agregados + custos_proprios + manutencoes
        lucro = receita_total - custo_total
        margem = (lucro / receita_total * 100) if receita_total else Decimal('0.00')

        evolucao = ctes_query.annotate(
            mes=TruncMonth('identificacao__data_emissao')
        ).values('mes').annotate(
            receita=Coalesce(Sum('prestacao__valor_total_prestado'), Decimal('0.00')),
            qtd_ctes=Count('id'),
        ).order_by('mes')

        evolucao_list = []
        for item in evolucao:
            if not item['mes']:
                continue
            mes = item['mes']
            receita_mes = item['receita']
            inicio_mes = date(mes.year, mes.month, 1)
            fim_mes = (
                date(mes.year, mes.month + 1, 1) - timedelta(days=1)
                if mes.month != 12
                else date(mes.year, 12, 31)
            )
            inicio_mes_dt = make_aware(timezone.datetime(mes.year, mes.month, 1))
            fim_mes_dt = (
                make_aware(timezone.datetime(mes.year, mes.month + 1, 1) - timedelta(days=1))
                if mes.month != 12
                else make_aware(timezone.datetime(mes.year, 12, 31, 23, 59, 59))
            )
            ctes_mes = ctes_query.filter(
                identificacao__data_emissao__gte=inicio_mes_dt,
                identificacao__data_emissao__lte=fim_mes_dt,
            )
            custo_mes = (
                PagamentoAgregado.objects.filter(
                    cte__in=ctes_mes.values('id')
                ).aggregate(
                    total=Coalesce(Sum('valor_repassado'), Decimal('0.00'))
                )['total']
                + PagamentoProprio.objects.filter(
                    cte__in=ctes_mes.values('id')
                ).aggregate(
                    total=Coalesce(Sum('valor_total_pagar'), Decimal('0.00'))
                )['total']
                + ManutencaoVeiculo.objects.filter(
                    Q(data_agendada__gte=inicio_mes, data_agendada__lte=fim_mes)
                    | Q(data_realizada__gte=inicio_mes, data_realizada__lte=fim_mes)
                    | Q(data_servico__gte=inicio_mes, data_servico__lte=fim_mes),
                ).aggregate(
                    total=Coalesce(Sum('custo'), Decimal('0.00'))
                )['total']
            )
            lucro_mes = receita_mes - custo_mes
            margem_mes = (lucro_mes / receita_mes * 100) if receita_mes else Decimal('0.00')
            evolucao_list.append({
                'mes': mes.strftime('%Y-%m'),
                'receita': float(receita_mes),
                'custos': float(custo_mes),
                'lucro': float(lucro_mes),
                'margem': float(margem_mes),
                'qtd_ctes': item['qtd_ctes'],
            })

        resumo = {
            'receita_total': float(receita_total),
            'custos': {
                'agregados': float(custos_agregados),
                'proprios': float(custos_proprios),
                'manutencoes': float(manutencoes),
                'total': float(custo_total),
            },
            'lucro': float(lucro),
            'margem_percentual': float(margem),
            'qtd_ctes': ctes_query.count(),
        }

        formato = request.query_params.get('formato', 'json')
        if formato == 'csv':
            return self._exportar_csv(resumo, evolucao_list, data_inicio, data_fim)

        return Response({
            'filtros': {
                'data_inicio': data_inicio.isoformat(),
                'data_fim': data_fim.isoformat(),
            },
            'resumo': resumo,
            'evolucao_mensal': evolucao_list,
        })

    def _exportar_csv(self, resumo, evolucao, data_inicio, data_fim):
        output = StringIO()
        writer = csv.writer(output, delimiter=';')

        writer.writerow(['DRE Simplificada'])
        writer.writerow(['Período', f"{data_inicio.isoformat()} a {data_fim.isoformat()}"])
        writer.writerow([])

        writer.writerow(['Indicador', 'Valor (R$)'])
        writer.writerow(['Receita Total', _format_currency(resumo['receita_total'])])
        writer.writerow(['Custos - Agregados', _format_currency(resumo['custos']['agregados'])])
        writer.writerow(['Custos - Próprios', _format_currency(resumo['custos']['proprios'])])
        writer.writerow(['Custos - Manutenções', _format_currency(resumo['custos']['manutencoes'])])
        writer.writerow(['Custos - Total', _format_currency(resumo['custos']['total'])])
        writer.writerow(['Lucro', _format_currency(resumo['lucro'])])
        writer.writerow(['Margem %', _format_currency(resumo['margem_percentual'])])
        writer.writerow(['Quantidade CT-es', resumo['qtd_ctes']])
        writer.writerow([])

        writer.writerow(['Mês', 'Receita (R$)', 'Custos (R$)', 'Lucro (R$)', 'Margem %', 'CT-es'])
        for item in evolucao:
            writer.writerow([
                item['mes'],
                _format_currency(item['receita']),
                _format_currency(item['custos']),
                _format_currency(item['lucro']),
                _format_currency(item['margem']),
                item['qtd_ctes'],
            ])

        filename = f"dre_simplificada_{data_inicio.isoformat()}_{data_fim.isoformat()}.csv"
        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ContaPagarViewSet(viewsets.ModelViewSet):
    """API para gerenciar contas a pagar."""

    queryset = ContaPagar.objects.all().order_by('-data_vencimento')
    serializer_class = ContaPagarSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def get_queryset(self):
        """Permite filtrar contas a pagar por diversos parâmetros."""
        queryset = super().get_queryset()
        params = self.request.query_params

        status_filter = params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        categoria = params.get('categoria')
        if categoria:
            queryset = queryset.filter(categoria=categoria)

        veiculo = params.get('veiculo')
        if veiculo:
            queryset = queryset.filter(veiculo_id=veiculo)

        fornecedor = params.get('fornecedor')
        if fornecedor:
            queryset = queryset.filter(fornecedor__icontains=fornecedor)

        data_inicio = params.get('data_inicio')
        if data_inicio:
            queryset = queryset.filter(data_vencimento__gte=data_inicio)

        data_fim = params.get('data_fim')
        if data_fim:
            queryset = queryset.filter(data_vencimento__lte=data_fim)

        texto = params.get('q')
        if texto:
            queryset = queryset.filter(
                Q(descricao__icontains=texto) |
                Q(fornecedor__icontains=texto) |
                Q(observacao__icontains=texto)
            )

        return queryset.select_related('veiculo').distinct()

    def perform_create(self, serializer):
        """Validação adicional antes de salvar uma nova conta."""
        instance = serializer.save()
        self._atualizar_status_atrasada(instance)

    def perform_update(self, serializer):
        """Validação adicional ao atualizar uma conta."""
        instance = serializer.save()
        self._atualizar_status_atrasada(instance)

    def _atualizar_status_atrasada(self, instance):
        """Marca como atrasada se estiver pendente e vencida."""
        if instance.status == 'pendente' and instance.data_vencimento < date.today():
            instance.status = 'atrasada'
            instance.save(update_fields=['status'])

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Exporta as contas a pagar filtradas para CSV."""
        queryset = self.get_queryset()
        filename = f"contas_a_pagar_{date.today().strftime('%Y%m%d')}.csv"
        return csv_response(queryset, self.get_serializer_class(), filename)
