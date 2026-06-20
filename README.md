# Hotel PMS — Property Management System

ระบบบริหารจัดการโรงแรม (Property Management System) ที่พัฒนาด้วย Next.js 16 + Supabase + TypeScript

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **Database** | PostgreSQL (Supabase) |
| **Auth** | Supabase Auth + RBAC |
| **UI** | React 19 + Tailwind CSS 4 + shadcn/ui + Radix UI |
| **Validation** | Zod 4 |
| **Charts** | Recharts |
| **Icons** | Lucide React |

## Features

- **Front Desk**: การจองห้องพัก, Check-in/Check-out, Room Chart, Group Bookings, Calendar
- **Cashier**: ระบบ Billing & Folio, Fast Posting, Folio Inquiry, Payment Processing
- **Accounting**: General Ledger, Tax Invoices (ใบกำกับภาษี), VAT/Service Charge calculation, Night Audit
- **Revenue**: Revenue management, Rate Plans, Seasonal Rates, Weekday Rates
- **Forecast**: Occupancy & revenue forecasting with adjustments
- **Operations**: Housekeeping task management, Channel sync
- **Reports**: Occupancy reports, Revenue reports, Guest ledger, Trial balance, Aging reports
- **Master Data**: Buildings, Rooms, Rate configurations, Booking sources, Markets, etc.
- **Admin**: User management, Role-Based Access Control (super_admin/admin/manager/staff)

## Getting Started

### Prerequisites
- Node.js 20+
- Supabase account & project

### Setup

1. **Clone & Install**
```bash
git clone <repo-url>
cd hotel-pms
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env.local
```
Edit `.env.local` with your Supabase project credentials:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Dashboard > Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your project's anon key
- `SUPABASE_SERVICE_ROLE_KEY` — your project's service_role key (keep secret!)

3. **Deploy Database Schema**
```bash
# Run SQL files in order:
# supabase/schema.sql (base schema)
# supabase/schema_v2.sql through schema_v12_*.sql (incremental)
# supabase/rls_policies.sql (Row Level Security)
# supabase/schema_v6_rls.sql (multi-property RLS)

# Seed data:
# supabase/seed.sql, supabase/seed_rooms.sql
```

4. **Run Development Server**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & layouts
│   ├── (auth)/             # Login/auth routes
│   └── (dashboard)/        # Protected dashboard routes
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── shared/             # Reusable app components
│   └── forecast/           # Forecast-specific components
├── lib/
│   ├── actions/            # Server Actions (API layer)
│   ├── services/           # Business logic
│   ├── repositories/       # Database access layer
│   ├── types/              # TypeScript type definitions
│   ├── constants/          # Constants & configuration
│   ├── validators/         # Zod validation schemas
│   ├── auth/               # RBAC roles & permissions
│   ├── supabase/           # Supabase client configs
│   └── utils/              # Shared utilities
supabase/                   # SQL schema, migrations, seeds
docs/                       # Documentation & migration plans
```

## Architecture

```
Client Component → Server Action → Service → Repository → Supabase/DB
```

- **Server Actions** (`lib/actions/`): Thin API layer — validates input (Zod), delegates to services
- **Services** (`lib/services/`): Business logic, orchestration
- **Repositories** (`lib/repositories/`): Database queries, RPC calls

## Deployment

```bash
npm run build
npm start
```

Deploy to Vercel, Netlify, or any Node.js hosting platform.

---

**License**: Private
