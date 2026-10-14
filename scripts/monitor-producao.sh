#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/root/apps/destack}"
STATUS_DIR="${STATUS_DIR:-/var/lib/destack-monitor}"
MAX_BACKUP_AGE_MINUTES="${MAX_BACKUP_AGE_MINUTES:-2160}"
MAX_DISK_USAGE_PERCENT="${MAX_DISK_USAGE_PERCENT:-85}"
MONITOR_ALERT_WEBHOOK_URL="${MONITOR_ALERT_WEBHOOK_URL:-}"
required_containers=(
    destack_postgres
    destack_redis
    destack_minio
    destack_web
    destack_frontend
    destack_celery_worker
    destack_celery_beat
    destack_scraper
)

errors=()

add_error() {
    errors+=("$1")
}

record_app_alert() {
    local message="$1"
    docker exec -e DESTACK_MONITOR_MESSAGE="$message" destack_web \
        python manage.py shell -c '
import os
from transport.models import AlertaSistema
message = os.environ["DESTACK_MONITOR_MESSAGE"][:1000]
alert, _ = AlertaSistema.objects.get_or_create(
    tipo="monitor_operacional_falhou",
    referencia="monitor_producao",
    resolvido=False,
    defaults={"prioridade": "alta", "modulo": "Infraestrutura", "mensagem": message},
)
if alert.mensagem != message or alert.lido:
    alert.mensagem = message
    alert.lido = False
    alert.prioridade = "alta"
    alert.save(update_fields=["mensagem", "lido", "prioridade"])
' >/dev/null 2>&1 || true
}

resolve_app_alert() {
    docker exec destack_web python manage.py shell -c '
from django.utils import timezone
from transport.models import AlertaSistema
AlertaSistema.objects.filter(
    tipo="monitor_operacional_falhou",
    referencia="monitor_producao",
    resolvido=False,
).update(resolvido=True, data_resolucao=timezone.now())
' >/dev/null 2>&1 || true
}

for container in "${required_containers[@]}"; do
    if ! docker inspect "$container" >/dev/null 2>&1; then
        add_error "$container inexistente"
        continue
    fi

    state="$(docker inspect --format '{{.State.Status}}' "$container")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
    if [[ "$state" != "running" ]]; then
        add_error "$container estado=$state"
    elif [[ "$health" != "none" && "$health" != "healthy" ]]; then
        add_error "$container health=$health"
    fi

    if [[ "$state" == "running" ]]; then
        zombie_count="$(
            docker top "$container" -eo pid,stat 2>/dev/null \
                | awk 'NR > 1 && $2 ~ /^Z/ {count++} END {print count+0}' \
                || true
        )"
        if (( ${zombie_count:-0} > 0 )); then
            add_error "$container zumbis=$zombie_count"
        fi
    fi
done

if ! curl -fsS --max-time 20 https://destacktransporte.com/api/health/ >/dev/null; then
    add_error "health HTTP externo indisponivel"
fi

if ! docker exec destack_web python manage.py shell -c '
from datetime import datetime, timedelta
from django.core.cache import cache
from django.utils import timezone
value = cache.get("operations:alerts:last_success")
if not value:
    raise SystemExit(1)
last_success = datetime.fromisoformat(value)
if timezone.now() - last_success > timedelta(hours=36):
    raise SystemExit(1)
' >/dev/null 2>&1; then
    add_error "tarefa Celery de alertas sem sucesso nas ultimas 36 horas"
fi

latest_backup=""
latest_backup_mtime=0
for candidate in "$APP_DIR"/backups/daily/*.dump; do
    [[ -f "$candidate" ]] || continue
    candidate_mtime="$(stat -c %Y "$candidate" 2>/dev/null || echo 0)"
    if (( candidate_mtime > latest_backup_mtime )); then
        latest_backup="$candidate"
        latest_backup_mtime="$candidate_mtime"
    fi
done

if [[ -z "$latest_backup" ]] \
    || (( $(date +%s) - latest_backup_mtime > MAX_BACKUP_AGE_MINUTES * 60 )); then
    add_error "backup local ausente ou mais antigo que ${MAX_BACKUP_AGE_MINUTES} minutos"
elif [[ ! -f "$latest_backup.sha256" ]] \
    || ! (cd "$(dirname "$latest_backup")" && sha256sum -c "$(basename "$latest_backup").sha256" >/dev/null 2>&1) \
    || ! docker exec -i destack_postgres pg_restore --list < "$latest_backup" >/dev/null 2>&1; then
    add_error "backup local recente falhou na validacao de integridade"
fi

offsite_status="$STATUS_DIR/backup-offsite.success"
if [[ ! -f "$offsite_status" ]] || ! find "$offsite_status" -mmin "-$MAX_BACKUP_AGE_MINUTES" -print -quit | grep -q .; then
    add_error "backup externo ausente ou desatualizado"
fi
if [[ -f "$STATUS_DIR/backup-offsite.failed" ]] \
    && { [[ ! -f "$offsite_status" ]] || [[ "$STATUS_DIR/backup-offsite.failed" -nt "$offsite_status" ]]; }; then
    add_error "ultima tentativa de backup externo falhou"
fi

disk_usage="$(df -P / | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"
if (( disk_usage >= MAX_DISK_USAGE_PERCENT )); then
    add_error "disco em ${disk_usage}%"
fi

mkdir -p "$STATUS_DIR"
if (( ${#errors[@]} > 0 )); then
    message="Monitor Destack falhou em $(hostname): $(IFS='; '; echo "${errors[*]}")"
    printf '%s %s\n' "$(date -u +%FT%TZ)" "$message" > "$STATUS_DIR/monitor.failed"
    logger -t destack-monitor "$message"
    record_app_alert "$message"
    if [[ -n "$MONITOR_ALERT_WEBHOOK_URL" ]]; then
        curl -fsS --max-time 15 \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"$message\"}" \
            "$MONITOR_ALERT_WEBHOOK_URL" >/dev/null || true
    fi
    printf '%s\n' "$message" >&2
    exit 1
fi

rm -f "$STATUS_DIR/monitor.failed"
resolve_app_alert
printf '%s healthy\n' "$(date -u +%FT%TZ)" > "$STATUS_DIR/monitor.success"
echo "Todos os componentes do Destack estao saudaveis."
