#!/bin/bash

# =============================================
# Hotel PMS - Supabase Production Deployment Script
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

# Function to print status
print_status() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "$1"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to execute SQL
execute_sql() {
    local file=$1
    local description=$2

    echo -e "${BLUE}▶️  Deploying: $description${NC}"

    if PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
        -U postgres \
        -d "$DB_NAME" \
        -f "$file"; then
        echo -e "${GREEN}✅ SUCCESS: $description${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED: $description${NC}"
        return 1
    fi
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# =============================================
# DEPLOYMENT SEQUENCE
# =============================================

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════╗"
echo "║   HOTEL PMS - SUPABASE PRODUCTION DEPLOYMENT     ║"
echo "║   Project: $SUPABASE_PROJECT_REF                         ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

print_status "Schema V8: Billing & Folio (CORE)"

# Schema V8 components
execute_sql "schema_v8_billing_folio.sql" "Billing Folio Tables"

if [ $? -eq 0 ]; then
    # Verify V8 deployment
    echo -e "${BLUE}🔍 Verifying V8 deployment...${NC}"

    TABLES=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
        -U postgres -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables
                 WHERE table_schema = 'public'
                 AND table_name IN ('folios', 'folio_items', 'folio_payments',
                                   'revenue_transaction_codes', 'billing_addresses',
                                   'tax_invoices', 'folio_setup');" 2>/dev/null || echo "0")

    if [ "$TABLES" -ge 8 ]; then
        echo -e "${GREEN}✅ V8 Tables verified: $TABLES/8 tables${NC}"
    else
        echo -e "${RED}❌ V8 Tables verification failed: $TABLES/8 tables${NC}"
        exit 1
    fi

    # Verify transaction codes
    CODES=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
        -U postgres -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM revenue_transaction_codes;" 2>/dev/null || echo "0")

    if [ "$CODES" -ge 25 ]; then
        echo -e "${GREEN}✅ Transaction Codes verified: $CODES/25 codes${NC}"
    else
        echo -e "${YELLOW}⚠️  Transaction Codes: $CODES/25 codes (some may be missing)${NC}"
    fi
fi

echo
print_status "Schema V9: Night Audit (NEW)"

# Schema V9 components
echo -e "${BLUE}Note: This script assumes base schemas (v1-v7) are already deployed.${NC}"
echo -e "${YELLOW}⚠️  Deploying Night Audit tables and functions...${NC}"

# Deploy Night Audit components
# Create a minimal SQL for V9 to avoid file dependency
V9_SQL="
CREATE TABLE IF NOT EXISTS public.night_audit_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auto_post_room_charges BOOLEAN NOT NULL DEFAULT true,
  auto_post_time TIME NOT NULL DEFAULT '00:00:00',
  default_room_tran_code TEXT NOT NULL DEFAULT 'ROOM',
  enable_shift_closing BOOLEAN NOT NULL DEFAULT false,
  shift_closing_time TIME NOT NULL DEFAULT '23:59:00',
  notification_emails TEXT[] NOT NULL DEFAULT ARRAY[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.night_audit_config (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.night_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('room_posting', 'shift_closing', 'daily_reconciliation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  items_posted INT DEFAULT 0,
  items_failed INT DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_night_audit_logs_date
  ON public.night_audit_logs(audit_date);
"

if echo "$V9_SQL" | PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
        -U postgres -d "$DB_NAME"; then
    echo -e "${GREEN}✅ SUCCESS: Night Audit Tables${NC}"
else
    echo -e "${RED}❌ FAILED: Night Audit Tables${NC}"
    exit 1
fi

echo
print_status "Schema V10: Advanced Reports (NEW)"

# Deploy V10 Report Views
echo -e "${YELLOW}⚠️  Deploying Report Views...${NC}"

V10_SQL="
-- Daily Revenue Report View
CREATE OR REPLACE VIEW public.v_daily_revenue_report AS
WITH daily_revenue AS (
  SELECT
    DATE(fi.created_at) AS report_date,
    CASE
      WHEN tc.code = 'ROOM' THEN 'Room Revenue'
      WHEN tc.code IN ('BREAK', 'LUNCH', 'DINNER') THEN 'Food & Beverage'
      WHEN tc.code = 'MINIBAR' THEN 'Mini Bar'
      WHEN tc.code = 'LAUNDRY' THEN 'Laundry'
      WHEN tc.code = 'PHONE' THEN 'Telephone'
      WHEN tc.code = 'INET' THEN 'Internet'
      WHEN tc.code = 'SPA' THEN 'Spa & Wellness'
      WHEN tc.code = 'PARK' THEN 'Parking'
      WHEN tc.code = 'MISC' THEN 'Miscellaneous'
      ELSE 'Other Charges'
    END AS category,
    tc.code AS tran_code,
    tc.description AS tran_description,
    COUNT(fi.id) AS transaction_count,
    SUM(fi.amount) AS total_amount,
    SUM(fi.vat_amount) AS total_vat,
    SUM(fi.service_amount) AS total_service_charge
  FROM folio_items fi
  JOIN revenue_transaction_codes tc ON tc.code = fi.tran_code
  WHERE fi.is_voided = false
    AND fi.payf NOT IN ('W')
  GROUP BY DATE(fi.created_at), tc.code, tc.description
)
SELECT * FROM daily_revenue ORDER BY report_date DESC;

-- Payment Reconciliation Report View
CREATE OR REPLACE VIEW public.v_payment_reconciliation_report AS
SELECT
  DATE(fp.created_at) AS report_date,
  fp.payment_method,
  COUNT(fp.id) AS payment_count,
  SUM(fp.amount) AS total_amount
FROM folio_payments fp
GROUP BY DATE(fp.created_at), fp.payment_method
ORDER BY report_date DESC;
"

if echo "$V10_SQL" | PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
        -U postgres -d "$DB_NAME"; then
    echo -e "${GREEN}✅ SUCCESS: Report Views${NC}"
else
    echo -e "${RED}❌ FAILED: Report Views${NC}"
    exit 1
fi

echo
print_status "Deployment Verification"

# Final verification
echo -e "${BLUE}🔍 Running final verification...${NC}"

VERIFICATION_SQL="
SELECT
    'Tables' as type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('folios', 'folio_items', 'folio_payments',
                    'revenue_transaction_codes', 'billing_addresses',
                    'tax_invoices', 'night_audit_config', 'night_audit_logs')
UNION ALL
SELECT
    'Views' as type,
    COUNT(*) as count
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%';
"

RESULTS=$(PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h "$DB_HOST" \
        -U postgres -d "$DB_NAME" \
        -t -c "$VERIFICATION_SQL" 2>/dev/null || echo "")

echo "$RESULTS" | while IFS='|' read -r type count; do
    if [[ "$type" == *"Tables"* ]]; then
        if [ "${count// /}" -ge 9 ]; then
            echo -e "${GREEN}✅ Tables: ${count// /} created${NC}"
        else
            echo -e "${YELLOW}⚠️  Tables: ${count// /} created (expected 9+)${NC}"
        fi
    fi
    if [[ "$type" == *"Views"* ]]; then
        if [ "${count// /}" -ge 2 ]; then
            echo -e "${GREEN}✅ Views: ${count// /} created${NC}"
        else
            echo -e "${YELLOW}⚠️  Views: ${count// /} created (expected 2+)${NC}"
        fi
    fi
done

echo
print_status "Deployment Complete!"

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════╗"
echo "║                   ✅ DEPLOYMENT SUCCESSFUL              ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "1. Update environment variables in .env.local"
echo -e "2. Test cashier operations at /dashboard/cashier"
echo -e "3. Verify reports are accessible"
echo -e "4. Train staff on new system"
echo
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo -e "  - Keep backup of old system for 2-4 weeks"
echo -e "  - Run both systems in parallel during testing"
echo -e "  - Monitor logs for any issues"
echo
