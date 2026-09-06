#!/usr/bin/env bash
set -Eeuo pipefail

# Publica um artefato Git imutavel no servidor. O host remoto nao precisa conter
# um clone do repositorio.
PROD_SSH="${PROD_SSH:-}"
VERSION="${VERSION:-}"
REMOTE_DIR="${REMOTE_DIR:-/root/apps/destack}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.contabo.yml}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-destack_postgres}"
POSTGRES_DB="${POSTGRES_DB:-destack_db}"
POSTGRES_USER="${POSTGRES_USER:-destack_user}"
SSH_KEY="${SSH_KEY:-}"

if [[ -z "$PROD_SSH" || -z "$VERSION" ]]; then
    echo "Uso: PROD_SSH=root@servidor VERSION=vX.Y.Z [SSH_KEY=/caminho/chave] $0" >&2
    exit 2
fi
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "ERRO: VERSION deve ser uma tag no formato vX.Y.Z" >&2
    exit 2
fi
if [[ "$REMOTE_DIR" != /* || "$REMOTE_DIR" == "/" || ${#REMOTE_DIR} -lt 8 ]]; then
    echo "ERRO: REMOTE_DIR inseguro: $REMOTE_DIR" >&2
    exit 2
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
commit="$(git rev-parse "$VERSION^{commit}")"
tag_commit="$(git rev-list -n 1 "$VERSION")"
if [[ "$commit" != "$tag_commit" ]]; then
    echo "ERRO: nao foi possivel resolver a tag $VERSION" >&2
    exit 2
fi

archive="$(mktemp "/tmp/destack-${VERSION}.XXXXXX")"
trap 'rm -f -- "$archive"' EXIT
git archive --format=tar.gz --output="$archive" "$commit"
archive_sha="$(sha256sum "$archive" | awk '{print $1}')"
remote_archive="/tmp/destack-${VERSION}-${commit:0:12}.tar.gz"

ssh_options=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes)
if [[ -n "$SSH_KEY" ]]; then
    ssh_options+=(-i "$SSH_KEY")
fi

echo "Enviando artefato $VERSION ($commit)..."
scp "${ssh_options[@]}" "$archive" "$PROD_SSH:$remote_archive"

ssh "${ssh_options[@]}" "$PROD_SSH" bash -s -- \
    "$REMOTE_DIR" "$COMPOSE_FILE" "$VERSION" "$commit" "$remote_archive" \
    "$archive_sha" "$POSTGRES_CONTAINER" "$POSTGRES_DB" "$POSTGRES_USER" <<'REMOTE_DEPLOY'
set -Eeuo pipefail
umask 077

remote_dir="$1"
compose_file="$2"
version="$3"
commit="$4"
remote_archive="$5"
expected_sha="$6"
postgres_container="$7"
postgres_db="$8"
postgres_user="$9"

install -d -m 0700 /run/lock
exec 9>/run/lock/destack-deploy.lock
if ! flock -n 9; then
    echo "ERRO: outro deploy do Destack ja esta em execucao" >&2
    exit 3
fi
exec 8>/run/lock/destack-backup-offsite.lock
if ! flock -w 7200 8; then
    echo "ERRO: backup externo permaneceu em execucao por mais de duas horas" >&2
    exit 3
fi

cd "$remote_dir"
actual_sha="$(sha256sum "$remote_archive" | awk '{print $1}')"
[[ "$actual_sha" == "$expected_sha" ]] || { echo "ERRO: checksum do artefato divergiu" >&2; exit 1; }

stamp="$(date -u +%Y%m%d_%H%M%S)"
release_dir="$remote_dir/releases/$version-$commit"
previous_dir="$remote_dir/releases/rollback-$stamp"
predeploy_backup="$remote_dir/backups/predeploy/${postgres_db}_pre_${version}_${stamp}.dump"
mkdir -p "$release_dir" "$previous_dir" "$remote_dir/backups/predeploy" "$remote_dir/logs"

declare -A previous_image_ids previous_image_refs
for container in destack_web destack_frontend destack_celery_worker destack_celery_beat destack_scraper; do
    if docker inspect "$container" >/dev/null 2>&1; then
        previous_image_ids["$container"]="$(docker inspect --format '{{.Image}}' "$container")"
        previous_image_refs["$container"]="$(docker inspect --format '{{.Config.Image}}' "$container")"
    fi
done

echo "Criando e validando backup pre-deploy..."
docker exec "$postgres_container" \
    pg_dump -U "$postgres_user" -d "$postgres_db" -Fc --no-owner --no-acl \
    > "$predeploy_backup.tmp"
docker exec -i "$postgres_container" pg_restore --list < "$predeploy_backup.tmp" >/dev/null
mv "$predeploy_backup.tmp" "$predeploy_backup"
sha256sum "$predeploy_backup" > "$predeploy_backup.sha256"

rsync -a \
    --exclude='.env' --exclude='.git' --exclude='backups' --exclude='logs' --exclude='releases' \
    "$remote_dir/" "$previous_dir/"
tar -xzf "$remote_archive" -C "$release_dir"

core_operational() {
    local container state health
    curl -fsS --max-time 10 https://destacktransporte.com/api/health/ >/dev/null || return 1
    for container in destack_web destack_frontend destack_celery_worker destack_celery_beat; do
        state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null)"
        health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null)"
        [[ "$state" == "running" ]] || return 1
        [[ "$health" == "healthy" || "$health" == "none" ]] || return 1
    done
}

scraper_operational() {
    [[ "$(docker inspect --format '{{.State.Status}}' destack_scraper 2>/dev/null)" == "running" ]] \
        && docker exec destack_scraper sh -ec '
            pgrep -f "[p]ython scheduler.py" >/dev/null
            test ! -f /app/data/last_job_failed
            test -f /app/data/last_success
            test $(($(date +%s) - $(stat -c %Y /app/data/last_success))) -lt 28800
            test "$(curl -fsS --max-time 20 -x "$CHROME_PROXY_URL" https://ipinfo.io/country | tr -d "\r\n")" = "BR"
        '
}

rollback() {
    local exit_code=$?
    local rollback_healthy=false
    trap - ERR
    set +e
    echo "Deploy falhou; restaurando o codigo anterior..." >&2
    rsync -a --delete \
        --exclude='.env' --exclude='.git' --exclude='backups' --exclude='logs' --exclude='releases' \
        "$previous_dir/" "$remote_dir/"
    for container in "${!previous_image_ids[@]}"; do
        docker image tag "${previous_image_ids[$container]}" "${previous_image_refs[$container]}"
    done
    docker compose -f "$compose_file" --profile contabo-scraper run --rm --no-deps \
        --entrypoint python web manage.py collectstatic --noinput
    docker compose -f "$compose_file" --profile contabo-scraper up -d --no-build \
        web frontend celery_worker celery_beat scraper
    for attempt in $(seq 1 40); do
        if core_operational && scraper_operational; then
            rollback_healthy=true
            break
        fi
        sleep 3
    done
    if [[ "$rollback_healthy" == true ]]; then
        echo "Rollback do codigo e das imagens concluido e saudavel." >&2
    else
        echo "ERRO: rollback iniciado, mas o health check nao recuperou; intervencao manual necessaria." >&2
    fi
    echo "O banco nao foi revertido automaticamente. Backup pre-deploy: $predeploy_backup" >&2
    exit "$exit_code"
}
trap rollback ERR

rsync -a --delete \
    --exclude='.env' --exclude='.git' --exclude='backups' --exclude='logs' --exclude='releases' \
    "$release_dir/" "$remote_dir/"
chmod +x scripts/*.sh
install -d -o 10001 -g 10001 -m 0700 "$remote_dir/logs" "$remote_dir/backups/daily"
chown -R 10001:10001 "$remote_dir/logs" "$remote_dir/backups/daily"

docker compose -f "$compose_file" --profile contabo-scraper config --quiet
docker compose -f "$compose_file" --profile contabo-scraper build \
    web frontend celery_worker celery_beat scraper
docker compose -f "$compose_file" --profile contabo-scraper run --rm --no-deps \
    --user 0:0 --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add DAC_READ_SEARCH \
    --entrypoint chown web \
    -R 10001:10001 /app/staticfiles /app/media /app/logs /app/backups/daily
docker compose -f "$compose_file" --profile contabo-scraper run --rm \
    --entrypoint python web manage.py migrate --noinput
docker compose -f "$compose_file" --profile contabo-scraper run --rm \
    --entrypoint python web manage.py collectstatic --noinput
docker compose -f "$compose_file" --profile contabo-scraper run --rm \
    --entrypoint python web manage.py gerar_alertas
docker compose -f "$compose_file" --profile contabo-scraper run --rm \
    --entrypoint python web manage.py backup_now
docker compose -f "$compose_file" --profile contabo-scraper up -d \
    web frontend celery_worker celery_beat scraper

for attempt in $(seq 1 40); do
    if core_operational; then
        break
    fi
    if [[ "$attempt" == 40 ]]; then
        echo "ERRO: servicos nao ficaram saudaveis no prazo" >&2
        exit 1
    fi
    sleep 3
done

for attempt in $(seq 1 60); do
    if scraper_operational; then
        break
    fi
    if [[ "$attempt" == 60 ]]; then
        echo "ERRO: scraper nao ficou operacional no prazo" >&2
        exit 1
    fi
    sleep 10
done

printf '%s %s\n' "$version" "${commit:0:7}" > .release
install -m 0644 ops/systemd/destack-backup-offsite.service /etc/systemd/system/
install -m 0644 ops/systemd/destack-backup-offsite.timer /etc/systemd/system/
install -m 0644 ops/systemd/destack-monitor.service /etc/systemd/system/
install -m 0644 ops/systemd/destack-monitor.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now destack-backup-offsite.timer destack-monitor.timer
find "$remote_dir/backups/predeploy" -maxdepth 1 -type f \
    \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime +30 -delete
find "$remote_dir/releases" -mindepth 1 -maxdepth 1 -type d -mtime +30 \
    -exec rm -rf -- {} +
rm -f -- "$remote_archive"
trap - ERR
echo "Deploy $version concluido. Backup: $predeploy_backup"
REMOTE_DEPLOY
