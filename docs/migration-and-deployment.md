# Migration Strategy — Legacy Delphi to Next.js PMS

## Overview

This document outlines the strategy for migrating data and functionality from the legacy **KFO Delphi Front Office** system to the new **Next.js + Supabase PMS**.

## Phase 1: Schema Mapping

### Legacy (Delphi/MySQL) → New (Supabase/PostgreSQL)

The legacy system uses auto-increment integer IDs and MySQL. The new system uses UUIDs and PostgreSQL.

| Legacy Entity | New Table | Key Differences |
|--------------|-----------|-----------------|
| Room types config | `room_types` | Added UUID PK, `base_price` numeric |
| Building config | `buildings` | Added `description`, timestamps |
| Floor plan config | `floor_plans` | FK to buildings (UUID) |
| Room config | `rooms` | UUID PK, FK relations, enum status |
| Rate group config | `rate_groups` | Added unique `code` |
| Rate formula config | `rate_formulas` | Enum `calculation_type` |
| Market/market group | `markets`, `market_groups` | Separated into parent/child |
| Guest type config | `guest_types` | Simplified to name + UUID |
| Country/nationality | `nationalities` | Added `country_code` |
| All other configs | Corresponding tables | Standardized UUID + timestamps |

## Phase 2: Data Migration Steps

### 1. Export legacy data
```sql
-- From legacy MySQL, export each config table:
SELECT * FROM legacy_room_types INTO OUTFILE '/tmp/room_types.csv';
```

### 2. Transform data
- Generate UUIDs for each record
- Map integer IDs to UUIDs in a lookup table
- Convert date formats to ISO 8601
- Clean and validate text fields
- Map foreign key relationships

### 3. Import to Supabase
```sql
-- Disable RLS temporarily for bulk import
ALTER TABLE public.room_types DISABLE ROW LEVEL SECURITY;

-- Import data (order matters — parents before children)
-- 1. buildings
-- 2. floor_plans (depends on buildings)
-- 3. room_types
-- 4. rooms (depends on buildings, floor_plans, room_types)
-- 5. All standalone tables

-- Re-enable RLS
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
```

### 4. Import order (dependency-aware)
1. `buildings`
2. `floor_plans` (FK → buildings)
3. `room_types`
4. `rooms` (FK → buildings, floor_plans, room_types)
5. `rate_groups`
6. `rate_formulas` (FK → rate_groups)
7. `market_groups`
8. `markets` (FK → market_groups)
9. All standalone tables (any order)

## Phase 3: User Migration

1. Create users in Supabase Auth (email/password)
2. The `handle_new_user()` trigger auto-creates profile records
3. Manually update `role` for each user in `profiles` table

## Phase 4: Validation

- Compare record counts: legacy vs new
- Spot-check critical records (rooms, rates)
- Verify FK integrity
- Test login with migrated users
- Verify RLS policies

## Rollback Plan

- Keep legacy system running in parallel during migration
- Maintain a mapping table (legacy_id → uuid) for cross-reference
- Run both systems in parallel for 2-4 weeks before decommissioning

---

# Deployment Guide — Vercel + Supabase

## Prerequisites

- [Supabase](https://supabase.com) account with project (`rbpiwglmpahwvabzcgzr`)
- [Vercel](https://vercel.com) account
- Git repository (GitHub/GitLab)

## Step 1: Supabase Setup

1. Go to Supabase Dashboard → SQL Editor
2. Run `supabase/schema.sql`
3. Run `supabase/rls_policies.sql`
4. Run `supabase/seed.sql` (optional, for dev data)
5. Go to Authentication → Settings
   - Enable Email provider
   - Disable "Confirm email" for testing
6. Go to Authentication → Users → Create user
   - Email: `admin@hotel.com`, Password: your choice
7. Go to SQL Editor and update the user's role:
   ```sql
   UPDATE public.profiles SET role = 'super_admin', full_name = 'Hotel Admin'
   WHERE email = 'admin@hotel.com';
   ```
8. Copy your Project URL and Anon Key from Settings → API

## Step 2: Environment Variables

Create `.env.local` (local) or set in Vercel dashboard:
```
NEXT_PUBLIC_SUPABASE_URL=https://rbpiwglmpahwvabzcgzr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## Step 3: Local Development

```bash
cd hotel-pms
npm install
npm run dev
# Open http://localhost:3000
```

## Step 4: Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Step 5: Post-Deployment

- Verify login works with your admin user
- Test CRUD operations on Room Types
- Check dashboard KPIs load correctly
- Verify sidebar navigation works for all modules
