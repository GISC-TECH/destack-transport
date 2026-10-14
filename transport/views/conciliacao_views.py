# transport/views/conciliacao_views.py
"""Views para conciliação bancária."""

from django.db import transaction
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Fatura, ContaPagar, TransacaoBancaria
from ..permissions import TransportModelPermission
from ..serializers.conciliacao_serializers import (
    TransacaoBancariaSerializer,
    TransacaoBancariaListSerializer,
    VincularTransacaoSerializer,
    UploadConciliacaoSerializer,
)
from ..services.conciliacao_service import parse_arquivo, salvar_transacoes


class TransacaoBancariaViewSet(viewsets.ModelViewSet):
    """API para conciliação bancária."""
    queryset = TransacaoBancaria.objects.all().order_by('-data', '-criado_em')
    serializer_class = TransacaoBancariaSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        conciliado = params.get('conciliado')
        if conciliado is not None:
            queryset = queryset.filter(conciliado=conciliado.lower() in ('true', '1', 'sim'))

        tipo = params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)

        arquivo = params.get('arquivo')
        if arquivo:
            queryset = queryset.filter(arquivo_origem__icontains=arquivo)

        data_inicio = params.get('data_inicio')
        data_fim = params.get('data_fim')
        if data_inicio:
            queryset = queryset.filter(data__gte=data_inicio)
        if data_fim:
            queryset = queryset.filter(data__lte=data_fim)

        busca = params.get('busca')
        if busca:
            queryset = queryset.filter(descricao__icontains=busca)

        return queryset.select_related('fatura', 'conta_pagar')

    def get_serializer_class(self):
        if self.action == 'list':
            return TransacaoBancariaListSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        """
        Faz upload de arquivo OFX/CSV e retorna as transações detectadas.
        Não persiste automaticamente no banco de dados.
        """
        serializer = UploadConciliacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        arquivo = serializer.validated_data['arquivo']
        try:
            transacoes = parse_arquivo(arquivo, arquivo.name)
            return Response({
                'arquivo': arquivo.name,
                'quantidade': len(transacoes),
                'transacoes': transacoes,
            }, status=status.HTTP_200_OK)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='importar')
    @transaction.atomic
    def importar(self, request):
        """
        Faz upload de arquivo OFX/CSV e persiste as transações detectadas.
        """
        serializer = UploadConciliacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        arquivo = serializer.validated_data['arquivo']
        try:
            transacoes = parse_arquivo(arquivo, arquivo.name)
            registros = salvar_transacoes(transacoes, arquivo.name)
            return Response({
                'arquivo': arquivo.name,
                'quantidade': len(registros),
                'transacoes': TransacaoBancariaListSerializer(registros, many=True).data,
            }, status=status.HTTP_201_CREATED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='vincular')
    @transaction.atomic
    def vincular(self, request, pk=None):
        """
        Vincula uma transação bancária a uma Fatura ou Conta a Pagar.
        Body: { "fatura_id": "<uuid>" } ou { "conta_pagar_id": <int> }
        """
        transacao = self.get_object()
        serializer = VincularTransacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fatura_id = serializer.validated_data.get('fatura_id')
        conta_pagar_id = serializer.validated_data.get('conta_pagar_id')

        if fatura_id:
            transacao.fatura_id = fatura_id
            transacao.conta_pagar = None
        elif conta_pagar_id:
            transacao.conta_pagar_id = conta_pagar_id
            transacao.fatura = None

        transacao.conciliado = True
        transacao.save(update_fields=['fatura', 'conta_pagar', 'conciliado', 'atualizado_em'])

        # Atualiza status da fatura/conta paga quando vinculada
        if transacao.fatura and transacao.fatura.status in ('rascunho', 'enviada', 'atrasada'):
            transacao.fatura.status = 'paga'
            transacao.fatura.save(update_fields=['status', 'atualizado_em'])

        if transacao.conta_pagar and transacao.conta_pagar.status in ('pendente', 'atrasada'):
            transacao.conta_pagar.status = 'paga'
            transacao.conta_pagar.data_pagamento = transacao.data
            transacao.conta_pagar.save(update_fields=['status', 'data_pagamento', 'atualizado_em'])

        return Response(
            TransacaoBancariaSerializer(transacao).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='desvincular')
    @transaction.atomic
    def desvincular(self, request, pk=None):
        """Remove o vínculo de uma transação bancária."""
        transacao = self.get_object()
        transacao.fatura = None
        transacao.conta_pagar = None
        transacao.conciliado = False
        transacao.save(update_fields=['fatura', 'conta_pagar', 'conciliado', 'atualizado_em'])
        return Response(
            TransacaoBancariaSerializer(transacao).data,
            status=status.HTTP_200_OK
        )
