#!/bin/bash

# =============================================
# Hotel PMS - Schema V11 Forecast Deployment
# =============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_PROJECT_REF="rbpiwglmpahwvabzcgzr"
DB_HOST="db.rbpiwglmpahwvabzcgzr.supabase.co"
DB_NAME="postgres"

# Get database password from environment or prompt
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_DB_PASSWORD not set${NC}"
    echo -e "${BLUE}Please enter your Supabase database password:${NC}"
    read -s -p "Password: " SUPABASE_DB_PASSWORD
    echo
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════╗"
echo "║   HOTEL PMS - SCHEMA V11 FORECAST DEPLOYMENT      ║"
echo "║   Project: $SUPABASE_PROJECT_REF                         ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Deploying: Schema V11 - Forecast (KFO Parity)"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Deploy Schema V11
if PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
    -U postgres \
    -d "$DB_NAME" \
    -f "schema_v11_forecast.sql"; then
    echo -e "${GREEN}✅ SUCCESS: Schema V11 Forecast Tables${NC}"
else
    echo -e "${RED}❌ FAILED: Schema V11 Forecast Tables${NC}"
    exit 1
fi

# Verification
echo -e "${BLUE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

TABLES=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
    -U postgres -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = 'public'
             AND table_name IN ('forecast_configurations', 'room_status_dates',
                               'corporate_allotments', 'forecast_room_daily',
                               'forecast_summary_daily');" 2>/dev/null || echo "0")

if [ "${TABLES// /}" -ge 5 ]; then
    echo -e "${GREEN}✅ Forecast Tables verified: ${TABLES// /}/5 tables${NC}"
else
    echo -e "${RED}❌ Forecast Tables verification failed: ${TABLES// /}/5 tables${NC}"
    exit 1
fi

# Check functions
FUNCTIONS=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
    -U postgres -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.routines
             WHERE routine_schema = 'public'
             AND routine_name IN ('get_room_status_for_date',
                                 'is_room_occupied_on_date',
                                 'get_date_premium',
                                 'get_effective_forecast_rate');" 2>/dev/null || echo "0")

if [ "${FUNCTIONS// /}" -ge 4 ]; then
    echo -e "${GREEN}✅ Helper Functions verified: ${FUNCTIONS// /}/4 functions${NC}"
else
    echo -e "${YELLOW}⚠️  Helper Functions: ${FUNCTIONS// /}/4 functions${NC}"
fi

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════╗"
echo "║             ✅ DEPLOYMENT SUCCESSFUL                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "1. Create sample forecast configuration"
echo -e "2. Generate forecast data"
echo -e "3. Implement Phase 2: RPC Functions"
echo
