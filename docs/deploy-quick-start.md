# 🚀 Quick Start: Deploy to Supabase Production

## วิธีที่ 1: ด้วย Supabase SQL Editor (แนะนำ)

### Step 1: เปิด Supabase Dashboard
```
https://supabase.com/dashboard/project/rbpiwglmpahwvabzcgzr
```

### Step 2: ไปที่ SQL Editor
คลิกเมนู **SQL Editor** ที่ด้านซ้าย

### Step 3: Run Deploy Script
1. เปิดไฟล์ `supabase/deploy-production.sql`
2. คัดลอก **ทั้งหมด** (Ctrl+A, Ctrl+C)
3. วางใน SQL Editor (Ctrl+V)
4. คลิก **Run** ▶️

### Step 4: ตรวจสอบผล
เมื่อ deploy เสร็จจะเห็น:
```
✅ Schema V8: Billing Folio Tables - Deployed
✅ Schema V9: Night Audit Tables - Deployed
✅ Schema V10: Report Views - Deployed
```

---

## วิธีที่ 2: ด้วย Bash Script (อัตโนมัติ)

### Prerequisites
ติดตั้ง `psql` หากยังไม่มี:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

### Run Script
```bash
cd "/media/doung/New Volume/Project for zed/KFO/hotel-pms"

# Method 1: Prompt for password
./supabase/deploy.sh

# Method 2: Set password environment variable
export SUPABASE_DB_PASSWORD="your_database_password"
./supabase/deploy.sh
```

---

## ตรวจสอบ Deployment

หลังจาก deploy ให้ run query นี้ใน SQL Editor:

```sql
-- Verifcation Query
SELECT
    'Tables' as type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('folios', 'folio_items', 'folio_payments',
                    'revenue_transaction_codes', 'billing_addresses',
                    'tax_invoices', 'folio_setup',
                    'night_audit_config', 'night_audit_logs', 'shifts')
UNION ALL
SELECT
    'Views' as type,
    COUNT(*) as count
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%';
```

**Expected Result:**
```
type   | count
--------|-------
Tables  |     11
Views   |      3+
```

---

## Test Core Operations

### Test 1: ตรวจ Transaction Codes
```sql
SELECT code, description, vat_type, default_vat_rate, default_serv_rate
FROM revenue_transaction_codes
ORDER BY sort_order;
```
**Expected:** 25 codes (ROOM, BREAK, CASH, VISA, etc.)

### Test 2: ตรวจ Night Audit Config
```sql
SELECT * FROM night_audit_config;
```
**Expected:** 1 row with default config

### Test 3: ตรวจ Report Views
```sql
SELECT * FROM v_daily_revenue_report LIMIT 10;
```
**Expected:** Daily revenue breakdown view

---

## Update Environment Variables

เพิ่มลง `.env.local` (และใน Vercel):

```env
NEXT_PUBLIC_SUPABASE_URL=https://rbpiwglmpahwvabzcgzr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**รับ Anon Key:**
1. Supabase Dashboard → Settings → API
2. Copy `anon public` key
3. วางใน `.env.local`

---

## Start Development Server

```bash
cd "/media/doung/New Volume/Project for zed/KFO/hotel-pms"
npm install
npm run dev
```

เปิด: http://localhost:3000

---

## Test Billing/Folio

1. Login ด้วย account admin
2. ไปที่: `/dashboard/cashier`
3. Test operations:
   - ✅ Post charge (ROOM, BREAK, etc.)
   - ✅ Receive payment (CASH, VISA, etc.)
   - ✅ Void transaction
   - ✅ Issue credit note
   - ✅ Transfer items between folios
   - ✅ Lock/unlock folio

---

## 📋 Deployment Checklist

- [ ] เข้า Supabase Dashboard
- [ ] ไปที่ SQL Editor
- [ ] Run `deploy-production.sql`
- [ ] Verify 11 tables created
- [ ] Verify 3+ views created
- [ ] Verify 25 transaction codes exist
- [ ] Update `.env.local` variables
- [ ] Run `npm install`
- [ ] Start `npm run dev`
- [ ] Login to admin account
- [ ] Test post charge
- [ ] Test receive payment
- [ ] Test void transaction
- [ ] Test credit note
- [ ] Test transfer items
- [ ] Test lock/unlock folio
- [ ] Verify reports work

---

## ❓ ถ้าเจอปัญหา

### Error: "relation already exists"
**Solution:** Schema ถูก deploy ไปแล้ว ให้ continue ต่อ

### Error: "permission denied"
**Solution:** ตรวจสอบว่า login เป็น admin หรือมี permission

### Error: "column already exists"
**Solution:** เพิ่ม `DROP COLUMN IF EXISTS` ก่อน `ALTER TABLE`

### ต้องการดู logs
```bash
# Supabase Dashboard → Logs
https://supabase.com/dashboard/project/rbpiwglmpahwvabzcgzr/logs
```

---

## 📞 ติดต่อ Support

หากมีปัญหา:
1. Check documentation: `/docs/supabase-deployment-guide.md`
2. Check migration plan: `/docs/billing-folio-migration-plan.md`
3. Review error messages in Supabase dashboard

---

**✨ Happy Deploying!**
