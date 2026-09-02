#!/usr/bin/env bash

set -Eeuo pipefail

readonly BACKUP_DIR="/opt/daily-assistant-preview/shared/backups"
readonly DATABASE_NAME="daily_assistant_preview"
readonly APP_USER="daily-assistant-preview"
readonly RETENTION_DAYS=7

umask 077

/usr/bin/install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$BACKUP_DIR"

timestamp=$(/usr/bin/date -u +%Y%m%dT%H%M%SZ)
temporary_file="$BACKUP_DIR/.${DATABASE_NAME}_${timestamp}.sql.gz.tmp"
backup_file="$BACKUP_DIR/${DATABASE_NAME}_${timestamp}.sql.gz"

cleanup_temporary_file() {
  /usr/bin/rm -f -- "$temporary_file"
}

trap cleanup_temporary_file EXIT

/usr/bin/mysqldump \
  --protocol=socket \
  --single-transaction \
  --routines \
  --events \
  --triggers \
  --no-tablespaces \
  "$DATABASE_NAME" \
  | /usr/bin/gzip -c > "$temporary_file"

/usr/bin/gzip -t -- "$temporary_file"
/usr/bin/chown "$APP_USER:$APP_USER" "$temporary_file"
/usr/bin/chmod 600 "$temporary_file"
/usr/bin/mv -- "$temporary_file" "$backup_file"

removed_count=$(
  /usr/bin/find "$BACKUP_DIR" \
    -mindepth 1 \
    -maxdepth 1 \
    -type f \
    -name "${DATABASE_NAME}_*.sql.gz" \
    -mtime "+${RETENTION_DAYS}" \
    -print \
    -delete \
    | /usr/bin/wc -l
)

backup_bytes=$(/usr/bin/stat -c %s -- "$backup_file")
printf 'backup_created=%s backup_bytes=%s removed_old_backups=%s retention_days=%s\n' \
  "$backup_file" "$backup_bytes" "$removed_count" "$RETENTION_DAYS"
