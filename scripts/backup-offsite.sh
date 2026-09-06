#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

CONFIG_FILE="${BACKUP_OFFSITE_CONFIG:-/etc/destack/backup-offsite.env}"
STATUS_DIR="${STATUS_DIR:-/var/lib/destack-monitor}"
timestamp="$(date -u +%Y%m%d_%H%M%S)"
stage_dir=""
remote_partial=""
completed=false
ssh_options=()

notify_failure() {
    local message="Backup externo Destack falhou em $(hostname) (execucao $timestamp)."
    logger -t destack-backup-offsite "$message"
    if [[ -n "${BACKUP_ALERT_WEBHOOK_URL:-}" ]]; then
        curl -fsS --max-time 15 \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"$message\"}" \
            "$BACKUP_ALERT_WEBHOOK_URL" >/dev/null || true
    fi
}

cleanup() {
    local exit_code=$?
    if [[ -n "$stage_dir" && -d "$stage_dir" ]]; then
        rm -rf -- "$stage_dir"
    fi
    if [[ "$completed" != true ]]; then
        mkdir -p "$STATUS_DIR"
        printf '%s exit=%s\n' "$(date -u +%FT%TZ)" "$exit_code" > "$STATUS_DIR/backup-offsite.failed"
        if [[ -n "$remote_partial" && -n "${OFFSITE_USER:-}" && -n "${OFFSITE_HOST:-}" && ${#ssh_options[@]} -gt 0 ]]; then
            ssh "${ssh_options[@]}" "$OFFSITE_USER@$OFFSITE_HOST" \
                rm -rf -- "$remote_partial" >/dev/null 2>&1 || true
        fi
        notify_failure
    fi
}
trap cleanup EXIT

if [[ ! -r "$CONFIG_FILE" ]]; then
    echo "ERRO: configuracao nao encontrada: $CONFIG_FILE" >&2
    exit 2
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

APP_DIR="${APP_DIR:-/root/apps/destack}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-destack_postgres}"
POSTGRES_DB="${POSTGRES_DB:-destack_db}"
POSTGRES_USER="${POSTGRES_USER:-destack_user}"
APP_ENV_FILE="${APP_ENV_FILE:-$APP_DIR/.env}"
MINIO_NETWORK="${MINIO_NETWORK:-destack_destack_network}"
MINIO_MC_IMAGE="${MINIO_MC_IMAGE:-minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727}"
OFFSITE_RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-30}"
LOCK_FILE="${LOCK_FILE:-/run/lock/destack-backup-offsite.lock}"
BACKUP_ALERT_WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-}"
BACKUP_GNUPGHOME="${BACKUP_GNUPGHOME:-/etc/destack/backup-gpg}"

read_app_env() {
    local variable="$1"
    sed -n "s/^${variable}=//p" "$APP_ENV_FILE" | tail -n 1
}

MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-$(read_app_env MINIO_ACCESS_KEY)}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-$(read_app_env MINIO_SECRET_KEY)}"

required=(MINIO_BUCKET_NAME MINIO_ACCESS_KEY MINIO_SECRET_KEY OFFSITE_HOST OFFSITE_USER OFFSITE_PATH OFFSITE_SSH_KEY BACKUP_GPG_RECIPIENT)
for variable in "${required[@]}"; do
    if [[ -z "${!variable:-}" ]]; then
        echo "ERRO: $variable nao configurado em $CONFIG_FILE" >&2
        exit 2
    fi
done

if [[ ! "$OFFSITE_PATH" =~ ^/[A-Za-z0-9._/-]+$ ]] \
    || [[ "$OFFSITE_PATH" == "/" ]] \
    || [[ "$OFFSITE_PATH" == *"//"* ]] \
    || [[ "$OFFSITE_PATH" == *"/../"* ]] \
    || [[ "$OFFSITE_PATH" == */.. ]] \
    || [[ ${#OFFSITE_PATH} -lt 8 ]]; then
    echo "ERRO: OFFSITE_PATH inseguro: $OFFSITE_PATH" >&2
    exit 2
fi
if [[ ! "$MINIO_BUCKET_NAME" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
    echo "ERRO: MINIO_BUCKET_NAME invalido" >&2
    exit 2
fi
if [[ ! "$OFFSITE_RETENTION_DAYS" =~ ^[0-9]+$ ]] || (( OFFSITE_RETENTION_DAYS < 7 )); then
    echo "ERRO: OFFSITE_RETENTION_DAYS deve ser um inteiro maior ou igual a 7" >&2
    exit 2
fi
if [[ ! -r "$OFFSITE_SSH_KEY" ]]; then
    echo "ERRO: chave SSH nao encontrada: $OFFSITE_SSH_KEY" >&2
    exit 2
fi
if [[ ! -d "$BACKUP_GNUPGHOME" ]] \
    || ! gpg --homedir "$BACKUP_GNUPGHOME" --batch --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1; then
    echo "ERRO: chave publica GPG de backup nao encontrada" >&2
    exit 2
fi

mkdir -p "$STATUS_DIR" "$(dirname "$LOCK_FILE")" "$APP_DIR/backups/offsite-staging"
exec 9>"$LOCK_FILE"
if ! flock -w 7200 9; then
    echo "Outro backup externo ou deploy permaneceu em execucao por mais de duas horas." >&2
    exit 3
fi

stage_dir="$(mktemp -d "$APP_DIR/backups/offsite-staging/run.XXXXXX")"

database_dump="$stage_dir/database.dump"
docker exec "$POSTGRES_CONTAINER" \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl \
    > "$database_dump.tmp"
mv "$database_dump.tmp" "$database_dump"
docker exec -i "$POSTGRES_CONTAINER" pg_restore --list < "$database_dump" >/dev/null

mkdir -p "$stage_dir/media"
docker run --rm \
    --network "$MINIO_NETWORK" \
    --volume "$stage_dir/media:/backup" \
    --env MINIO_ACCESS_KEY="$MINIO_ACCESS_KEY" \
    --env MINIO_SECRET_KEY="$MINIO_SECRET_KEY" \
    --entrypoint /bin/sh \
    "$MINIO_MC_IMAGE" -c '
    set -eu
    mc alias set source http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
    mc mirror --quiet --overwrite "source/$1" /backup
' sh "$MINIO_BUCKET_NAME"
tar -czf "$stage_dir/media.tar.gz" -C "$stage_dir/media" .
rm -rf -- "$stage_dir/media"

# O volume legado ainda contem anexos que podem nao estar no MinIO. Mantemos
# ambos ate uma auditoria abrangente comprovar que o volume pode ser aposentado.
docker run --rm \
    --network none \
    --read-only \
    --cap-drop ALL \
    --cap-add DAC_OVERRIDE \
    --cap-add DAC_READ_SEARCH \
    --security-opt no-new-privileges:true \
    --volume destack_media_volume:/source:ro \
    --volume "$stage_dir:/backup" \
    --entrypoint tar \
    python:3.11-slim@sha256:9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534 \
    -czf /backup/media-volume.tar.gz -C /source .
tar -tzf "$stage_dir/media-volume.tar.gz" >/dev/null

for asset in database.dump media.tar.gz media-volume.tar.gz; do
    gpg --homedir "$BACKUP_GNUPGHOME" \
        --batch --yes --trust-model always \
        --recipient "$BACKUP_GPG_RECIPIENT" \
        --output "$stage_dir/$asset.gpg" \
        --encrypt "$stage_dir/$asset"
    rm -f -- "$stage_dir/$asset"
done

(
    cd "$stage_dir"
    sha256sum database.dump.gpg media.tar.gz.gpg media-volume.tar.gz.gpg > SHA256SUMS
    printf 'release=%s\ncreated_at=%s\nhost=%s\ngpg_recipient=%s\n' \
        "$(cat "$APP_DIR/.release" 2>/dev/null || echo unknown)" \
        "$(date -u +%FT%TZ)" \
        "$(hostname)" \
        "$BACKUP_GPG_RECIPIENT" > MANIFEST.txt
)

ssh_options=(
    -i "$OFFSITE_SSH_KEY"
    -o BatchMode=yes
    -o StrictHostKeyChecking=yes
    -o IdentitiesOnly=yes
)
remote="$OFFSITE_USER@$OFFSITE_HOST"
remote_release="$OFFSITE_PATH/$timestamp"
remote_partial="$OFFSITE_PATH/.partial-$timestamp"

ssh "${ssh_options[@]}" "$remote" sh -s -- "$OFFSITE_PATH" "$remote_partial" <<'REMOTE_PREPARE'
set -eu
base="$1"
partial="$2"
canonical_base="$(realpath -m "$base")"
canonical_partial="$(realpath -m "$partial")"
case "$canonical_partial" in
    "$canonical_base"/.partial-*) ;;
    *) echo "Destino parcial inseguro" >&2; exit 2 ;;
esac
test -d "$canonical_base"
test ! -e "$canonical_partial"
mkdir -p -- "$canonical_partial"
REMOTE_PREPARE
rsync -az --partial --chmod=F600,D700 \
    -e "ssh -i $OFFSITE_SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes" \
    "$stage_dir/" "$remote:$remote_partial/"
ssh "${ssh_options[@]}" "$remote" sh -s -- "$remote_partial" "$remote_release" <<'REMOTE_COMMIT'
set -eu
partial="$1"
release="$2"
test -d "$partial"
test ! -e "$release"
cd "$partial"
sha256sum -c SHA256SUMS >/dev/null
printf '%s\n' "$(date -u +%FT%TZ)" > COMPLETE
cd ..
mv -- "$partial" "$release"
REMOTE_COMMIT
remote_partial=""

ssh "${ssh_options[@]}" "$remote" sh -s -- "$OFFSITE_PATH" "$OFFSITE_RETENTION_DAYS" <<'REMOTE_CLEANUP'
set -eu
base="$1"
retention="$2"
case "$base" in
    /|"") echo "Destino inseguro" >&2; exit 2 ;;
esac
find "$base" -mindepth 1 -maxdepth 1 -type d \
    -name '20??????_??????' -mtime "+$retention" -exec rm -rf -- {} +
REMOTE_CLEANUP

printf '%s %s\n' "$(date -u +%FT%TZ)" "$remote_release" > "$STATUS_DIR/backup-offsite.success"
rm -f "$STATUS_DIR/backup-offsite.failed"
completed=true
echo "Backup externo concluido e verificado em $remote:$remote_release"
