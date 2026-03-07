#!/bin/bash
# MongoDB backup script for EchoLink
# Usage: ./backup_mongo.sh <backup_dir>

BACKUP_DIR=${1:-./mongo_backups}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="echolink"

mkdir -p "$BACKUP_DIR"

mongodump --db "$DB_NAME" --out "$BACKUP_DIR/$TIMESTAMP"

if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_DIR/$TIMESTAMP"
else
  echo "Backup failed" >&2
  exit 1
fi
