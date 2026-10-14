# transport/views/payment_views.py

# Imports padrão
import csv
import io
import mimetypes
import os
import re
import shutil
import tempfile
import zipfile
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

# Imports Django
from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.db.models import Q, Sum, OuterRef, Exists
from django.utils import timezone
from django.shortcuts import get_object_or_404 # Usado internamente
from django.db import transaction
from django.utils.text import get_valid_filename

# Imports Django REST Framework
from rest_framework import viewsets, status, serializers # Importa serializers para ValidationError
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
import logging

logger = logging.getLogger(__name__)
from rest_framework.permissions import IsAuthenticated

# Imports Locais
from ..permissions import TransportModelPermission
from ..serializers.payment_serializers import ( # Use .. para voltar um nível
    FaixaKMSerializer,
    PagamentoAgregadoSerializer,
    PagamentoProprioSerializer
)
from ..models import (  # Modelos usados pelos ViewSets
    FaixaKM,
    PagamentoAgregado,
    PagamentoProprio,
    Veiculo,
    CTeDocumento,
    CTeIdentificacao, # Usado nos filtros/cálculos
    CTeModalRodoviario, # Usado nos filtros/cálculos
    CTeMotorista, # Usado nos filtros/cálculos
    CTePrestacaoServico, # Usado nos filtros/cálculos
    CTeVeiculoRodoviario, # Usado nos filtros/cálculos
    # MDF-e relacionados para buscar veículos/condutores
    MDFeDocumento,
    MDFeDocumentosVinculados,
    MDFeModalRodoviario,
    MDFeVeiculoTracao,
    MDFeCondutor,
)
# Funções utilitárias de outros módulos (se necessário)
# Ex: from ..utils import format_currency
from ..utils import csv_response
from ..constants import DEFAULT_PAYMENT_PERCENTAGE
from ..validators import normalizar_placa
from ..services.pagamento_service import (
    ExclusividadePagamentoError,
    _verificar_exclusividade_mutua,
    notificar_gestor_pagamento,
)
from ..tasks import notificar_gestor_pagamento_async


class ComprovanteDownloadLimitExceeded(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_code = 'limite_download_excedido'


def _validar_exclusividade_pagamento_cte(cte):
    """Retorna Response de erro 400 se o CT-e já possuir ambos os tipos de pagamento."""
    if not cte:
        return None
    try:
        _verificar_exclusividade_mutua(cte)
    except ExclusividadePagamentoError as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


class ComprovanteDownloadMixin:
    """Entrega comprovantes privados individualmente ou em um ZIP autenticado."""

    comprovante_tipo = 'pagamentos'

    def _comprovantes_queryset(self, request):
        queryset = (
            self.get_queryset()
            .exclude(comprovante='')
            .exclude(comprovante__isnull=True)
        )
        baixar_todos = request.data.get('todos') is True
        ids = request.data.get('ids', [])

        if baixar_todos and ids:
            raise serializers.ValidationError(
                {'detail': "Informe 'todos' ou 'ids', nunca os dois ao mesmo tempo."}
            )
        if not baixar_todos:
            if not isinstance(ids, list) or not ids:
                raise serializers.ValidationError(
                    {'detail': "Informe uma lista não vazia em 'ids' ou use {'todos': true}."}
                )
            try:
                ids = [int(item) for item in ids]
                if any(item <= 0 for item in ids):
                    raise ValueError
            except (TypeError, ValueError, AttributeError):
                raise serializers.ValidationError(
                    {'detail': 'A lista contém um identificador inválido.'}
                )
            queryset = queryset.filter(pk__in=ids)

        limite = int(getattr(settings, 'COMPROVANTES_ZIP_MAX_FILES', 50))
        total = queryset.count()
        if total > limite:
            raise ComprovanteDownloadLimitExceeded(
                f'A seleção possui {total} arquivos. O limite por download é {limite}. Refine os filtros.'
            )

        limite_bytes = int(
            getattr(settings, 'COMPROVANTES_ZIP_MAX_TOTAL_BYTES', 100 * 1024 * 1024)
        )
        total_bytes = 0
        tamanho_queryset = queryset.select_related(None).only('pk', 'comprovante')
        for pagamento in tamanho_queryset.iterator(chunk_size=100):
            try:
                total_bytes += pagamento.comprovante.size
            except Exception as exc:
                logger.warning(
                    'Não foi possível obter tamanho do comprovante %s: %s',
                    pagamento.pk,
                    exc,
                )
                continue
            if total_bytes > limite_bytes:
                limite_mb = limite_bytes // (1024 * 1024)
                raise ComprovanteDownloadLimitExceeded(
                    f'Os comprovantes excedem o limite de {limite_mb} MB por download. Refine os filtros.'
                )
        return queryset

    def _nome_comprovante(self, pagamento, indice):
        campo = pagamento.comprovante
        nome_original = get_valid_filename(os.path.basename(campo.name or 'comprovante'))
        raiz, extensao = os.path.splitext(nome_original)
        raiz = raiz or 'comprovante'
        return f'{indice:04d}_{str(pagamento.pk)[:8]}_{raiz}{extensao.lower()}'

    @action(detail=True, methods=['get'], url_path='comprovante')
    def comprovante(self, request, pk=None):
        pagamento = self.get_object()
        campo = pagamento.comprovante
        if not campo:
            return Response(
                {'detail': 'Este pagamento não possui comprovante.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            arquivo = campo.open('rb')
        except Exception:
            logger.exception('Comprovante indisponível para pagamento %s', pagamento.pk)
            return Response(
                {'detail': 'O comprovante não está disponível no armazenamento.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        nome = get_valid_filename(os.path.basename(campo.name or 'comprovante'))
        content_type = mimetypes.guess_type(nome)[0] or 'application/octet-stream'
        resposta = FileResponse(
            arquivo,
            as_attachment=True,
            filename=nome,
            content_type=content_type,
        )
        resposta['Cache-Control'] = 'private, no-store'
        resposta['Pragma'] = 'no-cache'
        return resposta

    @action(detail=False, methods=['post'], url_path='comprovantes/download')
    def download_comprovantes(self, request):
        queryset = self._comprovantes_queryset(request)
        arquivo_zip = tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024, mode='w+b')
        manifest = io.StringIO()
        manifest_writer = csv.writer(manifest)
        manifest_writer.writerow(['pagamento_id', 'arquivo', 'status'])
        incluidos = 0

        with zipfile.ZipFile(arquivo_zip, mode='w', compression=zipfile.ZIP_DEFLATED) as zip_saida:
            for indice, pagamento in enumerate(queryset.iterator(chunk_size=100), start=1):
                nome = self._nome_comprovante(pagamento, indice)
                try:
                    with pagamento.comprovante.open('rb') as origem:
                        with zip_saida.open(nome, mode='w') as destino:
                            shutil.copyfileobj(origem, destino, length=1024 * 1024)
                    manifest_writer.writerow([pagamento.pk, nome, 'incluído'])
                    incluidos += 1
                except Exception:
                    logger.exception('Falha ao incluir comprovante do pagamento %s', pagamento.pk)
                    manifest_writer.writerow([pagamento.pk, nome, 'indisponível'])

            zip_saida.writestr('manifesto.csv', manifest.getvalue().encode('utf-8-sig'))

        if incluidos == 0:
            arquivo_zip.close()
            return Response(
                {'detail': 'Nenhum comprovante disponível para os pagamentos informados.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        arquivo_zip.seek(0)
        agora = timezone.now().strftime('%Y%m%d_%H%M%S')
        resposta = FileResponse(
            arquivo_zip,
            as_attachment=True,
            filename=f'comprovantes_{self.comprovante_tipo}_{agora}.zip',
            content_type='application/zip',
        )
        resposta['X-Comprovantes-Incluidos'] = str(incluidos)
        resposta['Cache-Control'] = 'private, no-store'
        resposta['Pragma'] = 'no-cache'
        return resposta


# ===============================================================
# ==> APIS PARA PAGAMENTOS
# ===============================================================

class FaixaKMViewSet(viewsets.ModelViewSet):
    """API para CRUD de Faixas de KM para pagamento."""
    queryset = FaixaKM.objects.all().order_by('min_km')
    serializer_class = FaixaKMSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def perform_create(self, serializer):
        """Validação adicional antes de salvar uma nova faixa."""
        min_km = serializer.validated_data.get('min_km')
        max_km = serializer.validated_data.get('max_km')

        # Verifica se min_km < max_km quando max_km é fornecido
        if max_km is not None and min_km >= max_km:
            raise serializers.ValidationError({'max_km': 'O KM máximo deve ser maior que o KM mínimo.'})

        # Verifica sobreposições
        if self._verifica_sobreposicao(min_km, max_km):
             raise serializers.ValidationError({'min_km': 'Existe sobreposição com outra faixa de KM.'})

        serializer.save()

    def perform_update(self, serializer):
        """Validação adicional antes de atualizar uma faixa existente."""
        instance = serializer.instance
        min_km = serializer.validated_data.get('min_km', instance.min_km)
        max_km = serializer.validated_data.get('max_km', instance.max_km)

        # Verifica se min_km < max_km quando max_km é fornecido
        if max_km is not None and min_km >= max_km:
            raise serializers.ValidationError({'max_km': 'O KM máximo deve ser maior que o KM mínimo.'})

        # Verifica sobreposições, excluindo a própria instância
        if self._verifica_sobreposicao(min_km, max_km, instance.pk):
             raise serializers.ValidationError({'min_km': 'Existe sobreposição com outra faixa de KM.'})

        serializer.save()

    def _verifica_sobreposicao(self, min_km, max_km, exclude_pk=None):
        """Verifica se a nova faixa (min_km, max_km) se sobrepõe a alguma existente."""
        queryset = FaixaKM.objects.all()
        if exclude_pk:
            queryset = queryset.exclude(pk=exclude_pk)

        # Condições de sobreposição
        # 1. Nova faixa começa DENTRO de uma faixa existente
        q1 = Q(min_km__lte=min_km) & (Q(max_km__gte=min_km) | Q(max_km__isnull=True))
        # 2. Nova faixa termina DENTRO de uma faixa existente (se tiver fim)
        q2 = Q()
        if max_km is not None:
            q2 = Q(min_km__lte=max_km) & (Q(max_km__gte=max_km) | Q(max_km__isnull=True))
        # 3. Nova faixa ENGLOBA uma faixa existente
        q3 = Q(min_km__gte=min_km) & (Q(max_km__lte=max_km) if max_km is not None else Q())

        return queryset.filter(q1 | q2 | q3).exists()

    @action(detail=False, methods=['get'])
    def buscar_por_km(self, request):
        """
        Busca a faixa de KM correspondente a um valor de KM específico.
        Parâmetros query:
        - km: quantidade de KM para buscar a faixa correspondente
        """
        km = request.query_params.get('km')
        if not km:
            return Response({"detail": "Parâmetro 'km' é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            km_valor = int(km)
            if km_valor < 0:
                return Response({"detail": "KM deve ser um valor positivo."}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"detail": "KM deve ser um número inteiro válido."}, status=status.HTTP_400_BAD_REQUEST)

        # Busca a faixa correspondente
        faixa = FaixaKM.objects.filter(
            Q(min_km__lte=km_valor) &
            (Q(max_km__gte=km_valor) | Q(max_km__isnull=True))
        ).order_by('-min_km').first()

        if not faixa:
            return Response({"detail": f"Nenhuma faixa de KM encontrada para {km_valor} KM."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "km_informado": km_valor,
            "faixa": {
                "id": faixa.id,
                "min_km": faixa.min_km,
                "max_km": faixa.max_km,
                "valor_pago": float(faixa.valor_pago)
            }
        })


class PagamentoAgregadoViewSet(ComprovanteDownloadMixin, viewsets.ModelViewSet):
    """API para gerenciar pagamentos a motoristas agregados."""
    queryset = PagamentoAgregado.objects.all().order_by('-data_prevista')
    serializer_class = PagamentoAgregadoSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]
    comprovante_tipo = 'agregados'

    def perform_update(self, serializer):
        """Sincroniza CTeDocumento.pago ao alterar status do pagamento agregado."""
        from ..services.pagamento_service import sincronizar_status_pagamento_agregado
        instance = serializer.save()
        sincronizar_status_pagamento_agregado(instance)

    def get_queryset(self):
        """Permite filtrar pagamentos por diversos parâmetros."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por status
        status_filter = params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filtro por placa
        placa = params.get('placa')
        if placa:
            queryset = queryset.filter(placa=placa)

        # Filtro por período (data_prevista)
        data_inicio = params.get('data_inicio')
        data_fim = params.get('data_fim')
        if data_inicio:
            queryset = queryset.filter(data_prevista__gte=data_inicio)
        if data_fim:
            queryset = queryset.filter(data_prevista__lte=data_fim)

        # Filtro por condutor (CPF)
        condutor_cpf = params.get('condutor_cpf')
        if condutor_cpf:
            queryset = queryset.filter(condutor_cpf=condutor_cpf)

        # Filtro por texto (nome do condutor)
        texto = params.get('q')
        if texto:
            queryset = queryset.filter(condutor_nome__icontains=texto)

        # Filtro por número do CT-e
        cte_numero = params.get('cte_numero')
        if cte_numero:
            queryset = queryset.filter(cte__identificacao__numero=cte_numero)

        # Busca geral (número CT-e, placa ou condutor)
        busca = params.get('busca')
        if busca:
            queryset = queryset.filter(
                Q(cte__identificacao__numero__icontains=busca) |
                Q(placa__icontains=busca) |
                Q(condutor_nome__icontains=busca)
            )

        # Selecionar/Prefetch dados relacionados para otimizar
        queryset = queryset.select_related('cte', 'cte__identificacao')

        return queryset

    @action(detail=False, methods=['post'])
    @transaction.atomic # Garante que a geração seja atômica
    def gerar(self, request):
        """
        Endpoint para gerar registros de pagamentos agregados em lote.

        Usa dados do MDF-e para identificar veículos agregados, pois os CT-es
        não possuem informações de veículos no XML (apenas RNTRC).

        Tipos de proprietário no MDF-e (prop_tp):
        - 0: TAC - Agregado
        - 1: TAC - Independente
        - 2: Outros

        Parâmetros no body:
        - data_inicio: Data inicial para filtrar CT-es (YYYY-MM-DD)
        - data_fim: Data final para filtrar CT-es (YYYY-MM-DD)
        - percentual: Percentual de repasse (opcional, padrão: DEFAULT_PAYMENT_PERCENTAGE = 25%)
        - data_prevista: Data prevista para pagamento (opcional, padrão: hoje)
        - tipo_veiculo: Tipo de proprietário do veículo (opcional, padrão: '0' = Agregado)
                       Valores: '0' (Agregado), '1' (Independente), '2' (Outros), 'todos'
        """
        data_inicio = request.data.get('data_inicio')
        data_fim = request.data.get('data_fim')
        percentual_raw = request.data.get('percentual', float(DEFAULT_PAYMENT_PERCENTAGE))
        data_prevista_str = request.data.get('data_prevista', date.today().isoformat())
        tipo_veiculo = request.data.get('tipo_veiculo', '0')  # Padrão: Agregado

        if not data_inicio or not data_fim:
            return Response({"detail": "Parâmetros data_inicio e data_fim são obrigatórios"},
                           status=status.HTTP_400_BAD_REQUEST)

        # Validação de tipo para percentual
        if not isinstance(percentual_raw, (int, float, str, Decimal)):
            return Response({"detail": "Percentual deve ser um número válido"},
                           status=status.HTTP_400_BAD_REQUEST)

        try:
            data_prevista = datetime.strptime(data_prevista_str, '%Y-%m-%d').date()
            percentual_decimal = Decimal(str(percentual_raw))
            if not (0 < percentual_decimal <= 100):
                raise ValueError("Percentual deve estar entre 0 e 100.")
        except (ValueError, TypeError, InvalidOperation) as e:
            return Response({"detail": f"Parâmetro inválido: {e}"},
                           status=status.HTTP_400_BAD_REQUEST)

        # Buscar CT-es válidos no período que ainda não têm pagamento
        ctes_sem_pagamento = CTeDocumento.objects.filter(
            Q(identificacao__data_emissao__date__gte=data_inicio) &
            Q(identificacao__data_emissao__date__lte=data_fim) &
            Q(processado=True) &
            Q(protocolo__codigo_status=100) &  # Autorizado
            ~Q(cancelamento__c_stat=135) &  # Não cancelado
            ~Exists(PagamentoAgregado.objects.filter(cte=OuterRef('pk')))  # Sem pagamento existente
        ).select_related(
            'prestacao', 'identificacao'
        ).distinct()

        contador = {'criados': 0, 'erros': 0, 'avisos': 0, 'sem_mdfe': 0, 'tipo_diferente': 0}
        erros_detalhados = []
        avisos_detalhados = []

        for cte in ctes_sem_pagamento:
            try:
                # Verificar se CT-e tem prestação
                if not hasattr(cte, 'prestacao') or not cte.prestacao:
                    avisos_detalhados.append(f"CT-e {cte.chave[-8:]}: Sem dados de prestação, ignorado.")
                    contador['avisos'] += 1
                    continue

                # Buscar o MDF-e que transportou este CT-e via MDFeDocumentosVinculados
                doc_vinculado = MDFeDocumentosVinculados.objects.filter(
                    cte_relacionado=cte
                ).select_related('mdfe', 'mdfe__modal_rodoviario').first()

                if not doc_vinculado or not doc_vinculado.mdfe:
                    contador['sem_mdfe'] += 1
                    continue  # CT-e não está em nenhum MDF-e

                mdfe = doc_vinculado.mdfe

                # Buscar veículo de tração do MDF-e via modal_rodoviario
                try:
                    veiculo = mdfe.modal_rodoviario.veiculo_tracao
                except (MDFeVeiculoTracao.DoesNotExist, AttributeError):
                    veiculo = None

                if not veiculo:
                    avisos_detalhados.append(f"CT-e {cte.chave[-8:]}: MDF-e sem veículo de tração.")
                    contador['avisos'] += 1
                    continue

                # Buscar veículo no cadastro do sistema para obter tipo_proprietario correto
                veiculo_cadastro = Veiculo.objects.filter(
                    placa__iexact=normalizar_placa(veiculo.placa)
                ).first()

                # Filtrar por tipo de proprietário usando cadastro do sistema (se disponível)
                # ou fallback para prop_tp do MDF-e
                if tipo_veiculo != 'todos':
                    # Mapeia tipo_proprietario do cadastro para prop_tp do MDF-e
                    # Cadastro: '00'=Próprio, '01'=Arrendado, '02'=Agregado
                    # MDF-e: '0'=TAC-Agregado, '1'=TAC-Independente, '2'=Outros
                    if veiculo_cadastro is not None:
                        # Se veículo está no cadastro, usa tipo do cadastro
                        # '02' (Agregado no cadastro) equivale a '0' (TAC-Agregado no MDF-e)
                        tipo_cadastro = veiculo_cadastro.tipo_proprietario
                        if tipo_veiculo == '0' and tipo_cadastro != '02':
                            # Buscando agregados, mas veículo é próprio ou arrendado
                            contador['tipo_diferente'] += 1
                            continue
                    else:
                        # Sem cadastro, usa prop_tp do MDF-e (comportamento antigo)
                        prop_tp = getattr(veiculo, 'prop_tp', None)
                        if prop_tp != tipo_veiculo:
                            contador['tipo_diferente'] += 1
                            continue

                # Buscar condutor do MDF-e (relacionado diretamente ao mdfe, não ao modal)
                condutor = mdfe.condutores.first()
                condutor_nome = condutor.nome if condutor else (veiculo.prop_razao_social or "Condutor não identificado")
                condutor_cpf = condutor.cpf if condutor else veiculo.prop_cpf

                # Verifica exclusividade mútua com pagamento próprio existente
                erro_exclusividade = _validar_exclusividade_pagamento_cte(cte)
                if erro_exclusividade:
                    contador['erros'] += 1
                    erros_detalhados.append(
                        f"CT-e {cte.chave[-8:]}: {erro_exclusividade.data['detail']}"
                    )
                    continue

                # Criar pagamento usando get_or_create para evitar race condition
                # Se outro request já criou o pagamento para este CT-e, ignora
                pagamento, created = PagamentoAgregado.objects.get_or_create(
                    cte=cte,
                    defaults={
                        'placa': veiculo.placa,
                        'condutor_nome': condutor_nome,
                        'condutor_cpf': condutor_cpf,
                        'valor_frete_total': cte.prestacao.valor_total_prestado,
                        'percentual_repasse': percentual_decimal,
                        # valor_repassado é calculado no save()
                        'data_prevista': data_prevista,
                        'status': 'pendente'
                    }
                )
                if created:
                    contador['criados'] += 1
                    # Notifica gestor de forma assíncrona sobre novo pagamento
                    try:
                        notificar_gestor_pagamento_async.delay(str(pagamento.id), 'agregado')
                    except Exception as exc:
                        logger.warning(
                            "Falha ao enfileirar notificação de pagamento agregado %s: %s",
                            pagamento.id, exc
                        )
                else:
                    # Pagamento já existia (criado por outro request concorrente)
                    contador['avisos'] += 1
                    avisos_detalhados.append(f"CT-e {cte.chave[-8:]}: Pagamento já existe (concorrência).")
            except Exception as e:
                erros_detalhados.append(f"CT-e {cte.chave[-8:]}: {str(e)}")
                contador['erros'] += 1

        # Monta mensagem de resumo
        tipo_desc = {'0': 'Agregado', '1': 'Independente', '2': 'Outros', 'todos': 'Todos'}
        msg_tipo = tipo_desc.get(tipo_veiculo, tipo_veiculo)

        status_final = status.HTTP_201_CREATED if contador['criados'] > 0 else status.HTTP_200_OK
        return Response({
            "message": f"Geração de pagamentos concluída para veículos tipo '{msg_tipo}'.",
            "criados": contador['criados'],
            "erros": contador['erros'],
            "avisos": contador['avisos'],
            "sem_mdfe": contador['sem_mdfe'],
            "tipo_diferente": contador['tipo_diferente'],
            "detalhes_erros": erros_detalhados[:20],  # Limita a 20 para não sobrecarregar
            "detalhes_avisos": avisos_detalhados[:20]
        }, status=status_final)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Exporta os pagamentos agregados filtrados para CSV."""
        queryset = self.get_queryset()
        filename = f"pagamentos_agregados_export_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return csv_response(queryset, self.get_serializer_class(), filename)

    @action(detail=True, methods=['post'], url_path='converter-para-proprio')
    @transaction.atomic
    def converter_para_proprio(self, request, pk=None):
        """
        Converte um pagamento agregado para próprio.
        Remove o registro de agregado e cria um novo registro em próprio,
        mantendo o detalhamento do CT-e.

        Parâmetros no body (opcionais):
        - periodo: Período para o pagamento próprio (AAAA-MM, default: mês da data prevista)
        - ajustes: Valor de ajustes (default: 0)
        """
        pagamento_agregado = self.get_object()

        # Busca o veículo pela placa
        veiculo = Veiculo.objects.filter(
            placa__iexact=normalizar_placa(pagamento_agregado.placa)
        ).first()
        if not veiculo:
            return Response(
                {"detail": f"Veículo com placa {pagamento_agregado.placa} não encontrado no cadastro. Cadastre o veículo primeiro."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Define o período (mês da data prevista ou informado)
        periodo = request.data.get('periodo')
        if not periodo:
            periodo = pagamento_agregado.data_prevista.strftime('%Y-%m')

        # Validação de formato do período
        if not re.match(r'^\d{4}-\d{2}(-[12]Q)?$', periodo):
            return Response(
                {"detail": "Formato de período inválido. Use AAAA-MM ou AAAA-MM-1Q/2Q."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Valor do ajuste
        try:
            ajustes = Decimal(str(request.data.get('ajustes', '0')))
        except (InvalidOperation, TypeError):
            ajustes = Decimal('0.00')

        # Obtém o número do CT-e para registro
        cte_numero = None
        if pagamento_agregado.cte and hasattr(pagamento_agregado.cte, 'identificacao'):
            cte_numero = str(pagamento_agregado.cte.identificacao.numero)

        # Verifica exclusividade mútua antes de criar o pagamento próprio
        # (garante que não existe um pagamento próprio independente para o mesmo CT-e)
        erro_exclusividade = _validar_exclusividade_pagamento_cte(pagamento_agregado.cte)
        if erro_exclusividade:
            return erro_exclusividade

        # Armazena dados necessários antes de remover o agregado
        agregado_cte = pagamento_agregado.cte
        agregado_condutor_nome = pagamento_agregado.condutor_nome
        agregado_condutor_cpf = pagamento_agregado.condutor_cpf
        agregado_data_prevista = pagamento_agregado.data_prevista
        agregado_valor_repassado = pagamento_agregado.valor_repassado
        agregado_status = pagamento_agregado.status
        agregado_data_pagamento = pagamento_agregado.data_pagamento
        agregado_obs = pagamento_agregado.obs

        # Remove o pagamento agregado ANTES de criar o próprio para respeitar a exclusividade mútua
        pagamento_agregado.delete()

        # Sempre cria um novo registro individual (sem agregar)
        pagamento_proprio = PagamentoProprio.objects.create(
            veiculo=veiculo,
            periodo=periodo,
            # Novos campos de detalhamento
            cte=agregado_cte,
            cte_numero=cte_numero,
            motorista_nome=agregado_condutor_nome,
            motorista_cpf=agregado_condutor_cpf,
            data_prevista=agregado_data_prevista,
            # Valores
            km_total_periodo=0,  # Não tem KM associado
            valor_base_faixa=agregado_valor_repassado,
            ajustes=ajustes,
            status=agregado_status,
            data_pagamento=agregado_data_pagamento,
            obs=f"Convertido de Agregado. {agregado_obs or ''}"
        )

        return Response({
            "message": "Pagamento convertido de Agregado para Próprio com sucesso.",
            "pagamento_proprio_id": pagamento_proprio.id,
            "periodo": periodo,
            "cte_numero": cte_numero,
            "motorista": pagamento_proprio.motorista_nome,
            "valor_total": float(pagamento_proprio.valor_total_pagar)
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='notificar-gestor')
    def notificar_gestor(self, request, pk=None):
        """Reenvia notificação WhatsApp para o gestor sobre o pagamento agregado."""
        pagamento = self.get_object()
        resultado = notificar_gestor_pagamento(pagamento, 'agregado')
        http_status = status.HTTP_200_OK if resultado['status'] == 'enviado' else status.HTTP_502_BAD_GATEWAY
        return Response(resultado, status=http_status)

    @action(detail=True, methods=['post'], url_path='reverter-baixa')
    def reverter_baixa(self, request, pk=None):
        """Reverte a baixa de um pagamento agregado, voltando para pendente."""
        pagamento = self.get_object()

        if pagamento.status != 'pago':
            return Response(
                {"detail": "Apenas pagamentos com status 'pago' podem ter a baixa revertida."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Remove comprovante se existir
            if pagamento.comprovante:
                try:
                    pagamento.comprovante.delete(save=False)
                except Exception as e:
                    logger.warning(f"Erro ao remover comprovante do pagamento agregado {pagamento.id}: {e}")
                pagamento.comprovante = None

            pagamento.status = 'pendente'
            pagamento.data_pagamento = None
            pagamento.save(update_fields=['status', 'data_pagamento', 'comprovante'])

            # Sincroniza CT-e
            sincronizar_status_pagamento_agregado(pagamento)

        return Response({
            "message": "Baixa revertida com sucesso.",
            "pagamento_id": str(pagamento.id),
            "status": pagamento.status
        })


class PagamentoProprioViewSet(ComprovanteDownloadMixin, viewsets.ModelViewSet):
    """API para gerenciar pagamentos a motoristas próprios."""
    queryset = PagamentoProprio.objects.all().order_by('-periodo')
    serializer_class = PagamentoProprioSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]
    comprovante_tipo = 'proprios'

    def perform_update(self, serializer):
        """Sincroniza CTeDocumento.pago ao alterar status do pagamento proprio."""
        from ..services.pagamento_service import sincronizar_status_pagamento_proprio
        instance = serializer.save()
        sincronizar_status_pagamento_proprio(instance)

    def get_queryset(self):
        """Permite filtrar pagamentos por diversos parâmetros."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por status
        status_filter = params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filtro por veículo (ID)
        veiculo_id = params.get('veiculo')
        if veiculo_id:
            queryset = queryset.filter(veiculo_id=veiculo_id)

        # Filtro por placa do veículo
        placa = params.get('placa')
        if placa:
            queryset = queryset.filter(veiculo__placa=placa)

        # Filtro por período (exato)
        periodo = params.get('periodo')
        if periodo:
            queryset = queryset.filter(periodo=periodo)

        # Filtro por data (baseado no período AAAA-MM)
        data_inicio = params.get('data_inicio')
        data_fim = params.get('data_fim')
        if data_inicio:
            # Filtra períodos >= data_inicio (comparando strings AAAA-MM)
            periodo_inicio = data_inicio[:7]  # Pega AAAA-MM
            queryset = queryset.filter(periodo__gte=periodo_inicio)
        if data_fim:
            # Filtra períodos <= data_fim
            periodo_fim = data_fim[:7]  # Pega AAAA-MM
            queryset = queryset.filter(periodo__lte=periodo_fim)

        # Filtro por número do CT-e
        cte_numero = params.get('cte_numero')
        if cte_numero:
            queryset = queryset.filter(cte__identificacao__numero=cte_numero)

        # Busca geral (número CT-e, placa ou motorista)
        busca = params.get('busca')
        if busca:
            queryset = queryset.filter(
                Q(cte__identificacao__numero__icontains=busca) |
                Q(veiculo__placa__icontains=busca) |
                Q(motorista_nome__icontains=busca)
            )

        # Selecionar/Prefetch dados relacionados para otimizar
        queryset = queryset.select_related(
            'veiculo',
            'cte',
            'cte__identificacao',
            'cte__remetente',
            'cte__destinatario',
            'cte__prestacao',
        )

        return queryset

    def _calcular_km_periodo(self, veiculo, periodo_str):
        """
        Calcula o KM rodado para um veículo em um período (AAAA-MM ou AAAA-MM-XQ).
        Soma dist_km dos CT-es válidos do veículo no período.
        Retorna 0 em caso de erro ou se não houver CTes.
        """
        try:
            # Extrai ano e mês base do período
            match = re.match(r'(\d{4})-(\d{2})', periodo_str)
            if not match:
                raise ValueError("Formato de período inválido.")
            ano, mes = map(int, match.groups())

            # Determina data de início e fim com base na quinzena/mês
            if periodo_str.endswith('-1Q'): # Primeira quinzena
                data_inicio = date(ano, mes, 1)
                data_fim = date(ano, mes, 15)
            elif periodo_str.endswith('-2Q'): # Segunda quinzena
                 data_inicio = date(ano, mes, 16)
                 if mes == 12:
                     data_fim = date(ano, 12, 31)
                 else:
                      data_fim = date(ano, mes + 1, 1) - timedelta(days=1)
            else: # Mês inteiro
                 data_inicio = date(ano, mes, 1)
                 if mes == 12:
                     data_fim = date(ano, 12, 31)
                 else:
                      data_fim = date(ano, mes + 1, 1) - timedelta(days=1)

            # Soma dist_km dos CT-es válidos do veículo no período
            # Usar Coalesce(Sum(...), 0) para tratar caso de não haver CTes
            from django.db.models.functions import Coalesce
            km_total = CTeDocumento.objects.filter(
                modal_rodoviario__veiculos__placa__iexact=normalizar_placa(veiculo.placa),
                identificacao__data_emissao__date__gte=data_inicio,
                identificacao__data_emissao__date__lte=data_fim,
                processado=True,
                protocolo__codigo_status=100 # Autorizado
            ).exclude(cancelamento__c_stat=135).aggregate( # Não cancelado
                total_km=Coalesce(Sum('identificacao__dist_km'), 0)
            )['total_km']

            return km_total if km_total is not None else 0
        except Exception as e:
            logger.warning(
                "Erro ao calcular KM para %s no período %s: %s",
                veiculo.placa,
                periodo_str,
                e,
            )
            return 0  # Retorna 0 em caso de erro

    @action(detail=False, methods=['post'])
    def calcular_km(self, request):
        """
        Endpoint para calcular a quantidade de KM rodados em um período.
        Retorna o valor base a ser pago de acordo com as faixas cadastradas.
        Parâmetros no body:
        - veiculo_id: ID do veículo (obrigatório)
        - periodo: Período no formato AAAA-MM ou AAAA-MM-XQ (obrigatório)
        - km_total: (Opcional) Quantidade de KM informada manualmente
        """
        veiculo_id = request.data.get('veiculo_id')
        periodo = request.data.get('periodo')
        km_manual = request.data.get('km_total')

        if not veiculo_id or not periodo:
            return Response({"detail": "Parâmetros veiculo_id e periodo são obrigatórios."},
                           status=status.HTTP_400_BAD_REQUEST)

        try:
            veiculo = Veiculo.objects.get(pk=veiculo_id)
        except Veiculo.DoesNotExist:
            return Response({"detail": "Veículo não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        # Validação de formato do período
        if not re.match(r'^\d{4}-\d{2}(-[12]Q)?$', periodo):
            return Response({"detail": "Formato de período inválido. Use AAAA-MM ou AAAA-MM-1Q/2Q."},
                           status=status.HTTP_400_BAD_REQUEST)

        km_total = 0
        fonte_km = "Não calculado"

        # Se km foi informado manualmente, usar esse valor
        if km_manual is not None:
            try:
                km_total = int(km_manual)
                if km_total < 0:
                     raise ValueError("KM deve ser positivo.")
                fonte_km = "Manual"
            except (ValueError, TypeError):
                return Response({"detail": "Valor de km_total inválido."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Cálculo automático de KM
            km_total = self._calcular_km_periodo(veiculo, periodo)
            fonte_km = "Automático (baseado nos CT-es)"

        # Buscar faixa correspondente ao km_total
        try:
            # Ordena por min_km descendente para pegar a faixa mais específica primeiro
            faixa = FaixaKM.objects.filter(
                Q(min_km__lte=km_total) &
                (Q(max_km__gte=km_total) | Q(max_km__isnull=True)) # Inclui faixas sem limite superior
            ).order_by('-min_km').first()

            if not faixa:
                 # Se não achou faixa específica, pega a última cadastrada como fallback? Ou retorna erro?
                 # Retornar erro é mais seguro para evitar pagamentos incorretos.
                 return Response({"detail": f"Nenhuma faixa de KM aplicável encontrada para {km_total} KM."},
                                status=status.HTTP_400_BAD_REQUEST)

            valor_base = faixa.valor_pago

            return Response({
                "km_total": km_total,
                "fonte_km": fonte_km,
                "veiculo": {"id": str(veiculo.id), "placa": veiculo.placa},
                "periodo": periodo,
                "faixa_aplicada": {"id": faixa.id, "min_km": faixa.min_km, "max_km": faixa.max_km, "valor": float(faixa.valor_pago)},
                "valor_base": float(valor_base)
            })

        except Exception as e:
            logger.warning(
                "Erro ao calcular valor base para %s / %s: %s",
                veiculo.placa,
                periodo,
                e,
            )
            return Response({"detail": f"Erro ao calcular valor base: {str(e)}"},
                           status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def gerar(self, request):
        """
        Endpoint para gerar registros de pagamentos próprios em lote.
        Parâmetros no body:
        - periodo: Período no formato AAAA-MM ou AAAA-MM-XQ (alternativo a data_inicio/data_fim)
        - data_inicio: Data inicial (YYYY-MM-DD) - gera períodos mensais no intervalo
        - data_fim: Data final (YYYY-MM-DD) - gera períodos mensais no intervalo
        - veiculos: Lista de IDs de veículos ou "todos" para todos veículos próprios (opcional, default="todos")
        - km_padrao: KM padrão a considerar (opcional, sobrescreve cálculo automático)
        """
        periodo = request.data.get('periodo')
        data_inicio = request.data.get('data_inicio')
        data_fim = request.data.get('data_fim')
        veiculos_param = request.data.get('veiculos', 'todos') # Default "todos"
        km_padrao = request.data.get('km_padrao')

        # Gerar lista de períodos a processar
        periodos_a_processar = []

        if periodo:
            # Usar período direto se fornecido
            if not re.match(r'^\d{4}-\d{2}(-[12]Q)?$', periodo):
                return Response({"detail": "Formato de período inválido. Use AAAA-MM ou AAAA-MM-1Q/2Q."},
                               status=status.HTTP_400_BAD_REQUEST)
            periodos_a_processar = [periodo]
        elif data_inicio and data_fim:
            # Gerar períodos mensais a partir do intervalo de datas
            try:
                dt_inicio = datetime.strptime(data_inicio, '%Y-%m-%d').date()
                dt_fim = datetime.strptime(data_fim, '%Y-%m-%d').date()

                if dt_inicio > dt_fim:
                    return Response({"detail": "Data inicial deve ser menor ou igual à data final."},
                                   status=status.HTTP_400_BAD_REQUEST)

                # Gerar períodos mensais (AAAA-MM) no intervalo
                current = date(dt_inicio.year, dt_inicio.month, 1)
                while current <= dt_fim:
                    periodos_a_processar.append(current.strftime('%Y-%m'))
                    # Próximo mês
                    if current.month == 12:
                        current = date(current.year + 1, 1, 1)
                    else:
                        current = date(current.year, current.month + 1, 1)

            except ValueError as e:
                return Response({"detail": f"Formato de data inválido: {str(e)}. Use YYYY-MM-DD."},
                               status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"detail": "Informe 'periodo' ou 'data_inicio' e 'data_fim'."},
                           status=status.HTTP_400_BAD_REQUEST)

        # Obter veículos
        try:
            if veiculos_param == 'todos':
                # Seleciona veículos próprios (tipo '00') e ativos
                veiculos = Veiculo.objects.filter(tipo_proprietario='00', ativo=True)
            elif isinstance(veiculos_param, list):
                # Seleciona veículos da lista que são próprios e ativos
                veiculos = Veiculo.objects.filter(id__in=veiculos_param, tipo_proprietario='00', ativo=True)
            else:
                 raise ValueError("Parâmetro veiculos deve ser 'todos' ou uma lista de IDs.")
        except ValueError as ve:
             return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.warning("Erro ao buscar veículos: %s", e)
            return Response({"detail": "Erro ao buscar veículos."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not veiculos.exists():
            return Response({"message": "Nenhum veículo próprio e ativo encontrado para processar."},
                           status=status.HTTP_200_OK) # Não é um erro, apenas nada a fazer

        # Validar km_padrao (se fornecido)
        km_total_padrao = None
        if km_padrao is not None:
            try:
                km_total_padrao = int(km_padrao)
                if km_total_padrao < 0:
                    raise ValueError("KM deve ser positivo.")
            except (ValueError, TypeError):
                return Response({"detail": "Valor de km_padrao inválido."},
                               status=status.HTTP_400_BAD_REQUEST)

        resultados = {'criados': 0, 'ignorados': 0, 'erros': 0, 'detalhes': []}

        # Processa cada período e cada veículo
        for periodo_atual in periodos_a_processar:
            for veiculo in veiculos:
                # Verifica se já existe pagamento para este veículo/período
                if PagamentoProprio.objects.filter(veiculo=veiculo, periodo=periodo_atual).exists():
                    resultados['ignorados'] += 1
                    resultados['detalhes'].append({
                        'veiculo': veiculo.placa,
                        'periodo': periodo_atual,
                        'status': 'ignorado',
                        'motivo': 'Pagamento já existe'
                    })
                    continue

                try:
                    # Calcula ou usa KM padrão
                    km_total = km_total_padrao if km_total_padrao is not None else self._calcular_km_periodo(veiculo, periodo_atual)

                    # Busca faixa de KM correspondente
                    faixa = FaixaKM.objects.filter(
                        Q(min_km__lte=km_total) &
                        (Q(max_km__gte=km_total) | Q(max_km__isnull=True))
                    ).order_by('-min_km').first()

                    if not faixa:
                         # Se não há faixa aplicável, não pode gerar o pagamento base
                         raise ValueError(f"Nenhuma faixa de KM encontrada para {km_total} KM.")

                    # Cria o registro de pagamento
                    # data_prevista = último dia do mês do período
                    from datetime import date
                    # periodo_atual é sempre string 'AAAA-MM' ou 'AAAA-MM-XQ'
                    partes = periodo_atual.split('-')
                    ano_prev = int(partes[0])
                    mes_prev = int(partes[1])
                    if mes_prev < 12:
                        data_prevista = date(ano_prev, mes_prev + 1, 1) - timedelta(days=1)
                    else:
                        data_prevista = date(ano_prev, 12, 31)

                    pagamento_proprio = PagamentoProprio.objects.create(
                        veiculo=veiculo,
                        periodo=periodo_atual,
                        km_total_periodo=km_total,
                        valor_base_faixa=faixa.valor_pago,
                        ajustes=Decimal('0.00'), # Ajustes podem ser feitos depois
                        status='pendente',
                        data_prevista=data_prevista,
                        # valor_total_pagar é calculado no save()
                    )
                    resultados['criados'] += 1
                    # Notifica gestor de forma assíncrona sobre novo pagamento
                    try:
                        notificar_gestor_pagamento_async.delay(str(pagamento_proprio.id), 'proprio')
                    except Exception as exc:
                        logger.warning(
                            "Falha ao enfileirar notificação de pagamento próprio %s: %s",
                            pagamento_proprio.id, exc
                        )
                    resultados['detalhes'].append({
                        'veiculo': veiculo.placa,
                        'periodo': periodo_atual,
                        'status': 'criado',
                        'km_total': km_total,
                        'valor_base': float(faixa.valor_pago)
                    })

                except Exception as e:
                    logger.warning(
                        "Erro ao gerar pagamento para %s / %s: %s",
                        veiculo.placa,
                        periodo_atual,
                        e,
                    )
                    resultados['erros'] += 1
                    resultados['detalhes'].append({
                        'veiculo': veiculo.placa,
                        'periodo': periodo_atual,
                        'status': 'erro',
                        'motivo': str(e)
                    })

        periodos_str = ', '.join(periodos_a_processar)
        return Response({
            "message": f"Geração de pagamentos concluída para período(s): {periodos_str}",
            "periodos_processados": periodos_a_processar,
            "criados": resultados['criados'],
            "ignorados": resultados['ignorados'],
            "erros": resultados['erros'],
            "resultados_detalhados": resultados['detalhes']
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Exporta os pagamentos próprios filtrados para CSV."""
        queryset = self.get_queryset()
        filename = f"pagamentos_proprios_export_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return csv_response(queryset, self.get_serializer_class(), filename)

    @action(detail=True, methods=['post'], url_path='converter-para-agregado')
    @transaction.atomic
    def converter_para_agregado(self, request, pk=None):
        """
        Converte um pagamento próprio para agregado.
        Remove o registro de próprio e cria um registro em agregado.

        O valor_total_pagar do pagamento próprio representa o valor líquido a
        pagar ao condutor. Para preservar esse valor financeiro na conversão,
        o percentual de repasse é fixado em 100% e o valor do frete base é
        igual ao valor_total_pagar original.

        Parâmetros no body:
        - cte_id: ID do CT-e para associar (obrigatório)
        - condutor_nome: Nome do condutor (obrigatório)
        - condutor_cpf: CPF do condutor (opcional)
        - data_prevista: Data prevista para pagamento (default: hoje)
        """
        pagamento_proprio = self.get_object()

        # Obtém dados do request
        cte_id = request.data.get('cte_id')
        condutor_nome = request.data.get('condutor_nome')
        condutor_cpf = request.data.get('condutor_cpf', '')

        # Preserva o valor líquido a pagar. Permite informar percentual no request;
        # se não informado, usa 100% para manter o valor_repassado igual ao próprio.
        try:
            percentual_repasse = Decimal(str(request.data.get('percentual_repasse', '100.00')))
        except (InvalidOperation, TypeError, ValueError):
            percentual_repasse = Decimal('100.00')

        data_prevista_str = request.data.get('data_prevista')
        if data_prevista_str:
            try:
                data_prevista = datetime.strptime(data_prevista_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            data_prevista = date.today()

        # Validações
        if not condutor_nome:
            return Response(
                {"detail": "Nome do condutor é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Busca ou valida CT-e
        cte = None
        if cte_id:
            cte = CTeDocumento.objects.filter(pk=cte_id).first()
            if not cte:
                return Response(
                    {"detail": f"CT-e com ID {cte_id} não encontrado."},
                    status=status.HTTP_404_NOT_FOUND
                )
            # Verifica se CT-e já tem pagamento agregado
            if hasattr(cte, 'pagamento_agregado'):
                return Response(
                    {"detail": f"CT-e {cte.chave[-8:]} já possui um pagamento agregado associado."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Se não tem CTE e o modelo exige, não podemos criar
        if not cte:
            return Response({
                "detail": "É necessário informar um CT-e (cte_id) para converter para pagamento agregado.",
                "hint": "O modelo de pagamento agregado requer um CT-e associado."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verifica exclusividade mútua antes de criar o pagamento agregado
        # (garante que não existe um pagamento agregado independente para o mesmo CT-e)
        erro_exclusividade = _validar_exclusividade_pagamento_cte(cte)
        if erro_exclusividade:
            return erro_exclusividade

        # Obtém a placa do veículo
        placa = pagamento_proprio.veiculo.placa

        # O valor_total_pagar do próprio é o líquido a pagar; usa-o como
        # frete base e repasse de 100% para manter o valor_repassado igual.
        valor_frete = pagamento_proprio.valor_total_pagar

        # Armazena dados necessários antes de remover o próprio
        proprio_data_pagamento = pagamento_proprio.data_pagamento
        proprio_status = pagamento_proprio.status
        proprio_periodo = pagamento_proprio.periodo
        proprio_obs = pagamento_proprio.obs

        # Remove o pagamento próprio ANTES de criar o agregado para respeitar a exclusividade mútua
        pagamento_proprio.delete()

        # Cria pagamento agregado
        pagamento_agregado = PagamentoAgregado.objects.create(
            cte=cte,
            placa=placa,
            condutor_nome=condutor_nome,
            condutor_cpf=condutor_cpf,
            valor_frete_total=valor_frete,
            percentual_repasse=percentual_repasse,
            data_prevista=data_prevista,
            data_pagamento=proprio_data_pagamento,
            status=proprio_status,
            obs=f"Convertido de Próprio período {proprio_periodo}. {proprio_obs or ''}"
        )

        return Response({
            "message": "Pagamento convertido de Próprio para Agregado com sucesso.",
            "pagamento_agregado_id": pagamento_agregado.id,
            "cte_chave": cte.chave if cte else None,
            "valor_repassado": float(pagamento_agregado.valor_repassado)
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='notificar-gestor')
    def notificar_gestor(self, request, pk=None):
        """Reenvia notificação WhatsApp para o gestor sobre o pagamento próprio."""
        pagamento = self.get_object()
        resultado = notificar_gestor_pagamento(pagamento, 'proprio')
        http_status = status.HTTP_200_OK if resultado['status'] == 'enviado' else status.HTTP_502_BAD_GATEWAY
        return Response(resultado, status=http_status)

    @action(detail=True, methods=['post'], url_path='reverter-baixa')
    def reverter_baixa(self, request, pk=None):
        """Reverte a baixa de um pagamento próprio, voltando para pendente."""
        pagamento = self.get_object()

        if pagamento.status != 'pago':
            return Response(
                {"detail": "Apenas pagamentos com status 'pago' podem ter a baixa revertida."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Remove comprovante se existir
            if pagamento.comprovante:
                try:
                    pagamento.comprovante.delete(save=False)
                except Exception as e:
                    logger.warning(f"Erro ao remover comprovante do pagamento próprio {pagamento.id}: {e}")
                pagamento.comprovante = None

            pagamento.status = 'pendente'
            pagamento.data_pagamento = None
            pagamento.save(update_fields=['status', 'data_pagamento', 'comprovante'])

            # Sincroniza CT-e
            sincronizar_status_pagamento_proprio(pagamento)

        return Response({
            "message": "Baixa revertida com sucesso.",
            "pagamento_id": str(pagamento.id),
            "status": pagamento.status
        })
