# Supabase Production Deployment Guide
## Hotel PMS - Billing Folio Migration

---

## Prerequisites

Before deploying, ensure you have:
- ✅ Supabase project access (project URL and anon key)
- ✅ Database access permissions
- ✅ Backup of current database (recommended)

---

## Deployment Order

Execute schemas in this exact order to avoid dependency errors:

### Order 1: Base Schema (if not deployed)
```
1. schema.sql                           - Core tables
2. rls_policies.sql                     - Row Level Security
3. schema_v2.sql                        - Reservations & Rooms
4. schema_v3.sql                        - Guests & Rates
5. schema_v4_accounting.sql             - Accounting tables
6. schema_v4_audit_update.sql            - Audit tables
7. schema_v5_reports.sql                 - Basic reports
8. schema_v6_rls.sql                    - RLS updates
9. schema_v7_groups.sql                  - Group tables
10. schema_v8_billing_folio.sql           - **CORE: Billing/Folio**
11. schema_v9_night_audit.sql             - **NEW: Night Audit**
12. schema_v10_reports.sql               - **NEW: Advanced Reports**
```

---

## Method 1: Supabase SQL Editor (Recommended)

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project: `rbpiwglmpahwvabzcgzr`
3. Navigate to: **SQL Editor**

### Step 2: Execute Schemas in Order

Copy and paste each schema file content into the SQL Editor and click **Run**:

#### Schema V8: Billing Folio (Core - DO FIRST if not deployed)
```bash
# Copy entire content from:
supabase/schema_v8_billing_folio.sql
```

**After running, verify:**
```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('folios', 'folio_items', 'folio_payments',
                    'revenue_transaction_codes', 'billing_addresses',
                    'tax_invoices', 'folio_setup');
```

**Expected Output:** 8 tables

---

#### Schema V9: Night Audit (NEW)
```bash
# Copy entire content from:
supabase/schema_v9_night_audit.sql
```

**After running, verify:**
```sql
-- Check night audit tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('night_audit_config', 'night_audit_logs',
                    'shifts');
```

**Expected Output:** 3 tables

**Verify RPC functions:**
```sql
-- Check RPC functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'rpc_night%';
```

**Expected Output:** 2 functions (rpc_night_audit_post_room_charges, rpc_close_shift)

---

#### Schema V10: Reports (NEW)
```bash
# Copy entire content from:
supabase/schema_v10_reports.sql
```

**After running, verify:**
```sql
-- Check report views exist
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%';
```

**Expected Output:** 10+ views starting with `v_`

---

### Step 3: Verify Deployment

Run this verification query:

```sql
-- ========================================
-- Deployment Verification Query
-- ========================================

-- 1. Check all required tables
SELECT
    'Tables' AS type,
    COUNT(*) AS count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'folios', 'folio_items', 'folio_payments',
    'revenue_transaction_codes', 'billing_addresses',
    'tax_invoices', 'folio_setup',
    'night_audit_config', 'night_audit_logs', 'shifts'
)

UNION ALL

-- 2. Check RPC functions
SELECT
    'RPC Functions' AS type,
    COUNT(*) AS count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'rpc_%'

UNION ALL

-- 3. Check report views
SELECT
    'Report Views' AS type,
    COUNT(*) AS count
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%'

UNION ALL

-- 4. Check revenue transaction codes
SELECT
    'Transaction Codes' AS type,
    COUNT(*) AS count
FROM revenue_transaction_codes;
```

**Expected Output:**
```
type                | count
--------------------|-------
Tables              |     11
RPC Functions       |     15+
Report Views        |     10+
Transaction Codes   |     25
```

---

## Method 2: Automated Deployment Script

If you have `psql` command-line access:

```bash
# Create deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash

SUPABASE_URL="https://rbpiwglmpahwvabzcgzr.supabase.co"
SUPABASE_DB_PASSWORD="YOUR_DATABASE_PASSWORD"

# Order of deployment
SCHEMAS=(
  "supabase/schema.sql"
  "supabase/rls_policies.sql"
  "supabase/schema_v2.sql"
  "supabase/schema_v3.sql"
  "supabase/schema_v4_accounting.sql"
  "supabase/schema_v4_audit_update.sql"
  "supabase/schema_v5_reports.sql"
  "supabase/schema_v6_rls.sql"
  "supabase/schema_v7_groups.sql"
  "supabase/schema_v8_billing_folio.sql"
  "supabase/schema_v9_night_audit.sql"
  "supabase/schema_v10_reports.sql"
)

# Deploy each schema
for schema in "${SCHEMAS[@]}"; do
  echo "Deploying: $schema"
  PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h db.rbpiwglmpahwvabzcgzr.supabase.co \
    -U postgres \
    -d postgres \
    -f "$schema"

  if [ $? -eq 0 ]; then
    echo "✅ $schema deployed successfully"
  else
    echo "❌ $schema deployment failed"
    exit 1
  fi
done

echo "✅ All schemas deployed successfully!"
EOF

# Make executable and run
chmod +x deploy.sh
./deploy.sh
```

---

## Method 3: Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# 1. Link your project
npx supabase link --project-ref rbpiwglmpahwvabzcgzr

# 2. Deploy migrations
npx supabase db push supabase/schema_v8_billing_folio.sql
npx supabase db push supabase/schema_v9_night_audit.sql
npx supabase db push supabase/schema_v10_reports.sql

# 3. Generate TypeScript types
npx supabase gen types typescript --local > src/lib/types/database.ts
```

---

## Post-Deployment Configuration

### 1. Update Environment Variables

Add to `.env.local` (and Vercel environment variables):

```env
NEXT_PUBLIC_SUPABASE_URL=https://rbpiwglmpahwvabzcgzr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 2. Seed Transaction Codes

The schemas include default transaction codes, but verify they exist:

```sql
SELECT * FROM revenue_transaction_codes ORDER BY sort_order;
```

**Expected codes:** ROOM, BREAK, LUNCH, DINNER, MINIBAR, LAUNDRY, PHONE, INET, PARK, SPA, MISC, DAMAGE, EXBED, LATEOUT, EARLYIN, REBATE, DISC, CASH, VISA, MCARD, AMEX, JCB, BKTRF, CHQUE, ONLINE, DEPST, AR (25 codes)

### 3. Configure Night Audit

```sql
-- Check night audit configuration
SELECT * FROM night_audit_config;

-- Update configuration if needed
UPDATE night_audit_config SET
  auto_post_room_charges = true,
  auto_post_time = '00:00:00',  -- Midnight
  enable_shift_closing = false,
  notification_emails = ARRAY['admin@yourhotel.com']::TEXT[]
WHERE id = '00000000-0000-0000-0000-000000000001';
```

### 4. Test Core Operations

Run these tests via the cashier page:

```sql
-- Test 1: Post room charge
SELECT rpc_post_folio_item(
  p_folio_id => 'test-folio-id',
  p_tran_code => 'ROOM',
  p_description => 'Test Room Charge',
  p_amount => 3500,
  p_item_date => CURRENT_DATE
);

-- Test 2: Receive payment
SELECT rpc_receive_folio_payment(
  p_folio_id => 'test-folio-id',
  p_payment_method => 'cash',
  p_amount => 2000
);

-- Test 3: Get daily reconciliation
SELECT * FROM rpc_daily_reconciliation_report(p_report_date => CURRENT_DATE);

-- Test 4: Night audit post room charges
SELECT * FROM rpc_night_audit_post_room_charges(
  p_audit_date => CURRENT_DATE,
  p_post_date => CURRENT_DATE
);
```

---

## Troubleshooting

### Issue: Table already exists
**Solution:** schemas use `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE`, so they should run safely. If you get errors, add `DROP TABLE IF EXISTS` before CREATE.

### Issue: RPC function already exists
**Solution:** Run with `CREATE OR REPLACE FUNCTION` - already handled in schemas.

### Issue: Permission denied
**Solution:** Ensure you have `postgres` role or have been granted necessary permissions.

### Issue: RLS policies blocking inserts
**Solution:** Temporarily disable RLS:
```sql
ALTER TABLE public.folios DISABLE ROW LEVEL SECURITY;
-- Run your inserts
ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;
```

---

## Verification Checklist

After deployment, verify:

### Database Schema
- [ ] `folios` table exists with folio_seq column
- [ ] `folio_items` table exists with VAT breakdown columns
- [ ] `folio_payments` table exists
- [ ] `revenue_transaction_codes` table exists with 25 codes
- [ ] `billing_addresses` table exists
- [ ] `tax_invoices` table exists
- [ ] `folio_setup` table exists
- [ ] `night_audit_config` table exists
- [ ] `night_audit_logs` table exists
- [ ] `shifts` table exists

### RPC Functions
- [ ] `rpc_post_folio_item` exists
- [ ] `rpc_receive_folio_payment` exists
- [ ] `rpc_void_folio_item` exists
- [ ] `rpc_issue_credit_note` exists
- [ ] `rpc_transfer_folio_items` exists
- [ ] `rpc_lock_folio` exists
- [ ] `rpc_night_audit_post_room_charges` exists
- [ ] `rpc_close_shift` exists
- [ ] `rpc_daily_reconciliation_report` exists

### Report Views
- [ ] `v_daily_revenue_report` exists
- [ ] `v_payment_reconciliation_report` exists
- [ ] `v_folio_aging_report` exists
- [ ] `v_tax_invoice_summary` exists
- [ ] `v_audit_trail_report` exists
- [ ] `v_shift_summary_report` exists
- [ ] `v_room_revenue_by_type` exists
- [ ] `v_monthly_revenue_summary` exists
- [ ] `v_department_revenue_report` exists
- [ ] `v_guest_account_statement` exists

### Triggers
- [ ] `trg_folio_items_recalc` trigger exists
- [ ] `trg_folio_payments_recalc` trigger exists

### RLS Policies
- [ ] RLS enabled on all sensitive tables
- [ ] Auth users can read data
- [ ] Admin/Manager roles can modify data

---

## Rollback Plan (If Issues Occur)

If you need to rollback:

### Option 1: Drop New Tables
```sql
-- Drop V9 tables
DROP TABLE IF EXISTS public.night_audit_logs CASCADE;
DROP TABLE IF EXISTS public.night_audit_config CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;

-- Drop V10 views
DROP VIEW IF EXISTS public.v_daily_revenue_report CASCADE;
DROP VIEW IF EXISTS public.v_payment_reconciliation_report CASCADE;
DROP VIEW IF EXISTS public.v_folio_aging_report CASCADE;
DROP VIEW IF EXISTS public.v_tax_invoice_summary CASCADE;
DROP VIEW IF EXISTS public.v_audit_trail_report CASCADE;
DROP VIEW IF EXISTS public.v_shift_summary_report CASCADE;
DROP VIEW IF EXISTS public.v_room_revenue_by_type CASCADE;
DROP VIEW IF EXISTS public.v_monthly_revenue_summary CASCADE;
DROP VIEW IF EXISTS public.v_department_revenue_report CASCADE;
DROP VIEW IF EXISTS public.v_guest_account_statement CASCADE;
```

### Option 2: Restore from Backup
Restore from your pre-deployment backup.

---

## Support

If you encounter issues:

1. Check Supabase dashboard logs: https://supabase.com/dashboard/project/rbpiwglmpahwvabzcgzr/logs
2. Review error messages in SQL Editor
3. Verify table/function names match exactly
4. Check for reserved keywords

---

**Deployment Status:**
- [ ] Schema V8 (Billing Folio) - Deployed
- [ ] Schema V9 (Night Audit) - Deployed
- [ ] Schema V10 (Reports) - Deployed
- [ ] Verification passed
- [ ] Ready for testing

---

**Prepared by:** Claude Code (Sonnet 4.6)
**Date:** 2026-03-03
**Project:** Hotel PMS Deployment - Supabase Production
