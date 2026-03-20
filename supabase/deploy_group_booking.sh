#!/bin/bash

# =============================================
# Deploy Group Booking Schema to Supabase
# =============================================

set -e

SUPABASE_PROJECT_REF="rbpiwglmpahwvabzcgzr"
DB_HOST="db.rbpiwglmpahwvabzcgzr.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="MfJiwn8MgsXskwDf"

echo "=========================================="
echo "Deploying Group Booking Schema"
echo "=========================================="

echo "Testing connection..."
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" 2>/dev/null || {
    echo "ERROR: Cannot connect to database"
    echo "Please check your IP is whitelisted in Supabase dashboard"
    exit 1
}

echo "Running schema_v12_group_booking.sql..."
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "../schema_v12_group_booking.sql"

echo ""
echo "=========================================="
echo "✅ Deployment completed!"
echo "=========================================="
