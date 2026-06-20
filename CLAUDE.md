# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
npm run dev        # Start Next.js dev server (localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint (Next.js core-web-vitals + typescript rules)
npm run test       # Run vitest once
npm run test:watch # Run vitest in watch mode
```

Tests live in `src/lib/__tests__/` and `src/lib/tests/`. Vitest uses `@` path alias and `globals: true`. Mock with `vi.mock('@/lib/repositories/...')`.

## Architecture

```
Client Component → Server Action → Service → Repository → Supabase/PostgreSQL
```

### Layer Conventions

**Server Actions** (`src/lib/actions/`) — `'use server'` functions, validate input with Zod, call services. Return `{ success, data?, error? }`. These are RSC-safe and called directly from client components.

**Services** (`src/lib/services/`) — static classes with pure business logic (no Supabase calls directly; delegate to Repositories).

**Repositories** (`src/lib/repositories/`) — raw Supabase queries and PostgreSQL RPC calls. Each method does one DB operation.

**App Router Pages** (`src/app/`) — two route groups:
- `(auth)/login` — unauthenticated login page
- `(dashboard)/dashboard/**` — all protected pages under a sidebar + header layout

### Key Architecture Patterns

**Generic CRUD** — `src/lib/actions/generic-crud.ts` serves ~20 simple name-only lookup tables (departments, markets, nationalities, etc.) via a table-name parameter with a whitelist. The `GenericCrudPage` component in `src/components/shared/generic-crud-page.tsx` renders a full CRUD UI from just a `title` + `tableName` prop. Most master data pages use this — they are single-line passthroughs like:
```
<GenericCrudPage title="Departments" description="Manage departments" tableName="departments" />
```

**Reservation creation** uses a PostgreSQL RPC function (`rpc_create_reservation`) for atomic inventory lock + insert.

**Rate engine** (`src/lib/services/rate-engine.ts`) calculates dynamic pricing from RatePlans with seasonal/weekday overrides.

### Auth & RBAC

Middleware (`src/middleware.ts`) handles:
1. Session refresh via `@supabase/ssr`
2. Redirect unauthenticated users from `/dashboard/*` → `/login`
3. Redirect authenticated users from `/login` → `/dashboard`
4. Block `staff` role from `/dashboard/master/*` routes

Role hierarchy: `super_admin` (4) > `admin` (3) > `manager` (2) > `staff` (1)

`canWrite(role)` = super_admin or admin. `canManage(role)` = adds manager. `hasMinRole(user, min)` compares levels.

### Database (Supabase)

Schema is versioned: `supabase/schema.sql` → `schema_v2.sql` → ... → `schema_v12_group_booking.sql`. RLS policies in `rls_policies.sql` and `schema_v6_rls.sql`. RPC functions in `supabase/functions/` and `phase2_rpc_functions.sql`. Views in `phase4_views.sql` and `supabase/views/`.

Multi-property is supported — the `properties` table with `code='MAIN'` as default. RLS enforces property-scoped access.

### Thai Tax System

The system models Thai VAT/service charge:
- `VatType`: `'V'` (Vatable), `'N'` (Non-VAT), `'E'` (Exempt)
- `FolioItem` tracks `vat_rate`, `vat_amount`, `service_rate`, `service_amount`, `vatable_amount`, `non_vat_amount`
- `TaxInvoice` stores ใบกำกับภาษี with company tax ID, address, subtotal/VAT/service charge breakdown
- `RevenueTransactionCode` per transaction code: `vat_type`, `vat_inclusive`, `default_vat_rate`, `default_serv_rate`

### Forecasting

Forecast system lives across `src/lib/services/forecast-service.ts`, `forecast-comparison-service.ts`, `src/lib/actions/forecast-actions.ts`, and `src/components/forecast/`. The core is an occupancy/revenue grid with KPI cards, adjustments, and comparison views.

### Key Shared Components

- `DataTable` (`src/components/shared/data-table.tsx`) — reusable paginated/sortable table with search
- `GenericCrudPage` — full CRUD UI for simple name-only tables
- `ConfirmDialog` — confirmation modal wrapper
- `RoleGuard` — component-level role check
- All UI primitives in `src/components/ui/` are shadcn/ui (new-york style, CSS variables, neutral base)

### Route Constants

Always use `ROUTES` from `@/lib/constants/routes` instead of hardcoded paths. There are also `FUNCTION_CODES` for hotel operation codes (KO39–KO52, KC27).

### Currency & Date

Thailand locale. Currency formatted as `฿1,234`. Dates displayed in Thai locale (`formatDisplayDate` / `formatDisplayDateEN`). `date-fns` is available for richer date manipulation.
