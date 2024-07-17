#!/bin/bash

# Set variables
DB_USER="user"
DB_PASSWORD="password"
DB_NAME="todo_db"
BACKUP_DIR="/Users/rmobin/Dropbox/2024aiagents/daily-todos/dbbackups"  # Change this to your desired backup directory
DATE=$(date +"%Y%m%d%H%M")
BACKUP_FILE="$BACKUP_DIR/$DB_NAME-$DATE.sql"

# Create backup using docker exec and passing the password securely
docker exec -i mysql /bin/bash -c "mysqldump -u$DB_USER -p$DB_PASSWORD $DB_NAME" > $BACKUP_FILE

# Remove backups older than 7 days
find $BACKUP_DIR -type f -name "$DB_NAME-*.sql" -mtime +7 -exec rm {} \;
