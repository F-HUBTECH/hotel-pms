#!/bin/bash

# =============================================
# Hotel PMS - Forecast Schema Deployment Script
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
echo "║   HOTEL PMS - FORECAST SCHEMA DEPLOYMENT            ║"
echo "║   Project: $SUPABASE_PROJECT_REF                         ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📦 Deploying forecast schema...${NC}"
echo ""

# Execute the deployment SQL file
if PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
        -U postgres \
        -d "$DB_NAME" \
        -f "deploy-forecast-complete.sql"; then
    echo -e "${GREEN}✅ SUCCESS: Forecast schema deployed${NC}"
else
    echo -e "${RED}❌ FAILED: Forecast schema deployment${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Verifying deployment...${NC}"

# Check tables
TABLES=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
    -U postgres -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = 'public'
             AND table_name IN ('forecast_configurations', 'room_status_dates',
                               'corporate_allotments', 'forecast_room_daily',
                               'forecast_summary_daily');" 2>/dev/null || echo "0")

if [ "$TABLES" -eq 5 ]; then
    echo -e "${GREEN}✅ Tables: $TABLES/5 created${NC}"
else
    echo -e "${YELLOW}⚠️  Tables: $TABLES/5 created (expected 5)${NC}"
fi

# Check functions
FUNCTIONS=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
    -U postgres -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.routines
             WHERE routine_schema = 'public'
             AND routine_name LIKE 'rpc_%';" 2>/dev/null || echo "0")

if [ "$FUNCTIONS" -ge 6 ]; then
    echo -e "${GREEN}✅ RPC Functions: $FUNCTIONS created${NC}"
else
    echo -e "${YELLOW}⚠️  RPC Functions: $FUNCTIONS created (expected 6+)${NC}"
fi

# Check views
VIEWS=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
    -U postgres -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.views
             WHERE table_schema = 'public'
             AND table_name LIKE 'v_forecast%';" 2>/dev/null || echo "0")

if [ "$VIEWS" -eq 6 ]; then
    echo -e "${GREEN}✅ Views: $VIEWS/6 created${NC}"
else
    echo -e "${YELLOW}⚠️  Views: $VIEWS created (expected 6)${NC}"
fi

echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT SUCCESSFUL                ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "1. Test forecast generation at /dashboard/reports/forecast/grid"
echo -e "2. Test summary view at /dashboard/reports/forecast/summary"
echo -e "3. Test adjustments at /dashboard/reports/forecast/adjustments"
echo -e "4. Compare with KFO system output"
echo ""
