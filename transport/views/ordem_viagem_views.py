# transport/views/ordem_viagem_views.py
"""Views para Ordens de Viagem (OS)."""

from django.db import transaction
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import DespesaViagem, OrdemViagem, PosicaoVeiculo, RotaOtimizada
from ..permissions import TransportModelPermission
from ..serializers.ordem_viagem_serializers import (
    DespesaViagemSerializer, OrdemViagemCreateUpdateSerializer,
    OrdemViagemListSerializer, OrdemViagemSerializer
)
from ..serializers.posicao_veiculo_serializers import PosicaoVeiculoSerializer
from ..serializers.rota_serializers import RotaOtimizadaListSerializer, RotaOtimizadaSerializer


class OrdemViagemViewSet(viewsets.ModelViewSet):
    """CRUD de Ordens de Viagem."""

    queryset = OrdemViagem.objects.all().select_related(
        'cliente', 'veiculo', 'motorista'
    ).prefetch_related('ctes__cte__identificacao', 'paradas', 'despesas')
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['numero', 'origem_cidade', 'destino_cidade', 'observacoes']
    ordering_fields = ['data_saida', 'data_previsao_chegada', 'criado_em', 'status']
    ordering = ['-data_saida', '-criado_em']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return OrdemViagemCreateUpdateSerializer
        if self.action == 'list':
            return OrdemViagemListSerializer
        return OrdemViagemSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        """Gera número sequencial se não informado (reinicia por ano)."""
        numero = serializer.validated_data.get('numero')
        if not numero:
            from django.utils import timezone
            ano_atual = timezone.now().year
            prefixo = f"OS{ano_atual}"
            ultima = OrdemViagem.objects.filter(numero__startswith=prefixo).order_by('-numero').first()
            seq = 1
            if ultima and ultima.numero.startswith(prefixo) and len(ultima.numero) == len(prefixo) + 6:
                try:
                    seq = int(ultima.numero[-6:]) + 1
                except ValueError:
                    seq = 1
            numero = f"{prefixo}{seq:06d}"
            while OrdemViagem.objects.filter(numero=numero).exists():
                seq += 1
                numero = f"{prefixo}{seq:06d}"
            serializer.validated_data['numero'] = numero
        serializer.save()

    @action(detail=True, methods=['post'], url_path='alterar-status')
    def alterar_status(self, request, pk=None):
        """Altera o status da ordem de viagem."""
        ordem = self.get_object()
        novo_status = request.data.get('status')
        status_validos = [s[0] for s in OrdemViagem.STATUS_OPCOES]
        if novo_status not in status_validos:
            raise ValidationError({'status': f'Status inválido. Opções: {status_validos}'})
        ordem.status = novo_status
        ordem.save(update_fields=['status', 'atualizado_em'])
        return Response(OrdemViagemSerializer(ordem).data)

    @action(detail=True, methods=['post'], url_path='despesas')
    def adicionar_despesa(self, request, pk=None):
        """Adiciona uma despesa à ordem de viagem."""
        ordem = self.get_object()
        serializer = DespesaViagemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(ordem=ordem)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='eta')
    def eta(self, request, pk=None):
        """Calcula ETA estimado com base na última posição registrada."""
        from datetime import datetime, timedelta
        from math import radians, sin, cos, sqrt, atan2

        ordem = self.get_object()
        ultima_posicao = ordem.posicoes.order_by('-data_hora').first()

        if not ultima_posicao:
            return Response({
                'ordem_id': ordem.id,
                'ultima_posicao': None,
                'distancia_restante_km': None,
                'velocidade_media_kmh': 60,
                'eta_horas': None,
                'eta_texto': 'Sem posição registrada',
                'status': 'sem_posicao'
            })

        # Distância restante fictícia: se houver dist_km na identificação do CT-e,
        # usa como base; senão estima 500km padrão.
        distancia_total = 500
        if ordem.ctes.exists():
            primeira_cte = ordem.ctes.first().cte
            if primeira_cte and primeira_cte.identificacao and primeira_cte.identificacao.dist_km:
                distancia_total = primeira_cte.identificacao.dist_km

        # Heurística simples: considera 70% da distância restante a partir da última posição
        distancia_restante = int(distancia_total * 0.7)
        velocidade_media = float(ultima_posicao.velocidade or 60)
        if velocidade_media <= 0:
            velocidade_media = 60

        eta_horas = distancia_restante / velocidade_media
        eta_datetime = timezone.now() + timedelta(hours=eta_horas)

        return Response({
            'ordem_id': ordem.id,
            'ultima_posicao': PosicaoVeiculoSerializer(ultima_posicao).data,
            'distancia_restante_km': distancia_restante,
            'velocidade_media_kmh': int(velocidade_media),
            'eta_horas': round(eta_horas, 2),
            'eta_texto': eta_datetime.strftime('%d/%m/%Y %H:%M'),
            'status': ordem.status
        })

    @action(detail=True, methods=['post'], url_path='posicoes')
    def registrar_posicao(self, request, pk=None):
        """Registra uma nova posição para a ordem de viagem."""
        ordem = self.get_object()
        serializer = PosicaoVeiculoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(ordem=ordem, veiculo=ordem.veiculo)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='rotas')
    def listar_rotas(self, request, pk=None):
        """Lista rotas otimizadas calculadas para a ordem de viagem."""
        ordem = self.get_object()
        rotas = ordem.rotas.all()
        serializer = RotaOtimizadaListSerializer(rotas, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='calcular-rota')
    def calcular_rota(self, request, pk=None):
        """
        Calcula e persiste uma rota otimizada para a ordem de viagem.
        Espera opcionalmente 'pontos' no body; senão, usa origem/destino/paradas da ordem.
        """
        from ..services.rota_service import calcular_rota_osrm, ordenar_pontos_otimizado

        ordem = self.get_object()
        pontos = request.data.get('pontos')

        if not pontos:
            pontos = []
            if ordem.origem_latitude and ordem.origem_longitude:
                pontos.append({
                    'latitude': float(ordem.origem_latitude),
                    'longitude': float(ordem.origem_longitude),
                    'descricao': ordem.origem_cidade or 'Origem',
                })
            for parada in ordem.paradas.order_by('sequencia'):
                if parada.latitude and parada.longitude:
                    pontos.append({
                        'latitude': float(parada.latitude),
                        'longitude': float(parada.longitude),
                        'descricao': parada.cidade or f'Parada {parada.ordem}',
                    })
            if ordem.destino_latitude and ordem.destino_longitude:
                pontos.append({
                    'latitude': float(ordem.destino_latitude),
                    'longitude': float(ordem.destino_longitude),
                    'descricao': ordem.destino_cidade or 'Destino',
                })

        if len(pontos) < 2:
            return Response(
                {'erro': 'Ordem de viagem não possui coordenadas suficientes para calcular rota.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        otimizar = request.data.get('otimizar', True)
        if otimizar:
            pontos = ordenar_pontos_otimizado(pontos)

        resultado = calcular_rota_osrm(pontos)
        if 'erro' in resultado:
            return Response({'erro': resultado['erro']}, status=status.HTTP_502_BAD_GATEWAY)

        rota = RotaOtimizada.objects.create(
            ordem=ordem,
            distancia_km=resultado['distancia_km'],
            duracao_min=resultado['duracao_min'],
            geometria=resultado['geometria'],
            waypoints=resultado['waypoints'],
            provedor=resultado['provedor'],
            status='calculada',
        )
        serializer = RotaOtimizadaSerializer(rota)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DespesaViagemViewSet(viewsets.ModelViewSet):
    """CRUD de Despesas de Viagem."""

    queryset = DespesaViagem.objects.all().select_related('ordem')
    serializer_class = DespesaViagemSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-data', '-criado_em']
