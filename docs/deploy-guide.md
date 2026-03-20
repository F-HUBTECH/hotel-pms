# Hotel PMS - Database Deployment Guide
# Forecast System Deployment

---

## Option 1: Supabase SQL Editor (Recommended)

### Step 1: Deploy Schema V11
1. Open Supabase Dashboard: https://app.supabase.com/project/rbpiwglmpahwvabzcgzr/sql/new
2. Open file: `supabase/schema_v11_forecast.sql`
3. Copy all content
4. Paste into SQL Editor
5. Click "Run" or press Ctrl+Enter
6. Wait for confirmation
7. Verify tables created:
   - forecast_configurations
   - room_status_dates
   - corporate_allotments
   - forecast_room_daily
   - forecast_summary_daily

### Step 2: Deploy RPC Functions (Phase 2)
1. Click "New Query" in SQL Editor
2. Open file: `supabase/phase2_rpc_functions.sql`
3. Copy all content
4. Paste and run
5. Verify functions created:
   - rpc_generate_daily_forecast
   - rpc_calculate_daily_summary
   - rpc_adjust_forecast_item
   - rpc_update_room_status_date
   - rpc_get_forecast_room_grid
   - rpc_get_forecast_summary

### Step 3: Deploy Views (Phase 4)
1. Click "New Query" in SQL Editor
2. Open file: `supabase/phase4_views.sql`
3. Copy all content
4. Paste and run
5. Verify views created:
   - v_forecast_room_grid
   - v_forecast_summary_comparison
   - v_forecast_by_room_type
   - v_forecast_by_building
   - v_forecast_daily_summary_extended
   - v_forecast_adjustment_history

---

## Option 2: Using psql Command Line

If you have database password, run:

```bash
cd /media/doung/New\ Volume/Project\ for\ zed/KFO/hotel-pms

export SUPABASE_DB_PASSWORD="your_password_here"

# Deploy Schema V11
psql -h db.rbpiwglmpahwvabzcgzr.supabase.co \
  -U postgres \
  -d postgres \
  -f supabase/schema_v11_forecast.sql

# Deploy RPC Functions
psql -h db.rbpiwglmpahwvabzcgzr.supabase.co \
  -U postgres \
  -d postgres \
  -f supabase/phase2_rpc_functions.sql

# Deploy Views
psql -h db.rbpiwglmpahwvabzcgzr.supabase.co \
  -U postgres \
  -d postgres \
  -f supabase/phase4_views.sql
```

---

## Verification SQL

Run this after deployment to verify:

```sql
-- Check Tables
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'forecast_configurations',
    'room_status_dates',
    'corporate_allotments',
    'forecast_room_daily',
    'forecast_summary_daily'
  )
ORDER BY table_name, ordinal_position;

-- Check Functions
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'rpc_%'
ORDER BY routine_name;

-- Check Views
SELECT 
    table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_forecast%'
ORDER BY table_name;
```

---

## Troubleshooting

### Error: "relation already exists"
- Tables/views already exist. This is normal for updates.
- The SQL uses `IF NOT EXISTS` or `CREATE OR REPLACE` to handle this.

### Error: "function already exists"
- RPC functions already exist.
- The SQL uses `CREATE OR REPLACE FUNCTION` to update them.

### Error: "permission denied"
- Make sure you're using the correct database user with admin privileges.
- Use the service role key or database owner credentials.

---

## Post-Deployment Steps

1. **Test the pages:**
   - /dashboard/reports/forecast/grid
   - /dashboard/reports/forecast/summary
   - /dashboard/reports/forecast/adjustments

2. **Generate sample forecast:**
   ```sql
   SELECT rpc_generate_daily_forecast(
     '2026-03-04'::DATE,
     '2026-03-13'::DATE,
     NULL,
     NULL,
     NULL
   );
   ```

3. **Check the data:**
   ```sql
   SELECT * FROM forecast_room_daily 
   WHERE forecast_date >= '2026-03-04' 
   ORDER BY forecast_date, room_number;
   ```

---

## Rollback (If Needed)

```sql
DROP VIEW IF EXISTS v_forecast_adjustment_history CASCADE;
DROP VIEW IF EXISTS v_forecast_daily_summary_extended CASCADE;
DROP VIEW IF EXISTS v_forecast_by_building CASCADE;
DROP VIEW IF EXISTS v_forecast_by_room_type CASCADE;
DROP VIEW IF EXISTS v_forecast_summary_comparison CASCADE;
DROP VIEW IF EXISTS v_forecast_room_grid CASCADE;

DROP FUNCTION IF EXISTS rpc_get_forecast_summary CASCADE;
DROP FUNCTION IF EXISTS rpc_get_forecast_room_grid CASCADE;
DROP FUNCTION IF EXISTS rpc_update_room_status_date CASCADE;
DROP FUNCTION IF EXISTS rpc_adjust_forecast_item CASCADE;
DROP FUNCTION IF EXISTS rpc_calculate_daily_summary CASCADE;
DROP FUNCTION IF EXISTS rpc_generate_daily_forecast CASCADE;

DROP TABLE IF EXISTS forecast_summary_daily CASCADE;
DROP TABLE IF EXISTS forecast_room_daily CASCADE;
DROP TABLE IF EXISTS corporate_allotments CASCADE;
DROP TABLE IF EXISTS room_status_dates CASCADE;
DROP TABLE IF EXISTS forecast_configurations CASCADE;
```
