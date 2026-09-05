# transport/views/config_views.py

# Imports padrão
import os
import json
import csv
import subprocess
import tempfile
import hashlib
import shutil
import shlex
import traceback
from io import StringIO, BytesIO
import openpyxl
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from datetime import datetime
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

# Imports Django
from django.http import HttpResponse, JsonResponse, FileResponse
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

# Imports Django REST Framework
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser # IsAdminUser pode ser útil aqui
from rest_framework import serializers # Para ValidationError

# Imports Locais
from ..permissions import CapabilityPermission, TransportModelPermission
from ..services.backup_service import resolve_registered_backup_path
from ..serializers.config_serializers import ( # Use .. para voltar um nível
    ParametroSistemaSerializer,
    ConfiguracaoEmpresaSerializer,
    RegistroBackupSerializer,
    # Adicionar serializers de relatórios se/quando criados
)
from ..serializers.vehicle_serializers import VeiculoSerializer, ManutencaoVeiculoSerializer
from ..serializers.payment_serializers import PagamentoAgregadoSerializer, PagamentoProprioSerializer
from ..models import (
    ParametroSistema,
    ConfiguracaoEmpresa,
    RegistroBackup,
    Veiculo,
    CTePrestacaoServico,
    CTeDocumento,
    CTeIdentificacao,
    MDFeDocumento,
    MDFeIdentificacao,
    PagamentoAgregado,
    PagamentoProprio,
    ManutencaoVeiculo,
    Motorista,
)

# ===============================================================
# ==> APIS PARA CONFIGURAÇÃO DO SISTEMA
# ===============================================================

class ParametroSistemaViewSet(viewsets.ModelViewSet):
    """
    API para gerenciar parâmetros do sistema.
    Usuários do grupo Administrativo podem modificar; demais usuários autenticados
    podem apenas consultar.
    """
    queryset = ParametroSistema.objects.all().order_by('grupo', 'nome')
    serializer_class = ParametroSistemaSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def get_queryset(self):
        """Permite filtrar parâmetros por grupo e editabilidade."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por grupo
        grupo = params.get('grupo')
        if grupo:
            queryset = queryset.filter(grupo=grupo)

        # Filtro por editável
        editavel = params.get('editavel')
        if editavel is not None:
            queryset = queryset.filter(editavel=editavel.lower() == 'true')

        return queryset

    @action(detail=False, methods=['get'])
    def valores(self, request):
        """
        Retorna valores simplificados dos parâmetros (nome: valor_tipado)
        no formato adequado para uso direto no frontend.
        Acessível para qualquer usuário autenticado.
        """
        grupo = request.query_params.get('grupo')
        queryset = self.get_queryset() # Aplica filtros de grupo/editavel se presentes

        if grupo:
            queryset = queryset.filter(grupo=grupo)

        # Obter parâmetros e seus valores tipados
        parametros = {}
        for param in queryset:
            parametros[param.nome] = param.get_valor_tipado()

        return Response(parametros)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, TransportModelPermission])
    @transaction.atomic # Garante atomicidade na atualização múltipla
    def atualizar_multiplos(self, request):
        """
        Atualiza múltiplos parâmetros em uma única requisição.
        Apenas para Admins.
        Formato esperado no body:
        {
            "parametros": {
                "NOME_PARAM1": "valor1",
                "NOME_PARAM2": "valor2",
                ...
            }
        }
        """
        parametros_data = request.data.get('parametros', {})

        if not parametros_data or not isinstance(parametros_data, dict):
            return Response({"detail": "Formato inválido. Esperado: {'parametros': {nome: valor, ...}}"},
                           status=status.HTTP_400_BAD_REQUEST)

        atualizados = []
        erros = []

        # Itera sobre os parâmetros enviados para atualização
        for nome, valor in parametros_data.items():
            try:
                # Busca o parâmetro pelo nome
                param = ParametroSistema.objects.select_for_update().get(nome=nome) # Lock para atomicidade

                # Verificar se o parâmetro é editável
                if not param.editavel:
                    erros.append({'nome': nome, 'erro': "Este parâmetro não é editável."})
                    continue

                # Tenta validar e salvar o novo valor (converte para string como no modelo)
                # Idealmente, a validação do tipo ocorreria aqui se necessário
                valor_str = str(valor)
                param.valor = valor_str
                # Validação do modelo (opcional, mas bom)
                # param.full_clean(exclude=['nome']) # Exclui nome pois não estamos mudando
                param.save()

                atualizados.append({
                    'nome': nome,
                    'valor': valor_str,
                    'valor_tipado': param.get_valor_tipado() # Mostra o valor convertido
                })

            except ParametroSistema.DoesNotExist:
                erros.append({'nome': nome, 'erro': "Parâmetro não encontrado."})
            except ValidationError as ve: # Captura erros de validação do Django
                 erros.append({'nome': nome, 'erro': str(ve)})
            except Exception as e:
                logger.warning("Erro ao atualizar parâmetro %s: %s", nome, e)
                erros.append({'nome': nome, 'erro': f"Erro inesperado: {str(e)}"})

        # Se houve erros, a transação será revertida pelo @transaction.atomic
        # Se não houve erros (ou os erros foram apenas avisos), a transação será commitada

        response_status = status.HTTP_200_OK if not erros else status.HTTP_400_BAD_REQUEST
        return Response({
            'message': f"Atualização concluída. {len(atualizados)} atualizados, {len(erros)} com erro.",
            'atualizados': atualizados,
            'erros': erros,
        }, status=response_status)


class ConfiguracaoEmpresaViewSet(viewsets.ModelViewSet):
    """
    API para gerenciar configurações da empresa (dados da empresa usuária).
    Usuários do grupo Administrativo podem modificar; demais usuários autenticados
    podem apenas consultar.
    """
    queryset = ConfiguracaoEmpresa.objects.all()
    serializer_class = ConfiguracaoEmpresaSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def list(self, request, *args, **kwargs):
        """
        Retorna a configuração da empresa (espera-se apenas uma).
        Se não existir, retorna um objeto vazio ou um status 404.
        """
        configuracao = ConfiguracaoEmpresa.objects.first() # Pega a primeira (e única)
        if not configuracao:
            # Retorna 404 se nenhuma configuração foi criada ainda
            return Response({"detail": "Configuração da empresa não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(configuracao)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """
        Cria OU Atualiza a configuração da empresa.
        Garante que apenas uma instância exista.
        """
        configuracao_existente = ConfiguracaoEmpresa.objects.first()
        serializer = self.get_serializer(instance=configuracao_existente, data=request.data, partial=bool(configuracao_existente))

        serializer.is_valid(raise_exception=True)
        serializer.save()

        status_code = status.HTTP_200_OK if configuracao_existente else status.HTTP_201_CREATED
        return Response(serializer.data, status=status_code)

    # Desabilitar retrieve, update, destroy padrão pois tratamos tudo via list/create
    def retrieve(self, request, *args, **kwargs):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def update(self, request, *args, **kwargs):
         return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
         return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)


# ===============================================================
# ==> APIS PARA BACKUP E RESTAURAÇÃO
# ===============================================================

class BackupAPIView(viewsets.ViewSet):
    """
    API para gerenciar backups do banco de dados do sistema.
    Ações disponíveis: list, gerar, download, restaurar (simulado).
    Permissões: Apenas usuários do grupo Administrativo.
    """
    permission_classes = [IsAuthenticated, TransportModelPermission] # Apenas Administrativo
    queryset = RegistroBackup.objects.all()
    serializer_class = RegistroBackupSerializer

    def list(self, request):
        """Listar backups registrados no banco de dados."""
        try:
            registros = RegistroBackup.objects.all().order_by('-data_hora')
            serializer = RegistroBackupSerializer(registros, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.warning("Erro ao listar backups: %s", e)
            return Response({"detail": f"Erro interno ao listar backups: {str(e)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def gerar(self, request):
        """Gerar um novo backup do banco de dados e registrar."""
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        registro = None # Para guardar o registro criado

        try:
            # --- Lógica Real de Backup (Adaptar ao seu banco) ---
            logger.info("INFO: Iniciando geração de backup...")
            db_settings = settings.DATABASES['default']
            db_name = db_settings.get('NAME')
            db_engine = db_settings.get('ENGINE', '')

            # Define diretório e nome do arquivo
            backup_dir = os.path.join(settings.MEDIA_ROOT, 'backups')
            os.makedirs(backup_dir, exist_ok=True) # Cria o diretório se não existir
            filename = f"backup_{db_name}_{timestamp}.sql" # Nome mais descritivo
            filepath = os.path.join(backup_dir, filename)

            env = os.environ.copy() # Copia variáveis de ambiente
            pgpass_file = None

            try:
                # Comando para SQLite (sem shell, evitando command injection)
                if 'sqlite3' in db_engine:
                    logger.info("Executando comando de backup SQLite: sqlite3 %s .dump", db_name)
                    with open(filepath, 'w') as out_f:
                        result = subprocess.run(
                            ['sqlite3', str(db_name), '.dump'],
                            shell=False, check=True, stdout=out_f,
                            text=True, encoding='utf-8', errors='ignore', env=env
                        )
                # Comando para PostgreSQL (sem shell, evitando command injection)
                elif 'postgresql' in db_engine:
                    db_user = db_settings.get('USER')
                    db_host = db_settings.get('HOST', 'localhost')
                    db_port = db_settings.get('PORT', '5432')
                    db_password = db_settings.get('PASSWORD')

                    # Usar arquivo .pgpass temporário em vez de variável de ambiente
                    # Isso evita expor a senha em `ps aux`
                    if db_password:
                        import stat
                        pgpass_file = os.path.join(tempfile.gettempdir(), f'.pgpass_{timestamp}')
                        with open(pgpass_file, 'w') as f:
                            # Formato: hostname:port:database:username:password
                            f.write(f"{db_host}:{db_port}:{db_name}:{db_user}:{db_password}\n")
                        os.chmod(pgpass_file, stat.S_IRUSR | stat.S_IWUSR)  # 600 - somente owner
                        env['PGPASSFILE'] = pgpass_file

                    command = [
                        'pg_dump',
                        '-U', str(db_user),
                        '-h', str(db_host),
                        '-p', str(db_port),
                        '-d', str(db_name),
                        '-f', str(filepath),
                    ]
                    logger.info("Executando comando de backup: %s", ' '.join(shlex.quote(str(arg)) for arg in command))
                    result = subprocess.run(
                        command, shell=False, check=True, capture_output=True,
                        text=True, encoding='utf-8', errors='ignore', env=env
                    )
                    logger.info(
                        "Comando de backup concluído. Saída: %s, Erro: %s",
                        result.stdout,
                        result.stderr,
                    )
                # Adicionar comandos para outros bancos (MySQL, etc.) se necessário
                else:
                    raise NotImplementedError(f"Backup não implementado para o banco de dados: {db_engine}")
            finally:
                # Limpa arquivo .pgpass temporário (se existir)
                if pgpass_file and os.path.exists(pgpass_file):
                    try:
                        os.remove(pgpass_file)
                    except OSError:
                        pass

            # Calcula tamanho e hash MD5
            if not os.path.exists(filepath):
                 raise FileNotFoundError(f"Arquivo de backup não foi criado em: {filepath}")
            tamanho_bytes = os.path.getsize(filepath)
            md5_hash = hashlib.md5()
            with open(filepath, 'rb') as f:
                while chunk := f.read(8192): # Lê em chunks para arquivos grandes
                    md5_hash.update(chunk)
            md5_hex = md5_hash.hexdigest()

            # Registra o backup no banco
            registro = RegistroBackup.objects.create(
                nome_arquivo=filename,
                tamanho_bytes=tamanho_bytes,
                md5_hash=md5_hex,
                localizacao=filepath,  # Salva o caminho completo
                usuario=request.user.username,
                status='completo'
            )
            logger.info("INFO: Backup %s gerado e registrado com sucesso.", filename)
            # --- Fim da Lógica Real ---

            if request.query_params.get('response') == 'json':
                return Response({
                    "success": True,
                    "message": "Backup gerado com sucesso!",
                    "backup": RegistroBackupSerializer(registro).data,
                }, status=status.HTTP_201_CREATED)

            # Mantém compatibilidade com clientes que esperam o arquivo diretamente.
            response = FileResponse(
                open(filepath, 'rb'),
                as_attachment=True,
                filename=filename # Nome que aparecerá no download do usuário
            )
            # Opcional: Adicionar headers com informações do registro
            response['X-Backup-ID'] = registro.id
            response['X-Backup-Status'] = registro.status
            response['Cache-Control'] = 'private, no-store'
            return response

        except subprocess.CalledProcessError as cpe:
            # Erro específico na execução do comando
            logger.warning("ERRO (Comando Backup): %s", cpe.stderr)
            error_details = f"Erro ao executar comando de backup: {cpe.stderr}"
            if registro:  # Se o registro foi criado antes do erro de comando
                registro.status = 'erro'
                registro.detalhes = error_details
                registro.save()
            else:  # Tenta criar registro de erro
                try:
                    RegistroBackup.objects.create(
                        nome_arquivo=f"erro_backup_{timestamp}.log", status='erro',
                        usuario=request.user.username, detalhes=error_details)
                except Exception as db_err:
                    logger.warning("Falha ao registrar erro de backup no banco: %s", db_err)
            return Response({"detail": "Erro ao executar comando de backup.", "details": cpe.stderr},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            # Outros erros (permissão, NotImplementedError, etc.)
            logger.warning("ERRO ao gerar backup: %s", e)
            traceback.print_exc()
            error_details = f"Erro ao gerar backup: {str(e)}\n{traceback.format_exc()}"
            if registro:  # Atualiza registro se já criado
                registro.status = 'erro'
                registro.detalhes = error_details
                registro.save()
            else:  # Tenta criar registro de erro
                try:
                    RegistroBackup.objects.create(
                        nome_arquivo=f"erro_backup_{timestamp}.log", status='erro',
                        usuario=request.user.username, detalhes=error_details[:999])  # Limita tamanho do detalhe
                except Exception as db_err:
                    logger.warning("Falha ao registrar erro de backup no banco: %s", db_err)
            return Response({"detail": f"Erro inesperado ao gerar backup: {str(e)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Baixar um arquivo de backup existente pelo ID do registro."""
        registro = get_object_or_404(RegistroBackup, pk=pk)
        backup_path = resolve_registered_backup_path(registro.localizacao)

        if backup_path is None:
             return Response({"detail": f"Arquivo de backup '{registro.nome_arquivo}' não encontrado na localização registrada."},
                            status=status.HTTP_404_NOT_FOUND)

        try:
            response = FileResponse(
                backup_path.open('rb'),
                as_attachment=True,
                filename=registro.nome_arquivo,
            )
            response['Cache-Control'] = 'private, no-store'
            return response
        except FileNotFoundError:
            return Response({"detail": f"Arquivo de backup não encontrado: {registro.nome_arquivo}"},
                            status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.warning("Erro ao baixar backup %s: %s", registro.nome_arquivo, e)
            return Response({"detail": f"Erro ao tentar baixar o arquivo: {str(e)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def restaurar(self, request):
        """
        Restaurar a partir de um arquivo de backup enviado.
        Atenção: Operação perigosa, substitui dados atuais!
        Implementação atual é SIMULADA. Restauração real deve ser manual.
        """
        # Verificar se um arquivo foi enviado no campo 'arquivo_backup'
        backup_file = request.FILES.get('arquivo_backup')
        if not backup_file:
             return Response({"detail": "Nenhum arquivo de backup enviado no campo 'arquivo_backup'."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Verificar extensão (simples verificação)
        if not backup_file.name.lower().endswith('.sql'):
             # Poderia aceitar .dump, .backup dependendo do banco
             return Response({"detail": "Arquivo inválido. Apenas arquivos .sql são suportados (nesta implementação simulada)."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            # --- Lógica Real de Restauração (NÃO IMPLEMENTADA AQUI) ---
            # A restauração real é complexa e arriscada via web.
            # O ideal é salvar o arquivo e instruir o admin a restaurar manualmente.

            logger.info(
                "AUDIT: Solicitação de restauração recebida com arquivo %s (%s bytes) pelo usuário %s (ID: %s).",
                backup_file.name,
                backup_file.size,
                request.user.username,
                request.user.id,
            )

            # Salva o arquivo temporariamente para inspeção/validação e limpa em finally
            temp_dir = tempfile.mkdtemp(prefix="backup_restore_")
            try:
                temp_path = os.path.join(temp_dir, backup_file.name)
                with open(temp_path, 'wb+') as destination:
                    for chunk in backup_file.chunks():
                        destination.write(chunk)
                logger.info(
                    "AUDIT: Arquivo de backup salvo temporariamente em %s pelo usuário %s.",
                    temp_path, request.user.username
                )
                # Aqui, você poderia adicionar lógica para notificar o admin
            finally:
                # Sempre remove o diretório temporário para não expor dados sensíveis
                try:
                    shutil.rmtree(temp_dir)
                    logger.info(
                        "AUDIT: Diretório temporário %s removido após restauração pelo usuário %s.",
                        temp_dir, request.user.username
                    )
                except OSError as cleanup_err:
                    logger.warning(
                        "Falha ao remover diretório temporário %s: %s", temp_dir, cleanup_err
                    )

            # Retorna mensagem indicando que a restauração é manual
            # NÃO expõe o caminho temporário na resposta
            return Response({
                "message": "Arquivo de backup recebido com sucesso. A restauração do banco de dados deve ser realizada manualmente por um administrador utilizando este arquivo.",
                "arquivo_recebido": backup_file.name,
                "tamanho_bytes": backup_file.size,
            }, status=status.HTTP_202_ACCEPTED) # 202 Accepted indica que a requisição foi aceita, mas a ação principal (restauração) não foi feita aqui.
            # --- Fim da Lógica (Simulada) ---

        except Exception as e:
            logger.warning("ERRO ao processar solicitação de restauração: %s", e)
            traceback.print_exc()
            return Response({"detail": f"Erro ao processar pedido de restauração: {str(e)}"},
                           status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ===============================================================
# ==> API DE RELATÓRIOS (Estrutura)
# ===============================================================

class RelatorioAPIView(APIView):
    """
    API para geração de relatórios em diversos formatos.
    Suporta diferentes tipos de relatórios e formatos de saída.
    Funcionalidade pendente de implementação.
    """
    permission_classes = [IsAuthenticated, CapabilityPermission]
    required_capability = 'dashboard.relatorios'

    def get(self, request, format=None):
        """
        Endpoint para gerar relatórios.
        Parâmetros via query string:
        - tipo: Tipo de relatório (faturamento, veiculos, ctes, mdfes, pagamentos, km_rodado, manutencoes) - obrigatório
        - formato: Formato de saída (csv, xlsx, pdf, json) - opcional, default csv
        - filtros: JSON (URL encoded) com filtros específicos para o relatório (ex: data_inicio, data_fim, placa, etc.) - opcional
        """
        params = request.query_params
        tipo = params.get('tipo')
        formato = params.get('formato', 'csv').lower() # Default csv
        filtros_json = params.get('filtros', '{}')

        if not tipo:
            return Response({"detail": "Parâmetro 'tipo' de relatório é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Decodifica e parseia os filtros JSON
            filtros = json.loads(filtros_json) if filtros_json else {}
            
            # Mescla parâmetros soltos da query string no dicionário de filtros
            # Isso permite chamadas como ?tipo=ctes&data_inicio=2023-01-01 sem usar JSON
            for key, value in params.items():
                if key not in ['tipo', 'formato', 'filtros'] and key not in filtros:
                    filtros[key] = value
                    
        except json.JSONDecodeError:
            return Response({"detail": "Formato de 'filtros' inválido. Deve ser um objeto JSON válido (URL encoded)."}, status=status.HTTP_400_BAD_REQUEST)

        # Processar datas comuns se fornecidas nos filtros
        data_inicio = None
        data_fim = None
        if 'data_inicio' in filtros:
            try: data_inicio = datetime.strptime(filtros['data_inicio'], '%Y-%m-%d').date()
            except (ValueError, TypeError): return Response({"detail": "Formato de data_inicio inválido. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        if 'data_fim' in filtros:
            try: data_fim = datetime.strptime(filtros['data_fim'], '%Y-%m-%d').date()
            except (ValueError, TypeError): return Response({"detail": "Formato de data_fim inválido. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        # --- Chamada da Lógica de Geração Específica ---
        # A implementação real ocorreria aqui, chamando funções auxiliares
        try:
            if tipo == 'faturamento':
                dados = self._gerar_relatorio_faturamento(data_inicio, data_fim, filtros)
            elif tipo == 'veiculos':
                dados = self._gerar_relatorio_veiculos(filtros)
            elif tipo == 'ctes':
                dados = self._gerar_relatorio_ctes(data_inicio, data_fim, filtros)
            elif tipo == 'mdfes':
                dados = self._gerar_relatorio_mdfes(data_inicio, data_fim, filtros)
            elif tipo == 'pagamentos':
                dados = self._gerar_relatorio_pagamentos(data_inicio, data_fim, filtros)
            elif tipo == 'km_rodado':
                dados = self._gerar_relatorio_km_rodado(data_inicio, data_fim, filtros)
            elif tipo == 'manutencoes':
                dados = self._gerar_relatorio_manutencoes(data_inicio, data_fim, filtros)
            elif tipo == 'motoristas':
                dados = self._gerar_relatorio_motoristas(data_inicio, data_fim, filtros)
            else:
                 return Response({"detail": f"Tipo de relatório '{tipo}' não suportado ou não implementado."}, status=status.HTTP_400_BAD_REQUEST)

            # --- Formatação da Saída ---
            if formato == 'csv':
                 filename = f"relatorio_{tipo}_{timezone.now().strftime('%Y%m%d')}.csv"
                 return self._gerar_csv(dados, filename)
            elif formato == 'json':
                 return Response(dados)
            elif formato == 'xlsx':
                filename = f"relatorio_{tipo}_{timezone.now().strftime('%Y%m%d')}.xlsx"
                return self._gerar_xlsx(dados, filename)
            elif formato == 'pdf':
                filename = f"relatorio_{tipo}_{timezone.now().strftime('%Y%m%d')}.pdf"
                return self._gerar_pdf(dados, filename)
            else:
                 return Response({"detail": f"Formato '{formato}' não suportado."}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Erro ao gerar relatório '%s': %s", tipo, e)
            return Response({"detail": "Erro interno ao gerar relatório."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # --- Métodos Auxiliares de Geração ---
    def _gerar_relatorio_faturamento(self, data_inicio, data_fim, filtros):
        """Gera dados agregados de faturamento por mês.

        Exclui CT-es cancelados (cancelamento homologado, cStat 135), que não
        representam receita efetiva.
        """
        from datetime import timedelta
        qs = CTePrestacaoServico.objects.select_related('cte__identificacao')
        # Não conta documentos cancelados na receita
        qs = qs.exclude(cte__cancelamento__c_stat=135)
        if data_inicio:
            qs = qs.filter(cte__identificacao__data_emissao__date__gte=data_inicio)
        if data_fim:
            # Usa lt com data_fim + 1 dia para incluir todo o dia final
            data_fim_query = data_fim + timedelta(days=1)
            qs = qs.filter(cte__identificacao__data_emissao__date__lt=data_fim_query)

        agregados = qs.annotate(mes=TruncMonth('cte__identificacao__data_emissao'))\
            .values('mes')\
            .annotate(valor=Sum('valor_total_prestado'))\
            .order_by('mes')

        dados = []
        for item in agregados:
            mes = item['mes'].strftime('%Y-%m') if item['mes'] else 'N/A'
            dados.append({'mes': mes, 'valor': float(item['valor'] or 0)})
        return dados

    def _gerar_relatorio_veiculos(self, filtros):
        """Retorna dados do cadastro de veículos."""
        qs = Veiculo.objects.all()
        if 'ativo' in filtros:
            qs = qs.filter(ativo=bool(filtros['ativo']))
        if 'placa' in filtros:
            qs = qs.filter(placa__icontains=filtros['placa'])
        if filtros.get('tipo_proprietario'):
            qs = qs.filter(tipo_proprietario=filtros['tipo_proprietario'])
        serializer = VeiculoSerializer(qs, many=True)
        return serializer.data

    def _gerar_relatorio_ctes(self, data_inicio, data_fim, filtros):
        """Gera dados para o relatório de CT-es."""
        from datetime import timedelta
        logger.info("INFO: Gerando relatório de CT-es com filtros: %s", filtros)

        # Busca CT-es com dados básicos - FILTRA apenas CT-es com identificacao (dados completos)
        qs = CTeDocumento.objects.filter(
            identificacao__isnull=False
        ).select_related(
            'identificacao', 'emitente', 'remetente', 'destinatario', 'prestacao',
            'cancelamento', 'modal_rodoviario'
        ).prefetch_related('modal_rodoviario__motoristas')

        # Filtros por data
        if data_inicio:
            qs = qs.filter(identificacao__data_emissao__date__gte=data_inicio)
        if data_fim:
            # Usa lt com data_fim + 1 dia para incluir todo o dia final
            data_fim_query = data_fim + timedelta(days=1)
            qs = qs.filter(identificacao__data_emissao__date__lt=data_fim_query)

        # Filtros específicos
        if 'chave' in filtros and filtros['chave']:
            qs = qs.filter(chave__icontains=filtros['chave'])
        if 'numero' in filtros and filtros['numero']:
            qs = qs.filter(identificacao__numero=filtros['numero'])
        if 'emitente' in filtros and filtros['emitente']:
            qs = qs.filter(emitente__razao_social__icontains=filtros['emitente'])
        if 'modalidade' in filtros and filtros['modalidade']:
            qs = qs.filter(modalidade=filtros['modalidade'])
        if 'status' in filtros and filtros['status']:
            qs = qs.filter(status=filtros['status'])
        if 'processado' in filtros:
            qs = qs.filter(processado=bool(filtros['processado']))
        # Filtro por condutor/motorista (nome ou CPF do vínculo automático)
        if filtros.get('condutor'):
            qs = qs.filter(modal_rodoviario__motoristas__nome__icontains=filtros['condutor'])
        if filtros.get('motorista_cpf'):
            cpf_digits = ''.join(ch for ch in str(filtros['motorista_cpf']) if ch.isdigit())
            qs = qs.filter(modal_rodoviario__motoristas__cpf=cpf_digits)
        if filtros.get('placa'):
            qs = qs.filter(modal_rodoviario__veiculos__placa__icontains=filtros['placa'])
        # Exclui cancelados por padrão, salvo se incluir_cancelados=1
        if not filtros.get('incluir_cancelados'):
            qs = qs.exclude(cancelamento__c_stat=135)

        # Limita quantidade para performance
        qs = qs.distinct().order_by('-identificacao__data_emissao')[:1000]

        TIPO_CTE = {0: 'Normal', 1: 'Complementar', 2: 'Anulação', 3: 'Substituto'}

        dados = []
        for cte in qs:
            ide = cte.identificacao
            prest = cte.prestacao

            # Dados do CT-e
            numero = getattr(ide, 'numero', None)
            data_emissao = ide.data_emissao.strftime('%d/%m/%Y %H:%M') if getattr(ide, 'data_emissao', None) else None
            remetente = getattr(cte.remetente, 'razao_social', None) if cte.remetente else None
            destinatario = getattr(cte.destinatario, 'razao_social', None) if cte.destinatario else None

            valor_total = float(prest.valor_total_prestado) if prest and prest.valor_total_prestado else 0
            valor_recebido = float(prest.valor_recebido) if prest and prest.valor_recebido else 0
            valor_cif = float(prest.valor_cif) if prest and prest.valor_cif else 0
            valor_fob = float(prest.valor_fob) if prest and prest.valor_fob else 0

            # Condutor (vínculo automático do XML)
            condutor = None
            placa_tracao = None
            try:
                if cte.modal_rodoviario:
                    primeiro_moto = cte.modal_rodoviario.motoristas.first()
                    condutor = primeiro_moto.nome if primeiro_moto else None
                    tracao = cte.modal_rodoviario.veiculos.filter(tipo_veiculo='0').first()
                    if not tracao:
                        tracao = cte.modal_rodoviario.veiculos.first()
                    placa_tracao = tracao.placa if tracao else None
            except Exception:
                pass

            cancelado = bool(getattr(cte, 'cancelamento', None) and cte.cancelamento.c_stat == 135)

            dados.append({
                'chave': cte.chave,
                'numero': numero,
                'serie': ide.serie if ide else None,
                'data_emissao': data_emissao,
                'remetente': remetente,
                'destinatario': destinatario,
                'condutor': condutor or '-',
                'placa': placa_tracao or '-',
                'uf_origem': ide.uf_ini if ide else None,
                'municipio_origem': ide.nome_mun_ini if ide else None,
                'uf_destino': ide.uf_fim if ide else None,
                'municipio_destino': ide.nome_mun_fim if ide else None,
                'dist_km': ide.dist_km if ide else 0,
                'valor_total': valor_total,
                'valor_recebido': valor_recebido,
                'valor_cif': valor_cif,
                'valor_fob': valor_fob,
                'modalidade': cte.modalidade or 'N/A',
                'tipo_cte': TIPO_CTE.get(ide.tipo_cte, 'N/A') if ide else 'N/A',
                'cfop': ide.cfop if ide else None,
                'natureza_operacao': ide.natureza_operacao if ide else None,
                'pago': 'Sim' if cte.pago else 'Não',
                'status': cte.get_status_display() if hasattr(cte, 'get_status_display') else cte.status,
                'situacao': 'Cancelado' if cancelado else 'Ativo',
            })

        return dados

    def _gerar_relatorio_mdfes(self, data_inicio, data_fim, filtros):
        """Gera dados para o relatório de MDF-es."""
        from datetime import timedelta
        logger.info("INFO: Gerando relatório de MDF-es com filtros: %s", filtros)

        # Busca MDF-es com dados básicos - FILTRA apenas MDF-es com identificacao (dados completos)
        qs = MDFeDocumento.objects.filter(
            identificacao__isnull=False
        ).select_related(
            'identificacao', 'emitente', 'totais',
            'modal_rodoviario', 'modal_rodoviario__veiculo_tracao'
        ).prefetch_related(
            'condutores',
            'docs_vinculados_mdfe'
        )

        # Filtros por data
        if data_inicio:
            qs = qs.filter(identificacao__dh_emi__date__gte=data_inicio)
        if data_fim:
            # Usa lt com data_fim + 1 dia para incluir todo o dia final
            data_fim_query = data_fim + timedelta(days=1)
            qs = qs.filter(identificacao__dh_emi__date__lt=data_fim_query)

        # Filtros específicos
        if 'chave' in filtros and filtros['chave']:
            qs = qs.filter(chave__icontains=filtros['chave'])
        if 'numero' in filtros and filtros['numero']:
            qs = qs.filter(identificacao__n_mdf=filtros['numero'])
        if 'emitente' in filtros and filtros['emitente']:
            qs = qs.filter(emitente__razao_social__icontains=filtros['emitente'])
        if 'status' in filtros and filtros['status']:
            qs = qs.filter(status=filtros['status'])
        if 'encerrado' in filtros:
            enc_val = str(filtros['encerrado']).lower()
            qs = qs.filter(encerrado=(enc_val in ('true', '1', 'sim')))
        if 'processado' in filtros:
            qs = qs.filter(processado=bool(filtros['processado']))
        # Filtros por veículo e condutor
        if filtros.get('placa'):
            qs = qs.filter(modal_rodoviario__veiculo_tracao__placa__icontains=filtros['placa'])
        if filtros.get('condutor'):
            qs = qs.filter(condutores__nome__icontains=filtros['condutor'])
        if filtros.get('motorista_cpf'):
            cpf_digits = ''.join(ch for ch in str(filtros['motorista_cpf']) if ch.isdigit())
            qs = qs.filter(condutores__cpf=cpf_digits)
        qs = qs.distinct()

        # Limita quantidade para performance
        qs = qs.order_by('-identificacao__dh_emi')[:1000]

        MODAL_MDFE = {'1': 'Rodoviário', '2': 'Aéreo', '3': 'Aquaviário', '4': 'Ferroviário'}

        dados = []
        for mdfe in qs:
            ide = mdfe.identificacao
            totais = mdfe.totais

            placa_tracao = None
            renavam = None
            try:
                if mdfe.modal_rodoviario and mdfe.modal_rodoviario.veiculo_tracao:
                    placa_tracao = mdfe.modal_rodoviario.veiculo_tracao.placa
                    renavam = mdfe.modal_rodoviario.veiculo_tracao.renavam
            except Exception:
                pass

            qtd_ctes = mdfe.docs_vinculados_mdfe.count() if hasattr(mdfe, 'docs_vinculados_mdfe') else 0
            condutor = mdfe.condutores.first()
            condutor_nome = condutor.nome if condutor else None

            numero = ide.n_mdf if ide else None
            data_emissao = ide.dh_emi.strftime('%d/%m/%Y %H:%M') if ide and ide.dh_emi else None
            dh_ini_viagem = ide.dh_ini_viagem.strftime('%d/%m/%Y %H:%M') if ide and ide.dh_ini_viagem else None

            valor_carga = float(totais.v_carga) if totais and totais.v_carga else 0
            qtd_nfe = totais.q_nfe if totais else None
            qtd_carga = float(totais.q_carga) if totais and totais.q_carga else 0
            unidade_carga = totais.c_unid if totais else None

            dados.append({
                'chave': mdfe.chave,
                'numero': numero,
                'serie': ide.serie if ide else None,
                'data_emissao': data_emissao,
                'dh_ini_viagem': dh_ini_viagem,
                'uf_inicio': ide.uf_ini if ide else None,
                'uf_fim': ide.uf_fim if ide else None,
                'placa': placa_tracao or '-',
                'renavam': renavam,
                'condutor': condutor_nome or '-',
                'qtd_ctes': qtd_ctes,
                'qtd_nfe': qtd_nfe,
                'peso_carga': qtd_carga,
                'unidade_carga': unidade_carga,
                'valor_carga': valor_carga,
                'modal': MODAL_MDFE.get(ide.modal, ide.modal) if ide else None,
                'encerrado': 'Sim' if mdfe.encerrado else 'Não',
                'status': mdfe.get_status_display() if hasattr(mdfe, 'get_status_display') else mdfe.status,
            })

        return dados

    def _gerar_relatorio_pagamentos(self, data_inicio, data_fim, filtros):
        """Gera dados para o relatório de pagamentos (agregados e próprios)."""
        from datetime import timedelta
        logger.info("INFO: Gerando relatório de pagamentos com filtros: %s", filtros)

        dados = []
        tipo_pagamento = filtros.get('tipo', 'todos')  # 'agregado', 'proprio' ou 'todos'

        # Pagamentos Agregados
        if tipo_pagamento in ['agregado', 'todos']:
            qs_agregados = PagamentoAgregado.objects.select_related('cte__identificacao')

            # Filtros por data (usando data_prevista)
            if data_inicio:
                qs_agregados = qs_agregados.filter(data_prevista__gte=data_inicio)
            if data_fim:
                # Usa lt com data_fim + 1 dia para incluir todo o dia final
                data_fim_query = data_fim + timedelta(days=1)
                qs_agregados = qs_agregados.filter(data_prevista__lt=data_fim_query)
                
            # Filtros específicos
            if 'status' in filtros and filtros['status']:
                qs_agregados = qs_agregados.filter(status=filtros['status'])
            if 'placa' in filtros and filtros['placa']:
                qs_agregados = qs_agregados.filter(placa__icontains=filtros['placa'])
            if 'condutor' in filtros and filtros['condutor']:
                qs_agregados = qs_agregados.filter(condutor_nome__icontains=filtros['condutor'])
                
            # Limita quantidade
            qs_agregados = qs_agregados.order_by('-data_prevista')[:500]
            
            for pag in qs_agregados:
                dados.append({
                    'tipo': 'Agregado',
                    'id': pag.id,
                    'cte_numero': pag.cte.identificacao.numero if hasattr(pag.cte, 'identificacao') else None,
                    'cte_chave': pag.cte.chave if pag.cte else None,
                    'placa': pag.placa,
                    'condutor': pag.condutor_nome,
                    'cpf_condutor': pag.condutor_cpf,
                    'valor_frete': float(pag.valor_frete_total),
                    'percentual_repasse': float(pag.percentual_repasse),
                    'desconto': float(pag.desconto) if pag.desconto else 0,
                    'valor_total_pagar': float(pag.valor_repassado),
                    'status': pag.status,
                    'data_prevista': pag.data_prevista.strftime('%Y-%m-%d'),
                    'data_pagamento': pag.data_pagamento.strftime('%Y-%m-%d') if pag.data_pagamento else None,
                    'observacoes': pag.obs or '',
                })
        
        # Pagamentos Próprios
        if tipo_pagamento in ['proprio', 'todos']:
            qs_proprios = PagamentoProprio.objects.select_related('veiculo')
            
            # Filtros por data (usando periodo - mais complexo)
            if data_inicio or data_fim:
                periodo_filters = []
                if data_inicio:
                    periodo_inicio = data_inicio.strftime('%Y-%m')
                    periodo_filters.append(('periodo__gte', periodo_inicio))
                if data_fim:
                    periodo_fim = data_fim.strftime('%Y-%m')
                    periodo_filters.append(('periodo__lte', periodo_fim))
                for field, value in periodo_filters:
                    qs_proprios = qs_proprios.filter(**{field: value})
                    
            # Filtros específicos
            if 'status' in filtros and filtros['status']:
                qs_proprios = qs_proprios.filter(status=filtros['status'])
            if 'placa' in filtros and filtros['placa']:
                qs_proprios = qs_proprios.filter(veiculo__placa__icontains=filtros['placa'])
                
            # Limita quantidade
            qs_proprios = qs_proprios.order_by('-periodo')[:500]
            
            for pag in qs_proprios:
                dados.append({
                    'tipo': 'Próprio',
                    'id': pag.id,
                    'cte_numero': pag.cte_numero,
                    'cte_chave': pag.cte.chave if pag.cte else None,
                    'placa': pag.veiculo.placa,
                    'condutor': pag.motorista_nome or 'Condutor Próprio',
                    'cpf_condutor': pag.motorista_cpf,
                    'valor_frete': None,
                    'percentual_repasse': None,
                    'desconto': None,
                    'valor_total_pagar': float(pag.valor_total_pagar),
                    'status': pag.status,
                    'data_prevista': pag.data_prevista.strftime('%Y-%m-%d') if pag.data_prevista else None,
                    'data_pagamento': pag.data_pagamento.strftime('%Y-%m-%d') if pag.data_pagamento else None,
                    'observacoes': pag.obs or '',
                    'periodo': pag.periodo,
                    'km_total': pag.km_total_periodo,
                    'valor_base_faixa': float(pag.valor_base_faixa) if pag.valor_base_faixa else 0,
                    'ajustes': float(pag.ajustes),
                })
            
        return dados

    def _gerar_relatorio_km_rodado(self, data_inicio, data_fim, filtros):
        """Gera dados para o relatório de KM rodado baseado em CT-es e manutenções."""
        from datetime import timedelta
        logger.info("INFO: Gerando relatório de KM rodado com filtros: %s", filtros)

        dados = []

        # Agrupa dados por placa para calcular KM total
        km_por_placa = {}

        # KM dos CT-es (campo dist_km)
        qs_ctes = CTeDocumento.objects.select_related('identificacao').prefetch_related('modal_rodoviario__veiculos')

        # Filtros por data
        if data_inicio:
            qs_ctes = qs_ctes.filter(identificacao__data_emissao__date__gte=data_inicio)
        if data_fim:
            # Usa lt com data_fim + 1 dia para incluir todo o dia final
            data_fim_query = data_fim + timedelta(days=1)
            qs_ctes = qs_ctes.filter(identificacao__data_emissao__date__lt=data_fim_query)
            
        # Filtro por placa se especificado
        if 'placa' in filtros and filtros['placa']:
            qs_ctes = qs_ctes.filter(modal_rodoviario__veiculos__placa__icontains=filtros['placa'])
            
        # Processa CT-es para somar KM.
        # A distância (dist_km) é da viagem do CT-e e deve ser atribuída a UM
        # veículo — o de tração (tpVeic='0'). Atribuir a todos os veículos do
        # modal (tração + reboque) contava o KM em dobro. Sem tração explícita,
        # usa o primeiro veículo.
        for cte in qs_ctes:
            if hasattr(cte, 'modal_rodoviario') and cte.modal_rodoviario:
                veiculos = list(cte.modal_rodoviario.veiculos.all())
                if not veiculos:
                    continue
                tracao = next((v for v in veiculos if v.tipo_veiculo == '0'), veiculos[0])
                placa = tracao.placa
                km = cte.identificacao.dist_km if hasattr(cte, 'identificacao') and cte.identificacao.dist_km else 0

                if placa not in km_por_placa:
                    km_por_placa[placa] = {
                        'placa': placa,
                        'km_ctes': 0,
                        'km_manutencoes': 0,
                        'qtd_ctes': 0,
                        'qtd_manutencoes': 0,
                        'ultima_manutencao': None,
                        'km_total_estimado': 0
                    }

                km_por_placa[placa]['km_ctes'] += km
                km_por_placa[placa]['qtd_ctes'] += 1
        
        # KM das manutenções (quilometragem registrada)
        qs_manutencoes = ManutencaoVeiculo.objects.select_related('veiculo')

        # Filtros por data
        if data_inicio:
            qs_manutencoes = qs_manutencoes.filter(data_servico__gte=data_inicio)
        if data_fim:
            # Usa lt com data_fim + 1 dia para incluir todo o dia final
            data_fim_manutencao = data_fim + timedelta(days=1)
            qs_manutencoes = qs_manutencoes.filter(data_servico__lt=data_fim_manutencao)
            
        # Filtro por placa se especificado
        if 'placa' in filtros and filtros['placa']:
            qs_manutencoes = qs_manutencoes.filter(veiculo__placa__icontains=filtros['placa'])
            
        # Processa manutenções
        for manutencao in qs_manutencoes:
            placa = manutencao.veiculo.placa
            km = manutencao.quilometragem or 0
            
            if placa not in km_por_placa:
                km_por_placa[placa] = {
                    'placa': placa,
                    'km_ctes': 0,
                    'km_manutencoes': 0,
                    'qtd_ctes': 0,
                    'qtd_manutencoes': 0,
                    'ultima_manutencao': None,
                    'km_total_estimado': 0
                }
            
            # Para manutenções, usa a maior quilometragem como referência
            if km > km_por_placa[placa]['km_manutencoes']:
                km_por_placa[placa]['km_manutencoes'] = km
                km_por_placa[placa]['ultima_manutencao'] = manutencao.data_servico.strftime('%Y-%m-%d')
            
            km_por_placa[placa]['qtd_manutencoes'] += 1
        
        # Converte para lista e calcula estimativas
        for placa_data in km_por_placa.values():
            # Estimativa simples: maior valor entre KM das manutenções e soma dos CT-es
            km_estimado = max(placa_data['km_manutencoes'], placa_data['km_ctes'])
            placa_data['km_total_estimado'] = km_estimado
            
            # Informações do veículo
            try:
                veiculo = Veiculo.objects.get(placa=placa_data['placa'])
                placa_data['veiculo_ativo'] = veiculo.ativo
                placa_data['proprietario'] = veiculo.proprietario_nome or 'Não informado'
            except Veiculo.DoesNotExist:
                placa_data['veiculo_ativo'] = False
                placa_data['proprietario'] = 'Veículo não cadastrado'
            
            dados.append(placa_data)
        
        # Ordena por KM total estimado (maior primeiro)
        dados.sort(key=lambda x: x['km_total_estimado'], reverse=True)
        
        return dados

    def _gerar_relatorio_manutencoes(self, data_inicio, data_fim, filtros):
        """Gera dados para o relatório de manutenções."""
        from django.db.models import Q
        from datetime import timedelta

        logger.info("INFO: Gerando relatório de manutenções com filtros: %s", filtros)

        qs = ManutencaoVeiculo.objects.select_related('veiculo').all()

        # Filtro por data - considera data_agendada, data_realizada e data_servico (legado)
        # Usa OR para que registro seja incluído se QUALQUER uma das datas estiver no período
        if data_inicio:
            qs = qs.filter(
                Q(data_agendada__gte=data_inicio) |
                Q(data_realizada__gte=data_inicio) |
                Q(data_servico__gte=data_inicio)
            )
        if data_fim:
            # Usa lt com data_fim + 1 dia para incluir todo o dia final
            data_fim_query = data_fim + timedelta(days=1)
            qs = qs.filter(
                Q(data_agendada__lt=data_fim_query) |
                Q(data_realizada__lt=data_fim_query) |
                Q(data_servico__lt=data_fim_query)
            )

        # Filtros adicionais
        if 'placa' in filtros and filtros['placa']:
            qs = qs.filter(veiculo__placa__icontains=filtros['placa'])
        if 'status' in filtros and filtros['status']:
            qs = qs.filter(status=filtros['status'])
        if 'tipo' in filtros and filtros['tipo']:
            qs = qs.filter(tipo=filtros['tipo'])
        if 'fornecedor' in filtros and filtros['fornecedor']:
            qs = qs.filter(fornecedor__icontains=filtros['fornecedor'])

        # Ordena por data mais recente
        qs = qs.order_by('-data_agendada', '-data_realizada', '-data_servico')[:1000]

        # Formata dados para o relatório
        dados = []
        for m in qs:
            dados.append({
                'id': m.id,
                'placa': m.veiculo.placa if m.veiculo else '-',
                'tipo': m.tipo or '-',
                'descricao': m.descricao or m.servico_realizado or '-',
                'data_agendada': m.data_agendada.strftime('%d/%m/%Y') if m.data_agendada else '-',
                'data_realizada': m.data_realizada.strftime('%d/%m/%Y') if m.data_realizada else '-',
                'status': m.status or '-',
                'custo': float(m.custo) if m.custo else 0,
                'fornecedor': m.fornecedor or m.oficina or '-',
                'quilometragem': m.quilometragem or '-',
                'nota_fiscal': m.nota_fiscal or '-',
            })

        return dados

    def _gerar_relatorio_motoristas(self, data_inicio, data_fim, filtros):
        """Relatório de motoristas: cadastro, compliance (validades) e atividade.

        Inclui contagem de viagens (via vínculo automático em CT-e/MDF-e),
        total repassado no período e documentos vencidos/a vencer em 30 dias.
        """
        from datetime import timedelta, date
        logger.info("INFO: Gerando relatório de motoristas com filtros: %s", filtros)

        qs = Motorista.objects.all()
        if 'ativo' in filtros:
            qs = qs.filter(ativo=bool(filtros['ativo']))
        if filtros.get('nome'):
            qs = qs.filter(nome__icontains=filtros['nome'])
        if filtros.get('cpf'):
            cpf = ''.join(ch for ch in str(filtros['cpf']) if ch.isdigit())
            qs = qs.filter(cpf=cpf)
        if 'cadastro_automatico' in filtros:
            qs = qs.filter(cadastro_automatico=bool(filtros['cadastro_automatico']))
        # Apenas com pendência de compliance (validades vencidas/a vencer)
        somente_pendentes = bool(filtros.get('pendentes'))

        hoje = date.today()
        limite = hoje + timedelta(days=30)
        data_fim_query = (data_fim + timedelta(days=1)) if data_fim else None

        dados = []
        for m in qs.order_by('nome'):
            viagens_cte = m.ctes_como_condutor.count()
            viagens_mdfe = m.mdfes_como_condutor.count()

            pagamentos = PagamentoAgregado.objects.filter(condutor_cpf=m.cpf, status='pago')
            if data_inicio:
                pagamentos = pagamentos.filter(data_prevista__gte=data_inicio)
            if data_fim_query:
                pagamentos = pagamentos.filter(data_prevista__lt=data_fim_query)
            total_repassado = float(pagamentos.aggregate(s=Sum('valor_repassado'))['s'] or 0)

            # Validades vencidas ou a vencer em 30 dias
            pendencias = []
            for label, val in (
                ('CNH', m.validade_cnh), ('NR20', m.nr20_validade),
                ('NR35', m.nr35_validade), ('MOPP', m.mopp_validade),
                ('Toxicológico', m.toxicologico_validade), ('ASO', m.aso_validade),
            ):
                if val and val <= limite:
                    estado = 'vencido' if val < hoje else 'a vencer'
                    pendencias.append(f"{label} {estado} ({val.strftime('%d/%m/%Y')})")

            if somente_pendentes and not pendencias:
                continue

            dados.append({
                'nome': m.nome,
                'cpf': f"{m.cpf[:3]}.{m.cpf[3:6]}.{m.cpf[6:9]}-{m.cpf[9:]}" if m.cpf and len(m.cpf) == 11 else m.cpf,
                'cnh': m.cnh or '-',
                'categoria_cnh': m.categoria_cnh or '-',
                'validade_cnh': m.validade_cnh.strftime('%d/%m/%Y') if m.validade_cnh else '-',
                'validade_nr20': m.nr20_validade.strftime('%d/%m/%Y') if m.nr20_validade else '-',
                'validade_nr35': m.nr35_validade.strftime('%d/%m/%Y') if m.nr35_validade else '-',
                'validade_mopp': m.mopp_validade.strftime('%d/%m/%Y') if m.mopp_validade else '-',
                'validade_toxicologico': m.toxicologico_validade.strftime('%d/%m/%Y') if m.toxicologico_validade else '-',
                'validade_aso': m.aso_validade.strftime('%d/%m/%Y') if m.aso_validade else '-',
                'telefone': m.telefone or '-',
                'email': m.email or '-',
                'cidade': m.cidade or '-',
                'estado': m.estado or '-',
                'banco': m.banco or '-',
                'agencia': m.agencia or '-',
                'conta': m.conta or '-',
                'tipo_conta': m.get_tipo_conta_display() if m.tipo_conta else '-',
                'tipo_chave_pix': m.get_tipo_chave_pix_display() if m.tipo_chave_pix else '-',
                'chave_pix': m.chave_pix or '-',
                'favorecido': m.favorecido or '-',
                'viagens_cte': viagens_cte,
                'viagens_mdfe': viagens_mdfe,
                'viagens_total': viagens_cte + viagens_mdfe,
                'total_repassado': total_repassado,
                'cadastro': 'Automático' if m.cadastro_automatico else 'Manual',
                'cadastro_completo': 'Sim' if m.cadastro_completo else 'Não',
                'pendencias': '; '.join(pendencias) if pendencias else '-',
                'ativo': 'Sim' if m.ativo else 'Não',
            })

        return dados

    # --- Método Auxiliar para Formatar Valores no Padrão Brasileiro ---
    def _formatar_valor_br(self, valor):
        """
        Formata um valor numérico para o padrão brasileiro (vírgula como separador decimal).
        Exemplos: 1500.00 -> "1500,00", 1234.5 -> "1234,50"
        """
        if valor is None or valor == '' or valor == '-':
            return valor

        try:
            # Converte para float se for string
            if isinstance(valor, str):
                # Se já contém vírgula, retorna como está
                if ',' in valor and '.' not in valor:
                    return valor
                valor = float(valor.replace(',', '.'))

            # Formata com 2 casas decimais e troca ponto por vírgula
            return f"{valor:.2f}".replace('.', ',')
        except (ValueError, TypeError):
            return str(valor) if valor else ''

    def _formatar_dados_br(self, dados):
        """
        Formata todos os campos numéricos de uma lista de dicts para o padrão brasileiro.
        Identifica campos que contêm valores monetários/numéricos pelo nome ou conteúdo.
        """
        if not dados or not isinstance(dados, list):
            return dados

        # Campos que tipicamente contêm valores monetários
        campos_monetarios = [
            'valor', 'custo', 'total', 'preco', 'frete', 'icms', 'pedagio',
            'valor_total', 'valor_frete', 'valor_icms', 'valor_pedagio',
            'valor_peca', 'valor_mao_obra', 'valor_receber', 'valor_pago',
            'valor_cte', 'valor_servico', 'valor_prestacao', 'valor_carga',
            'receita', 'despesa', 'lucro', 'saldo', 'comissao', 'desconto',
            'km_total', 'quilometragem', 'km'
        ]

        dados_formatados = []
        for item in dados:
            if not isinstance(item, dict):
                dados_formatados.append(item)
                continue

            item_formatado = {}
            for chave, valor in item.items():
                # Verifica se é um campo monetário/numérico
                chave_lower = chave.lower()
                eh_monetario = any(campo in chave_lower for campo in campos_monetarios)

                # Também formata se for um número float
                if eh_monetario or isinstance(valor, float):
                    item_formatado[chave] = self._formatar_valor_br(valor)
                else:
                    item_formatado[chave] = valor

            dados_formatados.append(item_formatado)

        return dados_formatados

    # --- Método Auxiliar para Gerar CSV ---
    def _gerar_csv(self, dados, nome_arquivo):
        """Função auxiliar para gerar arquivos CSV a partir de uma lista de dicts."""
        if not dados or not isinstance(dados, list):
            # Se dados não for uma lista, retorna erro ou mensagem
            if isinstance(dados, dict) and 'message' in dados:
                return Response(dados, status=status.HTTP_501_NOT_IMPLEMENTED) # Retorna msg de não implementado
            return Response({"detail": "Formato de dados inválido para gerar CSV."},
                           status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Se a lista estiver vazia, retorna CSV vazio com mensagem
        if len(dados) == 0:
            output = StringIO()
            output.write("Nenhum dado encontrado para os filtros especificados.\n")
            response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
            return response

        # Verifica se o primeiro item é um dicionário
        if not isinstance(dados[0], dict):
            return Response({"detail": "Formato de dados inválido para gerar CSV."},
                           status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Formata valores numéricos para o padrão brasileiro (vírgula)
        dados_formatados = self._formatar_dados_br(dados)

        # Pega cabeçalhos do primeiro dicionário
        fieldnames = list(dados_formatados[0].keys())
        output = StringIO()
        # Usa ponto-e-vírgula como delimitador para melhor compatibilidade com Excel BR
        writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')

        writer.writeheader()
        writer.writerows(dados_formatados)

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8') # Adiciona charset
        response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
        return response

    # --- Método Auxiliar para Gerar XLSX ---
    def _gerar_xlsx(self, dados, nome_arquivo):
        """Gera arquivo Excel (XLSX) a partir de uma lista de dicts."""
        if not dados or not isinstance(dados, list):
             if isinstance(dados, dict) and 'message' in dados:
                return Response(dados, status=status.HTTP_501_NOT_IMPLEMENTED)
             return Response({"detail": "Formato de dados inválido para gerar XLSX."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if len(dados) == 0:
             return Response({"message": "Nenhum dado encontrado."}, status=status.HTTP_204_NO_CONTENT)

        # Formata valores numéricos para o padrão brasileiro (vírgula)
        dados_formatados = self._formatar_dados_br(dados)

        # Cria workbook e sheet
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Relatório"

        # Cabeçalhos
        if isinstance(dados_formatados[0], dict):
            headers = list(dados_formatados[0].keys())
            ws.append(headers)

            # Dados
            for item in dados_formatados:
                ws.append([str(item.get(h, '')) for h in headers])

        # Salva em buffer
        output = BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
        return response

    # --- Método Auxiliar para Gerar PDF ---
    def _gerar_pdf(self, dados, nome_arquivo):
        """Gera arquivo PDF a partir de uma lista de dicts."""
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        if not dados or not isinstance(dados, list):
             if isinstance(dados, dict) and 'message' in dados:
                return Response(dados, status=status.HTTP_501_NOT_IMPLEMENTED)
             return Response({"detail": "Formato de dados inválido para gerar PDF."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if len(dados) == 0:
             return Response({"message": "Nenhum dado encontrado."}, status=status.HTTP_204_NO_CONTENT)

        buffer = BytesIO()
        # Usa A4 landscape para mais espaço horizontal
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=15,
            rightMargin=15,
            topMargin=20,
            bottomMargin=20
        )
        elements = []
        styles = getSampleStyleSheet()

        # Estilo para células
        cell_style = ParagraphStyle(
            'CellStyle',
            parent=styles['Normal'],
            fontSize=7,
            leading=9,
            alignment=TA_LEFT,
            wordWrap='CJK',
        )
        cell_style_center = ParagraphStyle(
            'CellStyleCenter',
            parent=cell_style,
            alignment=TA_CENTER,
        )
        cell_style_right = ParagraphStyle(
            'CellStyleRight',
            parent=cell_style,
            alignment=TA_RIGHT,
        )
        header_style = ParagraphStyle(
            'HeaderStyle',
            parent=styles['Normal'],
            fontSize=7,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.white,
            fontName='Helvetica-Bold',
        )

        # Título do relatório
        titulo_tipo = nome_arquivo.replace('relatorio_', '').replace('_', ' ').replace('.pdf', '').upper()
        elements.append(Paragraph(f"<b>RELATÓRIO DE {titulo_tipo}</b>", styles['Title']))
        elements.append(Paragraph(f"Gerado em: {timezone.now().strftime('%d/%m/%Y às %H:%M')}", styles['Normal']))
        elements.append(Spacer(1, 15))

        # Tabela
        if isinstance(dados[0], dict):
            headers = list(dados[0].keys())

            # Mapeamento de larguras por tipo de campo (em pontos)
            # A4 landscape = 842 pontos, margens = 30, disponível = 812
            largura_disponivel = 812
            larguras_campos = {
                'numero': 50,
                'data_emissao': 80,
                'data': 60,
                'placa': 60,
                'modalidade': 45,
                'pago': 40,
                'encerrado': 50,
                'uf_inicio': 40,
                'uf_fim': 40,
                'qtd_ctes': 45,
                'status': 55,
                'valor': 70,
                'valor_total': 75,
                'valor_carga': 70,
                'peso_carga': 65,
                'condutor': 150,
                'remetente': 180,
                'destinatario': 180,
            }

            # Calcula larguras das colunas
            col_widths = []
            largura_usada = 0
            colunas_flexiveis = []

            for i, h in enumerate(headers):
                if h in larguras_campos:
                    col_widths.append(larguras_campos[h])
                    largura_usada += larguras_campos[h]
                else:
                    col_widths.append(None)
                    colunas_flexiveis.append(i)

            # Distribui espaço restante entre colunas flexíveis
            if colunas_flexiveis:
                largura_restante = largura_disponivel - largura_usada
                largura_por_col = max(60, largura_restante / len(colunas_flexiveis))
                for i in colunas_flexiveis:
                    col_widths[i] = largura_por_col

            # Formata cabeçalhos
            headers_formatados = []
            for h in headers:
                nome = h.replace('_', ' ').title()
                headers_formatados.append(Paragraph(nome, header_style))

            # Função para formatar valor de célula
            def formatar_celula(valor, campo):
                if valor is None or valor == '':
                    return Paragraph('-', cell_style_center)

                valor_str = str(valor)

                # Campos numéricos/monetários - alinha à direita
                if campo in ['valor', 'valor_total', 'valor_carga', 'peso_carga', 'qtd_ctes']:
                    try:
                        num = float(valor_str)
                        if campo in ['valor', 'valor_total', 'valor_carga']:
                            valor_str = f"R$ {num:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                        elif campo == 'peso_carga':
                            valor_str = f"{num:,.0f} kg".replace(',', '.')
                        else:
                            valor_str = f"{num:,.0f}".replace(',', '.')
                    except (ValueError, TypeError):
                        pass
                    return Paragraph(valor_str, cell_style_right)

                # Campos de status/boolean - centraliza
                if campo in ['pago', 'encerrado', 'modalidade', 'status', 'uf_inicio', 'uf_fim', 'placa', 'numero']:
                    return Paragraph(valor_str, cell_style_center)

                # Remetente e Destinatario - mostrar completo (word wrap automático)
                if campo in ['remetente', 'destinatario', 'condutor']:
                    return Paragraph(valor_str, cell_style)

                # Outros campos de texto - mostrar completo
                return Paragraph(valor_str, cell_style)

            # Monta dados da tabela
            data = [headers_formatados]
            for item in dados:
                row = [formatar_celula(item.get(h, ''), h) for h in headers]
                data.append(row)

            # Cria tabela
            t = Table(data, colWidths=col_widths, repeatRows=1)
            t.setStyle(TableStyle([
                # Cabeçalho
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5276')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, 0), 6),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                ('LEFTPADDING', (0, 0), (-1, 0), 4),
                ('RIGHTPADDING', (0, 0), (-1, 0), 4),

                # Dados
                ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 1), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
                ('LEFTPADDING', (0, 1), (-1, -1), 4),
                ('RIGHTPADDING', (0, 1), (-1, -1), 4),

                # Bordas
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#1a5276')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d5d8dc')),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#1a5276')),

                # Cores alternadas nas linhas
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9f9')]),
            ]))
            elements.append(t)

            # Rodapé com total de registros
            elements.append(Spacer(1, 15))
            elements.append(Paragraph(
                f"<b>Total de registros:</b> {len(dados)}",
                styles['Normal']
            ))

        doc.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
        return response
