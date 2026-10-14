# transport/views/cte_views.py

# Imports padrão
import csv
from datetime import datetime, timedelta
from io import StringIO

# Imports Django
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Q, Sum, Count, F
from django.utils import timezone
from django.shortcuts import get_object_or_404

# Imports Django REST Framework
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
import logging

logger = logging.getLogger(__name__)

# Imports Locais
from ..permissions import (
    TransportModelPermission,
    CanUpdatePagamentoCTePermission,
    CanEditCTeFreightValuePermission,
    CanDeleteImportedCTePermission,
)
from ..serializers.cte_serializers import (
    CTeDocumentoListSerializer,
    CTeDocumentoDetailSerializer,
    CTeValorFreteManualSerializer,
)

from ..models import (
    CTeDocumento,
    CTeIdentificacao,
    CTeEmitente,
    CTeRemetente,
    CTEDestinatario,
    CTeModalRodoviario,
    CTeVeiculoRodoviario,
    CTeProtocoloAutorizacao,
    CTeCancelamento,
    CTePrestacaoServico,
    CTeComponenteValor,
    FaturaItem,
)
from ..services.parser_cte import parse_cte_completo
from ..services.dacte_generator import gerar_dacte_pdf
from ..services.pagamento_service import atualizar_status_pagamento_cte


def generate_csv_from_queryset(queryset, serializer_class):
    """Gera CSV a partir de um queryset usando um serializer."""
    output = StringIO()
    
    # Se não houver dados, retorna CSV vazio
    if not queryset.exists():
        writer = csv.writer(output)
        writer.writerow(['Nenhum registro encontrado'])
        output.seek(0)
        return output.getvalue()
    
    # Serializa os dados
    serializer = serializer_class(queryset, many=True)
    data = serializer.data
    
    if not data:
        writer = csv.writer(output)
        writer.writerow(['Nenhum registro encontrado'])
        output.seek(0)
        return output.getvalue()
    
    # Obtém os campos do primeiro item e traduz para português
    field_mapping = {
        'id': 'ID',
        'chave': 'Chave de Acesso',
        'numero_cte': 'Número CT-e',
        'serie_cte': 'Série',
        'data_emissao': 'Data Emissão',
        'modalidade': 'Modalidade',
        'remetente_nome': 'Remetente',
        'remetente_cnpj': 'CNPJ Remetente',
        'destinatario_nome': 'Destinatário',
        'destinatario_cnpj': 'CNPJ Destinatário',
        'emitente_nome': 'Emitente',
        'emitente_cnpj': 'CNPJ Emitente',
        'uf_inicio': 'UF Início',
        'uf_fim': 'UF Fim',
        'valor_total': 'Valor Total',
        'valor_recebido': 'Valor a Receber',
        'placa_principal': 'Placa',
        'status': 'Status',
        'protocolo_numero': 'Protocolo',
        'protocolo_data': 'Data Autorização',
        'protocolo_codigo_status': 'Código Status',
        'processado': 'Processado',
        'data_upload': 'Data Upload'
    }
    
    # Campos ordenados para o CSV
    ordered_fields = [
        'chave', 'numero_cte', 'serie_cte', 'data_emissao', 'modalidade',
        'remetente_nome', 'remetente_cnpj', 'destinatario_nome', 'destinatario_cnpj',
        'uf_inicio', 'uf_fim', 'valor_total', 'status', 'protocolo_numero'
    ]
    
    # Filtra apenas os campos que existem nos dados
    available_fields = [f for f in ordered_fields if f in data[0]]
    fieldnames = [field_mapping.get(f, f) for f in available_fields]
    
    # Cria o CSV
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for item in data:
        # Cria row apenas com campos disponíveis
        row = {}
        for field in available_fields:
            value = item.get(field, '')
            # Formata valores especiais
            if field == 'data_emissao' and value:
                try:
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    value = dt.strftime('%d/%m/%Y %H:%M')
                except (ValueError, TypeError):
                    pass  # Mantém valor original se não conseguir parsear
            elif field == 'valor_total' and value:
                try:
                    value = f"R$ {float(value):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                except (ValueError, TypeError):
                    pass  # Mantém valor original se não conseguir converter
            elif field == 'modalidade' and not value:
                value = 'N/I'
            
            row[field_mapping.get(field, field)] = value if value is not None else ''
        
        writer.writerow(row)
    
    output.seek(0)
    return output.getvalue()


# ===============================================================
# ==> APIS PARA CT-e
# ===============================================================

class CTeDocumentoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API para consulta de CT-es.
    
    Endpoints:
    - GET /api/ctes/ - Lista CT-es com filtros
    - GET /api/ctes/{id}/ - Detalhes de um CT-e
    - GET /api/ctes/export/ - Exporta CT-es filtrados para CSV
    - GET /api/ctes/{id}/xml/ - Download do XML do CT-e
    - GET /api/ctes/{id}/dacte/ - Gera DACTE (PDF) do CT-e
    - POST /api/ctes/{id}/reprocessar/ - Reprocessa o CT-e
    - PATCH /api/ctes/{id}/valor-frete/ - Edita o valor negociado do frete
    - DELETE /api/ctes/{id}/excluir/ - Exclui um CT-e sem vínculos bloqueantes
    
    Filtros disponíveis:
    - data_inicio: Data inicial (YYYY-MM-DD)
    - data_fim: Data final (YYYY-MM-DD)
    - modalidade: CIF ou FOB
    - emitente_cnpj: CNPJ do emitente
    - remetente_cnpj: CNPJ do remetente
    - destinatario_cnpj: CNPJ do destinatário
    - uf_ini: UF de início
    - uf_fim: UF de fim
    - placa: Placa do veículo
    - processado: true/false
    - autorizado: true/false
    - cancelado: true/false
    - status: autorizado/cancelado/rejeitado (alternativa mais intuitiva)
    - pago: true/false (status de pagamento)
    - q: Texto para busca geral
    """
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def get_serializer_class(self):
        """Define o serializer com base na ação."""
        if self.action == 'retrieve':
            return CTeDocumentoDetailSerializer
        return CTeDocumentoListSerializer

    def get_queryset(self):
        """
        Retorna queryset filtrado de CT-es.
        
        Otimizações incluídas:
        - select_related para relações 1-1
        - prefetch_related para relações 1-N
        - distinct() para evitar duplicatas
        """
        # Base queryset com otimizações
        queryset = CTeDocumento.objects.select_related(
            'identificacao',
            'emitente',
            'remetente',
            'destinatario',
            'prestacao',
            'protocolo',
            'cancelamento',
            'modal_rodoviario'
        ).prefetch_related(
            'modal_rodoviario__veiculos',
            'prestacao__componentes'
        ).order_by('-data_upload')

        # Parâmetros da query
        params = self.request.query_params

        # Filtro por período (data_emissao)
        data_inicio = params.get('data_inicio')
        data_fim = params.get('data_fim')
        
        if data_inicio:
            try:
                data_inicio_dt = datetime.strptime(data_inicio, '%Y-%m-%d').date()
                queryset = queryset.filter(identificacao__data_emissao__date__gte=data_inicio_dt)
            except ValueError:
                logger.warning(f"Data início inválida: {data_inicio}")
        
        if data_fim:
            try:
                # Adiciona 1 dia para incluir todo o dia final
                data_fim_dt = datetime.strptime(data_fim, '%Y-%m-%d').date() + timedelta(days=1)
                queryset = queryset.filter(identificacao__data_emissao__date__lt=data_fim_dt)
            except ValueError:
                logger.warning(f"Data fim inválida: {data_fim}")

        # Filtro por modalidade (CIF/FOB)
        modalidade = params.get('modalidade')
        if modalidade in ['CIF', 'FOB']:
            queryset = queryset.filter(modalidade=modalidade)

        # Filtros por CNPJ
        emitente_cnpj = params.get('emitente_cnpj')
        if emitente_cnpj:
            queryset = queryset.filter(emitente__cnpj=emitente_cnpj)

        remetente_cnpj = params.get('remetente_cnpj')
        if remetente_cnpj:
            queryset = queryset.filter(remetente__cnpj=remetente_cnpj)

        destinatario_cnpj = params.get('destinatario_cnpj')
        if destinatario_cnpj:
            queryset = queryset.filter(destinatario__cnpj=destinatario_cnpj)

        # Filtros por UF
        uf_ini = params.get('uf_ini')
        if uf_ini:
            queryset = queryset.filter(identificacao__uf_ini=uf_ini)

        uf_fim = params.get('uf_fim')
        if uf_fim:
            queryset = queryset.filter(identificacao__uf_fim=uf_fim)

        # Filtro por placa
        placa = params.get('placa')
        if placa:
            queryset = queryset.filter(
                modal_rodoviario__veiculos__placa__iexact=placa
            ).distinct()

        # Filtro por condutor/motorista (nome ou CPF do vínculo automático)
        condutor = params.get('condutor')
        if condutor:
            queryset = queryset.filter(
                modal_rodoviario__motoristas__nome__icontains=condutor
            ).distinct()
        motorista_cpf = params.get('motorista_cpf')
        if motorista_cpf:
            cpf_digits = ''.join(ch for ch in str(motorista_cpf) if ch.isdigit())
            queryset = queryset.filter(
                modal_rodoviario__motoristas__cpf=cpf_digits
            ).distinct()

        # Filtro por status de processamento
        processado = params.get('processado')
        if processado is not None:
            is_processed = processado.lower() in ['true', '1', 'sim']
            queryset = queryset.filter(processado=is_processed)

        # Filtro por status de autorização
        autorizado = params.get('autorizado')
        if autorizado is not None:
            is_authorized = autorizado.lower() in ['true', '1', 'sim']
            if is_authorized:
                queryset = queryset.filter(protocolo__codigo_status=100)
            else:
                queryset = queryset.filter(
                    Q(protocolo__isnull=True) | ~Q(protocolo__codigo_status=100)
                )

        # Filtro por status de cancelamento
        cancelado = params.get('cancelado')
        if cancelado is not None:
            is_canceled = cancelado.lower() in ['true', '1', 'sim']
            if is_canceled:
                queryset = queryset.filter(cancelamento__c_stat=135)
            else:
                queryset = queryset.filter(
                    Q(cancelamento__isnull=True) | ~Q(cancelamento__c_stat=135)
                )

        # Filtro por status de pagamento
        pago = params.get('pago')
        if pago is not None:
            is_pago = pago.lower() in ['true', '1', 'sim']
            queryset = queryset.filter(pago=is_pago)

        # Filtro por status geral (autorizado/cancelado/rejeitado)
        status_param = params.get('status')
        if status_param:
            status_lower = status_param.lower()
            if status_lower == 'autorizado':
                # Autorizado: protocolo existe e código status = 100, sem cancelamento
                queryset = queryset.filter(
                    protocolo__codigo_status=100
                ).filter(
                    Q(cancelamento__isnull=True) | ~Q(cancelamento__c_stat=135)
                )
            elif status_lower == 'cancelado':
                # Cancelado: tem cancelamento com c_stat = 135
                queryset = queryset.filter(cancelamento__c_stat=135)
            elif status_lower == 'rejeitado':
                # Rejeitado: tem protocolo mas código status != 100, sem cancelamento
                queryset = queryset.filter(
                    protocolo__isnull=False
                ).exclude(
                    protocolo__codigo_status=100
                ).filter(
                    Q(cancelamento__isnull=True) | ~Q(cancelamento__c_stat=135)
                )

        # Filtro por texto (busca geral)
        texto = params.get('q')
        if texto:
            queryset = queryset.filter(
                Q(chave__icontains=texto) |
                Q(identificacao__numero__icontains=texto) |
                Q(remetente__razao_social__icontains=texto) |
                Q(destinatario__razao_social__icontains=texto) |
                Q(emitente__razao_social__icontains=texto) |
                Q(modal_rodoviario__motoristas__nome__icontains=texto)
            ).distinct()

        # Filtro por CT-es ainda não faturados
        nao_faturado = params.get('nao_faturado')
        if nao_faturado is not None:
            is_nao_faturado = nao_faturado.lower() in ('true', '1', 'sim')
            if is_nao_faturado:
                queryset = queryset.filter(faturas_itens__isnull=True)
            else:
                queryset = queryset.filter(faturas_itens__isnull=False).distinct()

        # Ordenação customizada
        ordering = params.get('ordering')
        if ordering:
            # Valida campos de ordenação para evitar injeção
            valid_orderings = [
                'data_upload', '-data_upload',
                'identificacao__data_emissao', '-identificacao__data_emissao',
                'identificacao__numero', '-identificacao__numero',
                'prestacao__valor_total_prestado', '-prestacao__valor_total_prestado'
            ]
            if ordering in valid_orderings:
                queryset = queryset.order_by(ordering)

        return queryset.distinct()

    @action(
        detail=True,
        methods=['patch'],
        url_path='valor-frete',
        permission_classes=[IsAuthenticated, CanEditCTeFreightValuePermission],
    )
    def editar_valor_frete(self, request, pk=None):
        """Sobrescreve o valor efetivo e preserva o valor importado para auditoria."""
        serializer = CTeValorFreteManualSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        novo_valor = serializer.validated_data['valor_total_prestado']

        cte_base = self.get_object()
        with transaction.atomic():
            cte = CTeDocumento.objects.select_for_update().get(pk=cte_base.pk)
            prestacao = CTePrestacaoServico.objects.select_for_update().filter(
                cte=cte
            ).first()
            if prestacao is None:
                return Response(
                    {'detail': 'Este CT-e não possui valor de prestação para editar.'},
                    status=status.HTTP_409_CONFLICT,
                )

            if cte.valor_frete_importado is None:
                cte.valor_frete_importado = prestacao.valor_total_prestado

            prestacao.valor_total_prestado = novo_valor
            prestacao.save(update_fields=['valor_total_prestado'])

            cte.valor_frete_editado_manualmente = True
            cte.valor_frete_editado_por = request.user
            cte.valor_frete_editado_em = timezone.now()
            cte.save(update_fields=[
                'valor_frete_importado',
                'valor_frete_editado_manualmente',
                'valor_frete_editado_por',
                'valor_frete_editado_em',
            ])

        return Response({
            'detail': 'Valor do frete atualizado com sucesso.',
            'valor_total_prestado': str(novo_valor),
            'valor_frete_importado': (
                str(cte.valor_frete_importado)
                if cte.valor_frete_importado is not None
                else None
            ),
            'valor_frete_editado_por': request.user.username,
            'valor_frete_editado_em': cte.valor_frete_editado_em,
        })

    @action(
        detail=True,
        methods=['delete'],
        url_path='excluir',
        permission_classes=[IsAuthenticated, CanDeleteImportedCTePermission],
    )
    def excluir_cte(self, request, pk=None):
        """Exclui um CT-e, impedindo cascatas sobre vínculos de negócio."""
        cte_base = self.get_object()
        with transaction.atomic():
            cte = CTeDocumento.objects.select_for_update().get(pk=cte_base.pk)
            bloqueios = []

            if cte.pago or cte.data_pagamento:
                bloqueios.append('CT-e marcado como pago')
            if hasattr(cte, 'pagamento_agregado'):
                bloqueios.append('pagamento de agregado')
            if hasattr(cte, 'pagamento_proprio'):
                bloqueios.append('pagamento de motorista próprio')
            if cte.faturas_itens.exists():
                bloqueios.append('item de fatura')
            if cte.ordens_viagem.exists():
                bloqueios.append('ordem de viagem')
            if cte.ciots.exists():
                bloqueios.append('CIOT')
            if cte.mdfe_transportador.exists():
                bloqueios.append('MDF-e')

            if bloqueios:
                return Response(
                    {
                        'detail': (
                            'O CT-e não pode ser excluído enquanto possuir vínculos: '
                            + ', '.join(bloqueios)
                            + '.'
                        ),
                        'bloqueios': bloqueios,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            cte.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """
        Exporta os CT-es filtrados para CSV.
        
        Usa os mesmos filtros da listagem.
        Retorna arquivo CSV com encoding UTF-8 BOM para Excel.
        """
        # Obtém queryset filtrado
        queryset = self.get_queryset()
        
        # Limita a quantidade de registros para evitar timeout
        max_export = 10000
        if queryset.count() > max_export:
            return Response(
                {"detail": f"Limite de exportação excedido. Máximo {max_export} registros."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Gera o CSV
        csv_content = generate_csv_from_queryset(queryset, CTeDocumentoListSerializer)
        
        # Prepara a resposta HTTP
        filename = f"ctes_export_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        # Adiciona BOM para UTF-8 (melhora compatibilidade com Excel)
        response.write('\ufeff')
        response.write(csv_content)
        
        return response

    @action(detail=True, methods=['get'])
    def xml(self, request, pk=None):
        """
        Download do XML original do CT-e.
        
        Retorna o arquivo XML com o nome correto.
        """
        cte = self.get_object()

        if not cte.xml_original:
            return Response(
                {"detail": "XML não disponível para este CT-e."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Determina o encoding do XML
        encoding = 'utf-8'
        if cte.xml_original.startswith('<?xml') and 'encoding=' in cte.xml_original[:100]:
            try:
                start = cte.xml_original.index('encoding="') + 10
                end = cte.xml_original.index('"', start)
                encoding = cte.xml_original[start:end].lower()
            except (ValueError, IndexError):
                pass  # Usa encoding padrão UTF-8 se não encontrar

        # Retorna o XML
        response = HttpResponse(
            cte.xml_original,
            content_type=f'application/xml; charset={encoding}'
        )
        response['Content-Disposition'] = f'attachment; filename="CTe_{cte.chave}.xml"'
        
        return response

    @action(detail=True, methods=['get'])
    def dacte(self, request, pk=None):
        """
        Gera o DACTE (PDF) do CT-e.
        
        Atualmente retorna JSON com dados para implementação futura.
        Em produção, deve gerar PDF real usando biblioteca apropriada.
        """
        cte = self.get_object()

        # Validações
        if not hasattr(cte, 'protocolo') or not cte.protocolo:
            return Response(
                {"detail": "CT-e não possui protocolo de autorização."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if cte.protocolo.codigo_status != 100:
            return Response(
                {"detail": f"CT-e não autorizado. Status: {cte.protocolo.codigo_status}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if hasattr(cte, 'cancelamento') and cte.cancelamento and cte.cancelamento.c_stat == 135:
            return Response(
                {"detail": "CT-e cancelado. DACTE não disponível."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Gera o PDF do DACTE
        try:
            # Gera o PDF
            pdf_content = gerar_dacte_pdf(cte)
            
            # Prepara a resposta HTTP
            response = HttpResponse(pdf_content, content_type='application/pdf')
            
            # Define o nome do arquivo e como será exibido
            # 'inline' exibe no navegador, 'attachment' força download
            disposition = request.GET.get('download', 'inline')
            if disposition not in ['inline', 'attachment']:
                disposition = 'inline'
                
            filename = f"DACTE_{cte.chave}.pdf"
            response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
            
            # Headers adicionais para cache
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            
            # Log de sucesso
            logger.info(f"DACTE gerado com sucesso para CT-e {cte.chave}")
            
            return response
            
        except Exception as e:
            logger.error(f"Erro ao gerar DACTE: {str(e)}", exc_info=True)
            
            # Em caso de erro, retorna os dados em JSON como fallback
            identificacao = cte.identificacao
            emitente = cte.emitente
            remetente = cte.remetente
            destinatario = cte.destinatario
            prestacao = cte.prestacao if hasattr(cte, 'prestacao') else None
            
            # Monta resposta com dados essenciais
            dacte_data = {
                "tipo": "DACTE_PREVIEW",
                "mensagem": "Geração de PDF em implementação. Dados do DACTE:",
                "cte": {
                    "chave": cte.chave,
                    "numero": identificacao.numero,
                    "serie": identificacao.serie,
                    "modelo": identificacao.modelo,
                    "data_emissao": identificacao.data_emissao.strftime('%d/%m/%Y %H:%M:%S'),
                    "natureza_operacao": identificacao.natureza_operacao,
                    "tipo_cte": identificacao.tipo_cte,
                    "modal": identificacao.modal,
                    "tipo_servico": identificacao.tipo_servico,
                    "cfop": identificacao.cfop,
                    "inicio_prestacao": {
                        "municipio": identificacao.nome_mun_ini,
                        "uf": identificacao.uf_ini
                    },
                    "fim_prestacao": {
                        "municipio": identificacao.nome_mun_fim,
                        "uf": identificacao.uf_fim
                    }
                },
                "emitente": {
                    "cnpj": emitente.cnpj,
                    "ie": emitente.ie,
                    "razao_social": emitente.razao_social,
                    "nome_fantasia": emitente.nome_fantasia,
                    "endereco": {
                        "logradouro": emitente.logradouro,
                        "numero": emitente.numero,
                        "bairro": emitente.bairro,
                        "municipio": emitente.nome_municipio,
                        "uf": emitente.uf,
                        "cep": emitente.cep
                    },
                    "telefone": emitente.telefone
                } if emitente else None,
                "remetente": {
                    "cnpj": remetente.cnpj or remetente.cpf,
                    "ie": remetente.ie,
                    "razao_social": remetente.razao_social,
                    "endereco": {
                        "logradouro": remetente.logradouro,
                        "numero": remetente.numero,
                        "municipio": remetente.nome_municipio,
                        "uf": remetente.uf
                    }
                } if remetente else None,
                "destinatario": {
                    "cnpj": destinatario.cnpj or destinatario.cpf,
                    "ie": destinatario.ie,
                    "razao_social": destinatario.razao_social,
                    "endereco": {
                        "logradouro": destinatario.logradouro,
                        "numero": destinatario.numero,
                        "municipio": destinatario.nome_municipio,
                        "uf": destinatario.uf
                    }
                } if destinatario else None,
                "valores": {
                    "valor_total": float(prestacao.valor_total_prestado),
                    "valor_receber": float(prestacao.valor_recebido),
                    "componentes": [
                        {
                            "nome": comp.nome,
                            "valor": float(comp.valor)
                        } for comp in prestacao.componentes.all()
                    ] if prestacao else []
                } if prestacao else None,
                "protocolo": {
                    "numero": cte.protocolo.numero_protocolo,
                    "data": cte.protocolo.data_recebimento.strftime('%d/%m/%Y %H:%M:%S'),
                    "codigo_status": cte.protocolo.codigo_status,
                    "motivo": cte.protocolo.motivo_status
                },
                "modalidade_frete": cte.modalidade or "N/I",
                "qrcode_url": cte.suplementar.qr_code_url if hasattr(cte, 'suplementar') and cte.suplementar else None
            }
            
            return Response(dacte_data)
            
        except Exception as e:
            logger.exception("Erro ao preparar dados do DACTE: %s", e)
            return Response(
                {"detail": "Erro ao processar dados do DACTE."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def reprocessar(self, request, pk=None):
        """
        Reprocessa o XML do CT-e.
        
        Útil quando houve alteração no parser ou erro no processamento inicial.
        Requer que o XML original esteja disponível.
        """
        cte = self.get_object()

        # Validações
        if not cte.xml_original:
            return Response(
                {"detail": "XML original não encontrado. Reprocessamento impossível."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if hasattr(cte, 'cancelamento') and cte.cancelamento:
            return Response(
                {"detail": "CT-e cancelado não pode ser reprocessado."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Log da operação
        logger.info(f"Iniciando reprocessamento do CT-e {cte.chave} por {request.user}")

        # Reset do status
        cte.processado = False
        cte.save(update_fields=['processado'])

        try:
            # Executa o parser
            resultado = parse_cte_completo(cte)
            
            if resultado:
                # Atualiza timestamp
                cte.refresh_from_db()
                
                # Prepara resposta com novo status
                response_data = {
                    "message": "CT-e reprocessado com sucesso.",
                    "cte": {
                        "chave": cte.chave,
                        "processado": cte.processado,
                        "numero": cte.identificacao.numero if hasattr(cte, 'identificacao') else None,
                        "data_emissao": cte.identificacao.data_emissao.isoformat() if hasattr(cte, 'identificacao') else None,
                        "status": "Autorizado" if hasattr(cte, 'protocolo') and cte.protocolo and cte.protocolo.codigo_status == 100 else "Pendente"
                    }
                }
                
                logger.info(f"CT-e {cte.chave} reprocessado com sucesso")
                return Response(response_data)
            else:
                logger.error(f"Parser retornou False para CT-e {cte.chave}")
                return Response(
                    {"detail": "Falha no reprocessamento. Verifique se o XML está válido."},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY
                )
                
        except Exception as e:
            logger.error(f"Erro ao reprocessar CT-e {cte.chave}: {str(e)}", exc_info=True)
            
            # Garante que fica marcado como não processado
            CTeDocumento.objects.filter(pk=cte.pk).update(processado=False)
            
            return Response(
                {"detail": f"Erro durante o reprocessamento: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, CanUpdatePagamentoCTePermission])
    def pagamento(self, request, pk=None):
        """
        Atualiza o status de pagamento de um CT-e.

        Permite ao admin marcar o CT-e como pago ou não pago.

        Parâmetros aceitos:
        - pago: boolean (obrigatório)
        - data_pagamento: string YYYY-MM-DD (opcional, usa data atual se não informado)
        - observacao_pagamento: string (opcional)
        - comprovante: arquivo (opcional, PDF ou imagem)

        Exemplo de uso:
        PATCH /api/ctes/{id}/pagamento/
        Body: {"pago": true, "data_pagamento": "2024-12-15", "observacao_pagamento": "Pago via transferência"}
        Ou multipart/form-data com arquivo comprovante
        """
        cte = self.get_object()

        # Valida se o parâmetro 'pago' foi enviado
        pago = request.data.get('pago')
        if pago is None:
            return Response(
                {"detail": "O campo 'pago' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Converte para booleano se necessário
        if isinstance(pago, str):
            pago = pago.lower() in ['true', '1', 'sim']

        # Define a data de pagamento
        from datetime import datetime
        data_pagamento = None
        if pago:
            data_pagamento_str = request.data.get('data_pagamento')
            if data_pagamento_str:
                try:
                    data_pagamento = datetime.strptime(data_pagamento_str, '%Y-%m-%d').date()
                except ValueError:
                    data_pagamento = timezone.now().date()
            else:
                data_pagamento = timezone.now().date()

        # Atualiza observação se fornecida
        observacao = request.data.get('observacao_pagamento')

        # Atualiza comprovante se fornecido
        comprovante = request.FILES.get('comprovante')

        # Usa o servico centralizado para sincronizar CT-e e pagamentos vinculados
        atualizar_status_pagamento_cte(
            cte,
            pago=pago,
            data_pagamento=data_pagamento,
            comprovante=comprovante,
            observacao=observacao,
        )

        # Log da operação
        logger.info(f"CT-e {cte.chave} marcado como {'pago' if pago else 'não pago'} por {request.user}")

        # Retorna os dados atualizados
        return Response({
            "message": f"CT-e {'marcado como pago' if pago else 'marcado como não pago'} com sucesso.",
            "id": cte.id,
            "chave": cte.chave,
            "pago": cte.pago,
            "data_pagamento": cte.data_pagamento.isoformat() if cte.data_pagamento else None,
            "observacao_pagamento": cte.observacao_pagamento,
            "comprovante_pagamento": cte.comprovante_pagamento.url if cte.comprovante_pagamento else None
        })

    @action(detail=False, methods=['get'])
    def estatisticas(self, request):
        """
        Retorna estatísticas gerais dos CT-es.

        Útil para dashboards e relatórios.
        """
        queryset = self.get_queryset()
        
        # Calcula estatísticas
        stats = queryset.aggregate(
            total=Count('id'),
            processados=Count('id', filter=Q(processado=True)),
            autorizados=Count('id', filter=Q(protocolo__codigo_status=100)),
            cancelados=Count('id', filter=Q(cancelamento__c_stat=135)),
            valor_total=Sum('prestacao__valor_total_prestado'),
            valor_receber=Sum('prestacao__valor_recebido')
        )
        
        # Estatísticas por modalidade
        por_modalidade = queryset.values('modalidade').annotate(
            quantidade=Count('id'),
            valor_total=Sum('prestacao__valor_total_prestado')
        ).order_by('modalidade')
        
        # Estatísticas por UF
        por_uf = queryset.values('identificacao__uf_fim').annotate(
            quantidade=Count('id'),
            valor_total=Sum('prestacao__valor_total_prestado')
        ).order_by('-quantidade')[:10]
        
        return Response({
            "resumo": {
                "total": stats['total'] or 0,
                "processados": stats['processados'] or 0,
                "autorizados": stats['autorizados'] or 0,
                "cancelados": stats['cancelados'] or 0,
                "valor_total": float(stats['valor_total'] or 0),
                "valor_receber": float(stats['valor_receber'] or 0)
            },
            "por_modalidade": list(por_modalidade),
            "top_destinos": list(por_uf)
        })

    @action(detail=False, methods=['get'])
    def pagamentos_pendentes(self, request):
        """
        Retorna resumo de CT-es com pagamentos pendentes.

        Filtros disponíveis:
        - data_inicio: Data inicial (YYYY-MM-DD)
        - data_fim: Data final (YYYY-MM-DD)
        - modalidades: Lista de modalidades separadas por vírgula (ex: CIF,FOB)
        - remetentes: Lista de razões sociais separadas por vírgula
        - destinatarios: Lista de razões sociais separadas por vírgula
        - tipo_pendencia: 'cliente' (padrao), 'motorista' ou 'todos'
          * cliente: CT-es com CTeDocumento.pago=False
          * motorista: CT-es com pagamento agregado/proprio pendente
          * todos: uniao dos dois

        Retorna:
        - Totais gerais (quantidade e valor)
        - Distribuição por modalidade
        - Top clientes com mais pendências
        - Lista dos CT-es pendentes mais recentes
        - Listas de remetentes e destinatários para filtros
        """
        params = request.query_params
        tipo_pendencia = params.get('tipo_pendencia', 'cliente').lower()

        # Base: CT-es nao cancelados
        base_queryset = self.get_queryset().filter(
            Q(cancelamento__isnull=True) | ~Q(cancelamento__c_stat=135)
        ).exclude(
            eventos__tipo_evento='110111',
            eventos__confirmado=True,
        )

        # Filtra por tipo de pendencia
        if tipo_pendencia == 'cliente':
            queryset = base_queryset.filter(pago=False)
        elif tipo_pendencia == 'motorista':
            queryset = base_queryset.filter(
                Q(pagamento_agregado__status='pendente') |
                Q(pagamento_proprio__status='pendente')
            ).distinct()
        elif tipo_pendencia == 'todos':
            queryset = base_queryset.filter(
                Q(pago=False) |
                Q(pagamento_agregado__status='pendente') |
                Q(pagamento_proprio__status='pendente')
            ).distinct()
        else:
            queryset = base_queryset.filter(pago=False)

        # Guarda queryset base para obter listas de filtros
        queryset_base = queryset

        # Aplica filtros adicionais
        params = request.query_params

        # Filtro por modalidades (múltiplas, separadas por vírgula)
        modalidades = params.get('modalidades', '').strip()
        if modalidades:
            modalidades_list = [m.strip().upper() for m in modalidades.split(',') if m.strip()]
            if modalidades_list:
                queryset = queryset.filter(modalidade__in=modalidades_list)

        # Filtro por remetentes (múltiplos, separados por vírgula)
        remetentes = params.get('remetentes', '').strip()
        if remetentes:
            remetentes_list = [r.strip() for r in remetentes.split(',') if r.strip()]
            if remetentes_list:
                queryset = queryset.filter(remetente__razao_social__in=remetentes_list)

        # Filtro por destinatários (múltiplos, separados por vírgula)
        destinatarios = params.get('destinatarios', '').strip()
        if destinatarios:
            destinatarios_list = [d.strip() for d in destinatarios.split(',') if d.strip()]
            if destinatarios_list:
                queryset = queryset.filter(destinatario__razao_social__in=destinatarios_list)

        # Calcula estatísticas gerais
        stats = queryset.aggregate(
            total_pendentes=Count('id'),
            valor_total_pendente=Sum('prestacao__valor_total_prestado'),
            valor_receber_pendente=Sum('prestacao__valor_recebido')
        )

        # Distribuição por modalidade
        por_modalidade = queryset.values('modalidade').annotate(
            quantidade=Count('id'),
            valor=Sum('prestacao__valor_total_prestado')
        ).order_by('modalidade')

        # Top clientes com mais pendências (por remetente)
        top_clientes = queryset.values(
            'remetente__razao_social',
            'remetente__cnpj'
        ).annotate(
            quantidade=Count('id'),
            valor_total=Sum('prestacao__valor_total_prestado')
        ).order_by('-valor_total')[:10]

        # CT-es pendentes (todos, ordenados por data mais recente)
        ctes_recentes = queryset.order_by('-identificacao__data_emissao')
        ctes_recentes_data = []
        for cte in ctes_recentes:
            ctes_recentes_data.append({
                'id': str(cte.id),
                'numero': cte.identificacao.numero if hasattr(cte, 'identificacao') and cte.identificacao else None,
                'chave': cte.chave,
                'data_emissao': cte.identificacao.data_emissao.strftime('%d/%m/%Y') if hasattr(cte, 'identificacao') and cte.identificacao and cte.identificacao.data_emissao else None,
                'remetente': cte.remetente.razao_social if hasattr(cte, 'remetente') and cte.remetente else None,
                'destinatario': cte.destinatario.razao_social if hasattr(cte, 'destinatario') and cte.destinatario else None,
                'valor': float(cte.prestacao.valor_total_prestado) if hasattr(cte, 'prestacao') and cte.prestacao and cte.prestacao.valor_total_prestado else 0,
                'modalidade': cte.modalidade
            })

        # Estatísticas de CT-es pagos para comparação
        pagos_stats = self.get_queryset().filter(pago=True).aggregate(
            total_pagos=Count('id'),
            valor_total_pago=Sum('prestacao__valor_total_prestado')
        )

        # Listas distintas para filtros (usando queryset_base sem filtros aplicados)
        remetentes_distintos = list(
            queryset_base.exclude(remetente__razao_social__isnull=True)
            .values_list('remetente__razao_social', flat=True)
            .distinct()
            .order_by('remetente__razao_social')[:100]  # Limita a 100 para performance
        )

        destinatarios_distintos = list(
            queryset_base.exclude(destinatario__razao_social__isnull=True)
            .values_list('destinatario__razao_social', flat=True)
            .distinct()
            .order_by('destinatario__razao_social')[:100]
        )

        modalidades_distintas = list(
            queryset_base.exclude(modalidade__isnull=True)
            .values_list('modalidade', flat=True)
            .distinct()
            .order_by('modalidade')
        )

        # Taxa de pagamento por quantidade e por valor
        total_ctes = (pagos_stats['total_pagos'] or 0) + (stats['total_pendentes'] or 0)
        valor_pago = float(pagos_stats['valor_total_pago'] or 0)
        valor_pendente = float(stats['valor_total_pendente'] or 0)
        taxa_paga_quantidade = (
            (pagos_stats['total_pagos'] or 0) / total_ctes * 100
            if total_ctes > 0 else 0
        )
        taxa_paga_valor = (
            valor_pago / (valor_pago + valor_pendente) * 100
            if (valor_pago + valor_pendente) > 0 else 0
        )

        return Response({
            "resumo": {
                "total_pendentes": stats['total_pendentes'] or 0,
                "valor_total_pendente": valor_pendente,
                "valor_receber_pendente": float(stats['valor_receber_pendente'] or 0),
                "total_pagos": pagos_stats['total_pagos'] or 0,
                "valor_total_pago": valor_pago,
                "taxa_paga_quantidade": round(taxa_paga_quantidade, 1),
                "taxa_paga_valor": round(taxa_paga_valor, 1)
            },
            "por_modalidade": [
                {
                    "modalidade": item['modalidade'] or 'N/I',
                    "quantidade": item['quantidade'],
                    "valor": float(item['valor'] or 0)
                } for item in por_modalidade
            ],
            "top_clientes_pendentes": [
                {
                    "razao_social": item['remetente__razao_social'] or 'N/I',
                    "cnpj": item['remetente__cnpj'] or '',
                    "quantidade": item['quantidade'],
                    "valor_total": float(item['valor_total'] or 0)
                } for item in top_clientes
            ],
            "ctes_pendentes_recentes": ctes_recentes_data,
            "filtros_disponiveis": {
                "remetentes": remetentes_distintos,
                "destinatarios": destinatarios_distintos,
                "modalidades": modalidades_distintas
            }
        })

    @action(detail=True, methods=['post'], url_path='cancelar')
    def cancelar(self, request, pk=None):
        """
        Registra cancelamento lógico do CT-e.
        Em produção, deve integrar com SEFAZ antes de alterar o status.
        """
        cte = self.get_object()
        motivo = request.data.get('motivo') or request.data.get('justificativa', 'Cancelamento solicitado pelo usuário')

        if cte.status == 'cancelado':
            return Response(
                {'erro': 'CT-e já está cancelado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cria registro de cancelamento (modelo existente)
        from ..models import CTeCancelamento
        c_orgao = cte.identificacao.codigo_uf if hasattr(cte, 'identificacao') and cte.identificacao else '35'
        n_prot = cte.protocolo.numero_protocolo if hasattr(cte, 'protocolo') and cte.protocolo else '0'
        cnpj_emit = ''
        if hasattr(cte, 'emitente') and cte.emitente:
            cnpj_emit = cte.emitente.cnpj or ''

        CTeCancelamento.objects.update_or_create(
            cte=cte,
            defaults={
                'id_evento': f'ID110111{cte.chave}01',
                'c_orgao': c_orgao,
                'tp_amb': 2,
                'cnpj': cnpj_emit,
                'dh_evento': timezone.now(),
                'tp_evento': '110111',
                'n_prot_original': n_prot,
                'x_just': motivo,
                'c_stat': 135,
                'x_motivo': 'Cancelamento registrado no sistema',
                'dh_reg_evento': timezone.now(),
            }
        )

        cte.status = 'cancelado'
        cte.save(update_fields=['status'])

        return Response({
            'status': 'cancelado',
            'id': str(cte.id),
            'chave': cte.chave,
            'motivo': motivo,
            'observacao': 'Status alterado para cancelado. Integração SEFAZ não realizada neste ambiente.'
        })
