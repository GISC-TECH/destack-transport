#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CONFIG_FILE="${OFFSITE_SEAL_CONFIG:-/etc/destack/offsite-seal.env}"
[[ -r "$CONFIG_FILE" ]] || { echo "Configuracao ausente: $CONFIG_FILE" >&2; exit 2; }
# shellcheck disable=SC1090
source "$CONFIG_FILE"

INCOMING_DIR="${INCOMING_DIR:?configure INCOMING_DIR}"
ARCHIVE_DIR="${ARCHIVE_DIR:?configure ARCHIVE_DIR}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

for directory in "$INCOMING_DIR" "$ARCHIVE_DIR"; do
    [[ "$directory" == /* \
        && "$directory" != "/" \
        && "$directory" != *"//"* \
        && "$directory" != *"/../"* \
        && "$directory" != */.. \
        && ${#directory} -ge 8 ]] \
        || { echo "Diretorio inseguro: $directory" >&2; exit 2; }
done
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && (( RETENTION_DAYS >= 7 )) \
    || { echo "Retencao invalida" >&2; exit 2; }

install -d -o root -g root -m 0700 "$ARCHIVE_DIR"
exec 9>/run/lock/destack-seal-offsite.lock
flock -n 9 || exit 0

for candidate in "$INCOMING_DIR"/20??????_??????; do
    [[ -d "$candidate" && ! -L "$candidate" && -f "$candidate/COMPLETE" ]] || continue
    release="$(basename "$candidate")"
    destination="$ARCHIVE_DIR/$release"
    [[ ! -e "$destination" ]] || { echo "Release duplicada: $release" >&2; exit 1; }
    (cd "$candidate" && sha256sum -c SHA256SUMS >/dev/null)
    mv -- "$candidate" "$destination"
    chown -R root:root "$destination"
    find "$destination" -type d -exec chmod 0700 {} +
    find "$destination" -type f -exec chmod 0600 {} +
    logger -t destack-seal-offsite "Backup selado: $destination"
done

find "$ARCHIVE_DIR" -mindepth 1 -maxdepth 1 -type d \
    -name '20??????_??????' -mtime "+$RETENTION_DAYS" -exec rm -rf -- {} +
find "$INCOMING_DIR" -mindepth 1 -maxdepth 1 -type d \
    -name '.partial-*' -mtime +2 -exec rm -rf -- {} +
