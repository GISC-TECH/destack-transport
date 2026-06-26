import logging
import os
import subprocess
from datetime import date, datetime, timedelta
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def gerar_alertas_inteligentes(self):
    """
    Gera alertas automáticos para:
    - Manutenções próximas do vencimento
    - Documentos de veículos/motoristas vencendo
    - Faturas/CT-es atrasados
    - Contas a pagar vencendo
    """
    from .models import (
        AlertaSistema, CTeDocumento, Fatura, ContaPagar, Motorista, PlanoManutencao, Veiculo
    )

    hoje = date.today()
    limite = hoje + timedelta(days=15)
    criados = 0

    # Manutenções próximas do vencimento
    for plano in PlanoManutencao.objects.filter(ativo=True):
        if plano.esta_vencendo(dias_alerta=15):
            _, created = AlertaSistema.objects.get_or_create(
                tipo='manutencao_vencendo',
                referencia=str(plano.id),
                defaults={
                    'prioridade': 'alta' if plano.proxima_data and plano.proxima_data <= hoje else 'media',
                    'mensagem': f"Manutenção '{plano.descricao}' do veículo {plano.veiculo.placa} está próxima do vencimento.",
                    'modulo': 'Manutencao',
                    'dados_adicionais': {
                        'veiculo': plano.veiculo.placa,
                        'descricao': plano.descricao,
                        'proxima_km': plano.proxima_km,
                        'proxima_data': str(plano.proxima_data) if plano.proxima_data else None,
                    }
                }
            )
            if created:
                criados += 1

    # Documentos de veículos vencendo
    for veiculo in Veiculo.objects.filter(ativo=True):
        docs = veiculo.get_documentos_vencendo(dias=30)
        for doc in docs:
            _, created = AlertaSistema.objects.get_or_create(
                tipo='documento_veiculo_vencendo',
                referencia=f"{veiculo.id}_{doc['documento']}",
                defaults={
                    'prioridade': 'alta' if doc['vencido'] else 'media',
                    'mensagem': f"Documento '{doc['documento']}' do veículo {veiculo.placa} vence em {doc['dias_restantes']} dias.",
                    'modulo': 'Veiculo',
                    'dados_adicionais': {
                        'veiculo': veiculo.placa,
                        'documento': doc['documento'],
                        'validade': str(doc['validade']),
                        'vencido': doc['vencido'],
                    }
                }
            )
            if created:
                criados += 1

    # Documentos de motoristas vencendo
    for motorista in Motorista.objects.filter(ativo=True):
        docs = motorista.get_documentos_vencendo(dias=30)
        for doc in docs:
            _, created = AlertaSistema.objects.get_or_create(
                tipo='documento_motorista_vencendo',
                referencia=f"{motorista.id}_{doc['documento']}",
                defaults={
                    'prioridade': 'alta' if doc['vencido'] else 'media',
                    'mensagem': f"Documento '{doc['documento']}' do motorista {motorista.nome} vence em {doc['dias_restantes']} dias.",
                    'modulo': 'Motorista',
                    'dados_adicionais': {
                        'motorista': motorista.nome,
                        'documento': doc['documento'],
                        'validade': str(doc['validade']),
                        'vencido': doc['vencido'],
                    }
                }
            )
            if created:
                criados += 1

    # Faturas atrasadas
    for fatura in Fatura.objects.filter(status__in=['enviada', 'rascunho'], data_vencimento__lt=hoje):
        _, created = AlertaSistema.objects.get_or_create(
            tipo='fatura_atrasada',
            referencia=str(fatura.id),
            defaults={
                'prioridade': 'alta',
                'mensagem': f"Fatura {fatura.numero} ({fatura.cliente.razao_social}) está atrasada.",
                'modulo': 'Financeiro',
                'dados_adicionais': {
                    'fatura': fatura.numero,
                    'cliente': fatura.cliente.razao_social,
                    'valor': str(fatura.valor_total),
                    'dias_atraso': (hoje - fatura.data_vencimento).days,
                }
            }
        )
        if created:
            criados += 1

    # CT-es não pagos e vencidos
    for cte in CTeDocumento.objects.filter(pago=False, identificacao__data_emissao__lt=timezone.now() - timedelta(days=30)):
        _, created = AlertaSistema.objects.get_or_create(
            tipo='cte_nao_pago',
            referencia=str(cte.id),
            defaults={
                'prioridade': 'media',
                'mensagem': f"CT-e {cte.identificacao.numero} não pago há mais de 30 dias.",
                'modulo': 'Financeiro',
                'dados_adicionais': {
                    'cte': cte.identificacao.numero,
                    'chave': cte.chave,
                }
            }
        )
        if created:
            criados += 1

    # Contas a pagar vencendo em 7 dias
    for conta in ContaPagar.objects.filter(status='pendente', data_vencimento__lte=hoje + timedelta(days=7)):
        prioridade = 'alta' if conta.data_vencimento <= hoje else 'media'
        _, created = AlertaSistema.objects.get_or_create(
            tipo='conta_pagar_vencendo',
            referencia=str(conta.id),
            defaults={
                'prioridade': prioridade,
                'mensagem': f"Conta a pagar '{conta.descricao}' vence em {conta.data_vencimento}.",
                'modulo': 'Financeiro',
                'dados_adicionais': {
                    'descricao': conta.descricao,
                    'valor': str(conta.valor),
                    'vencimento': str(conta.data_vencimento),
                }
            }
        )
        if created:
            criados += 1

    return {"status": "success", "alertas_criados": criados}


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def backup_database(self):
    """
    Executa backup do banco de dados via pg_dump e remove arquivos antigos.

    O backup eh salvo em backups/daily/<timestamp>.dump. Backups com mais de
    7 dias sao removidos automaticamente. Notificacoes por e-mail sao enviadas
    quando BACKUP_NOTIFICATION_EMAIL esta configurado.
    """
    backup_dir = Path(settings.BASE_DIR) / "backups" / "daily"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{timestamp}.dump"

    db = settings.DATABASES["default"]

    env = os.environ.copy()
    env["PGPASSWORD"] = db.get("PASSWORD", "")

    cmd = [
        "pg_dump",
        "-h", db.get("HOST", "localhost"),
        "-p", str(db.get("PORT", 5432)),
        "-U", db.get("USER", ""),
        "-d", db.get("NAME", ""),
        "-F", "c",
        "-f", str(backup_path),
    ]

    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            shell=False,
            check=True,
        )

        removed_count = _cleanup_old_backups(backup_dir)

        _send_notification(
            subject="[Destack Transport] Backup diario concluido",
            message=(
                f"Backup criado com sucesso: {backup_path}\n"
                f"Backups antigos removidos: {removed_count}"
            ),
        )

        return {
            "status": "success",
            "path": str(backup_path),
            "removed": removed_count,
        }

    except subprocess.CalledProcessError as exc:
        error_msg = exc.stderr or str(exc)
        _send_notification(
            subject="[Destack Transport] Falha no backup diario",
            message=f"pg_dump retornou erro (code {exc.returncode}):\n{error_msg}",
        )
        raise

    except Exception as exc:
        _send_notification(
            subject="[Destack Transport] Falha no backup diario",
            message=f"Erro inesperado durante o backup:\n{exc}",
        )
        raise


def _cleanup_old_backups(backup_dir, retention_days=7):
    """Remove arquivos .dump mais antigos que retention_days."""
    cutoff = timezone.now() - timedelta(days=retention_days)
    removed = 0
    for file_path in backup_dir.glob("*.dump"):
        try:
            mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            if mtime < cutoff:
                file_path.unlink()
                removed += 1
        except OSError:
            continue
    return removed


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sincronizar_gps(self):
    """
    Sincroniza posições de GPS dos veículos configurados.
    Por padrão itera sobre veículos com gps_identificador e gps_provedor
    preenchidos. A implementação específica de cada provedor deve ser
    adicionada conforme contrato/integração disponível.
    """
    from .models import Veiculo
    veiculos = Veiculo.objects.filter(
        ativo=True,
        gps_identificador__isnull=False,
        gps_provedor__isnull=False
    )
    sincronizados = 0
    for veiculo in veiculos:
        # Placeholder para integração real com provedor GPS.
        # Quando houver API do provedor, substituir por chamada real.
        logger.info(
            "Sincronização GPS agendada para %s (provedor=%s, identificador=%s)",
            veiculo.placa, veiculo.gps_provedor, veiculo.gps_identificador
        )
        sincronizados += 1
    return {"status": "ok", "veiculos_verificados": sincronizados}


def _send_notification(subject, message):
    """Envia e-mail de notificacao se BACKUP_NOTIFICATION_EMAIL estiver configurado."""
    recipient = getattr(settings, "BACKUP_NOTIFICATION_EMAIL", None)
    if not recipient:
        return

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "webmaster@localhost")
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[recipient],
            fail_silently=True,
        )
    except Exception:
        # Evita que falha no envio de e-mail quebre o backup.
        logger.warning("Falha ao enviar e-mail de notificacao de backup", exc_info=True)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def warm_dashboard_cache(self):
    """
    Pré-aquece o cache dos dashboards mais acessados com os filtros padrão.
    Executada periodicamente para manter a experiência do usuário rápida.
    """
    from datetime import date, timedelta
    from django.test import RequestFactory
    from django.contrib.auth.models import User
    from transport.views.dashboard_views import (
        DashboardGeralAPIView,
        FinanceiroPainelAPIView,
        CtePainelAPIView,
        MdfePainelAPIView,
        GeograficoPainelAPIView,
        FrotaPainelAPIView,
        PerformancePainelAPIView,
    )

    factory = RequestFactory()
    hoje = date.today()
    inicio_mes = date(hoje.year, hoje.month, 1)
    fim_mes = (inicio_mes.replace(month=inicio_mes.month + 1, day=1) - timedelta(days=1)) if inicio_mes.month < 12 else date(hoje.year, 12, 31)

    views = [
        DashboardGeralAPIView(),
        FinanceiroPainelAPIView(),
        CtePainelAPIView(),
        MdfePainelAPIView(),
        GeograficoPainelAPIView(),
        FrotaPainelAPIView(),
        PerformancePainelAPIView(),
    ]

    # Busca um usuário ativo qualquer para simular requisição autenticada
    try:
        user = User.objects.filter(is_active=True).first()
    except Exception:
        user = None

    if not user:
        return {"status": "skipped", "message": "Nenhum usuario ativo encontrado"}

    warmed = 0
    errors = []
    for view in views:
        try:
            request = factory.get('/api/dashboard/', {
                'data_inicio': inicio_mes.isoformat(),
                'data_fim': fim_mes.isoformat(),
            })
            request.user = user
            request.query_params = request.GET
            view.get(request)
            warmed += 1
        except Exception as exc:
            errors.append(str(exc))

    if errors and warmed == 0:
        raise RuntimeError(f"Falha ao pre-aquecer todos os dashboards: {errors}")

    return {"status": "success", "paineis_pre_aquecidos": warmed, "errors": errors}
