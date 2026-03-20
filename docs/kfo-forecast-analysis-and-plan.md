# KFO Forecast Analysis & Implementation Plan
## Menu Forecast - Delphi Legacy → Next.js Migration

---

## Executive Summary

The hotel-pms system has a **basic forecast implementation**, but it significantly **lags behind KFO's comprehensive forecasting capabilities**.

**Current Status:**
- Basic 30-day forecast with KPI summary
- Simple occupancy and revenue charts
- Single property-level forecast

**KFO Features Missing:**
- Detailed room-by-room forecasts
- FIT vs GRP segment breakdown
- Room type-specific forecasting
- Building-specific filtering
- Manual adjustment interface
- Forecast vs actual comparison
- Seasonality configuration
- Booking status management (B/I/C/O/X)
- Room status tracking (OO/OI/HU)

**Gap Score: ~60%** - Significant functionality missing

---

## Current Hotel-PMS Forecast Implementation

### ✅ What Exists

**Files:**
- `src/lib/services/forecast-service.ts` - Basic forecast service
- `src/lib/actions/forecast.ts` - Server actions
- `src/app/(dashboard)/dashboard/reports/forecast/page.tsx` - Forecast UI page

**Features Implemented:**
1. **30-Day Forecast** - Property-level projection
2. **KPI Cards** - Total revenue, avg occupancy, ADR, RevPAR
3. **Line Charts** - Occupancy trend, revenue trend
4. **Daily Table** - Breakdown by date

**KPIs Calculated:**
- Expected Occupancy (%)
- Expected Revenue (฿)
- ADR (Average Daily Rate)
- RevPAR (Revenue Per Available Room)

**Data Sources:**
- Historical averages (from `forecast_summary_view`)
- On-the-books reservations

---

## KFO Forecast Feature Analysis

### 1. KFO Forecast Formats

#### Format 0: Summary View (28 columns)
| Column | Description |
|--------|-------------|
| Date | Forecast date |
| Total Rooms | Total available rooms |
| Stayover | Guests continuing stay |
| Arrivals | New check-ins |
| Departures | Check-outs |
| Occupancy | Current occupied rooms |
| Occupancy % | Occupancy percentage |
| Available | Rooms available for sale |
| Complimentary | Free rooms |
| House Use | Internal usage |
| Out of Order | Unavailable rooms |
| Room Sold | OCR % (Occupancy vs Sold) |
| Occupancy % | Color-coded display |
| Revenue | Projected revenue |

#### Format 1: Detailed View (54 columns)
**FIT vs GRP Breakdown:**
- FIT (Free Independent Traveler) columns
- GRP (Group) columns
- Separate counts and percentages

**Room Breakdown:**
- Room type columns (Standard, Deluxe, Suite, etc.)
- Pax (guest count) figures

**Revenue Breakdown:**
- Room revenue
- Extra charges (F&B, Minibar, etc.)

---

### 2. KFO Core Data Sources

#### `customer` Table (Bookings)
- `recid` - Auto-increment reservation ID
- `roomno` - Assigned room number
- `roomtype` - Room type reference
- `roomdate` - Date column (daily tracking)
- `checkindate` - Check-in date
- `checkoutdate` - Check-out date
- `gstrecid` - Guest ID
- `customerno` - Customer/account number
- `bookno` - Booking reference
- `status` - **B** (Booked), **I** (In-house), **C** (Cancelled), **O** (Checked-out), **X** (No-show)

#### `config_room` Table (Room Master)
- `roomno` - Room number (unique)
- `roomtype` - Room type
- `building` - Building assignment
- `roomstatus` - Room status
- `floor` - Floor number

#### `roomstatusdetail` Table (Status Management)
- `roomno` - Room reference
- `status` - **OO** (Out of Order), **OI** (Out of Inventory), **HU** (House Use)
- `fromdate` - Status start date
- `todate` - Status end date

#### `allot_rmtype` Table (Allotments)
- `allotcode` - Allotment contract code
- `roomtype` - Room type allocation
- `ratecode` - Special rate code
- `contractname` - Corporate contract name

---

### 3. KFO Forecast Algorithms

#### Occupancy Forecast Formula
```
Occupancy = Stayover + Arrivals - Departures
Available = Total Rooms - Occupancy - OO - OI - HU
Occupancy % = (Occupancy / Available) × 100
```

#### Revenue Forecast Formula
```
Total Revenue = Room Revenue + Extra Charges
Room Revenue = Σ(Rate × Nights) for each room
Extra Revenue = F&B + Minibar + Laundry + Phone + Spa + etc.
```

#### Forecast Calculation Engine
```
For each forecast date:
  1. Get existing reservations for that date
  2. Calculate stayovers (from previous day, not departing)
  3. Calculate arrivals (reservations with checkin_date = forecast_date)
  4. Calculate departures (reservations with checkout_date = forecast_date)
  5. Apply room status rules:
     - OO rooms: Remove from available
     - OI rooms: Remove from available
     - HU rooms: Remove from available
  6. Calculate occupancy
  7. Project revenue based on:
     - Confirmed bookings (rates from reservation)
     - Historical averages for unfilled rooms
     - Seasonality factors (weekend vs weekday)
     - Holiday multipliers
```

---

### 4. KFO Special Features

#### Booking Status Logic
- **B (Booked)**: Confirmed future booking, counts as occupied
- **I (In-house)**: Currently staying, counts as occupied
- **C (Cancelled)**: Does NOT count in forecast
- **O (Checked-out)**: Past date, historical data only
- **X (No-show)**: Does NOT count in forecast

#### Room Status Impact
- **OO (Out of Order)**: Room unavailable, reduces total available
- **OI (Out of Inventory)**: Room not available for sale, reduces available
- **HU (House Use)**: Room used internally, included in occupancy but not for sale

#### Corporate Allotments
- Special rate codes for corporate contracts
- Guaranteed room allocations
- Can override standard rates
- Separate tracking from FIT bookings

#### Seasonality Adjustments
- **Weekend Detection**: Saturday/Sunday rates
- **Holiday Calendar**: Special rate multipliers
- **Event-Based Adjustments**: Local events impact
- **Historical Patterns**: Same day of week from previous years

---

### 5. KFO UI Components

#### Main Features
1. **Date Range Selector**: Start date, end date, number of days
2. **Building Filter**: Select specific buildings or show all
3. **Room Type Filter**: Filter by room categories
4. **Forecast Format Toggle**: Switch between summary (28 cols) and detailed (54 cols)
5. **Grid Display**: Room-by-room, day-by-day matrix
6. **Color-Coded Cells**:
   - Green: Available
   - Blue: Occupied (FIT)
   - Purple: Occupied (GRP)
   - Gray: Out of Order/Inventory
   - Orange: House Use
7. **Totals Row**: Bottom summary calculations
8. **Export to Excel**: Direct FastReport export

#### Display Options
- **Show/Hide Revenue**: Toggle revenue columns
- **Show/Hide Pax**: Toggle guest count columns
- **Group by Room Type**: Collapse/expand room types
- **Print Preview**: FastReport print format

---

## Gap Analysis Summary

| Feature | KFO | Hotel-PMS | Gap |
|---------|------|-----------|-----|
| **Forecast Format** | 2 formats | 1 format | ❌ Missing detailed format |
| **Room-by-Room Grid** | ✅ | ❌ | ❌ Missing entirely |
| **FIT vs GRP Breakdown** | ✅ | ❌ | ❌ Missing entirely |
| **Room Type Breakdown** | ✅ | ❌ | ❌ Missing entirely |
| **Building Filter** | ✅ | ❌ | ❌ Missing entirely |
| **Manual Adjustments** | ✅ | ❌ | ❌ Missing entirely |
| **Booking Status Management** | ✅ | ❌ | ❌ Missing entirely |
| **Room Status Tracking** | ✅ | ❌ | ❌ Missing entirely |
| **Seasonality Config** | ✅ | ❌ | ❌ Missing entirely |
| **Forecast vs Actual** | ✅ | ❌ | ❌ Missing entirely |
| **Corporate Allotments** | ✅ | ❌ | ❌ Missing entirely |
| **Export Options** | ✅ | ❌ | ⚠️ Limited |

**Overall Gap: ~60%** - Major features missing

---

## Implementation Plan

### Phase 1: Database Schema (Schema V11)

#### Required Tables

**1. `forecast_configurations`**
```sql
CREATE TABLE forecast_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,

  -- Forecast settings
  forecast_days INT DEFAULT 30,
  include_weekend_premium BOOLEAN DEFAULT true,
  include_holiday_premium BOOLEAN DEFAULT true,
  weekend_premium_rate NUMERIC(5,2) DEFAULT 20.00,
  holiday_premium_rate NUMERIC(5,2) DEFAULT 30.00,

  -- Room status handling
  include_oo_rooms BOOLEAN DEFAULT false,      -- Out of Order
  include_oi_rooms BOOLEAN DEFAULT false,      -- Out of Inventory
  include_hu_rooms BOOLEAN DEFAULT true,       -- House Use

  -- Display options
  show_revenue BOOLEAN DEFAULT true,
  show_pax BOOLEAN DEFAULT true,
  fit_grp_breakdown BOOLEAN DEFAULT true,

  -- Created/Updated
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. `room_status_dates`**
```sql
CREATE TABLE room_status_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  status_type TEXT NOT NULL CHECK (status_type IN ('OO', 'OI', 'HU')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(room_id, status_type, from_date, to_date)
);
```

**3. `corporate_allotments`**
```sql
CREATE TABLE corporate_allotments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  allot_code TEXT NOT NULL UNIQUE,
  allot_name TEXT NOT NULL,
  room_type_id UUID REFERENCES room_types(id),
  rate_code TEXT REFERENCES revenue_transaction_codes(code),
  guaranteed_rooms INT DEFAULT 0,
  contract_start_date DATE NOT NULL,
  contract_end_date DATE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**4. `forecast_room_daily`**
```sql
CREATE TABLE forecast_room_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_date DATE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id),
  room_type_id UUID REFERENCES room_types(id),

  -- Booking information
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  booking_status TEXT CHECK (booking_status IN ('B', 'I', 'C', 'O', 'X')),

  -- Guest/Segment information
  guest_type TEXT CHECK (guest_type IN ('FIT', 'GRP', 'HOUSE')),
  pax_adults INT DEFAULT 0,
  pax_children INT DEFAULT 0,

  -- Rate information
  rate_code TEXT REFERENCES revenue_transaction_codes(code),
  rate_amount NUMERIC(10,2),
  allot_code TEXT REFERENCES corporate_allotments(allot_code),

  -- Calculated fields
  expected_revenue NUMERIC(12,2),
  expected_room_revenue NUMERIC(10,2),
  expected_extra_revenue NUMERIC(10,2),

  -- Room status
  room_status TEXT CHECK (room_status IN ('available', 'occupied', 'oo', 'oi', 'hu')),

  -- Forecast type
  forecast_type TEXT CHECK (forecast_type IN ('confirmed', 'projected')),

  -- Manual adjustments
  is_override BOOLEAN DEFAULT false,
  original_rate NUMERIC(10,2),
  original_revenue NUMERIC(12,2),
  override_reason TEXT,
  override_by UUID REFERENCES profiles(id),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(forecast_date, room_id)
);
```

**5. `forecast_summary_daily`**
```sql
CREATE TABLE forecast_summary_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_date DATE NOT NULL,
  property_id UUID REFERENCES properties(id),

  -- Room counts
  total_rooms INT NOT NULL,
  available_rooms INT NOT NULL,
  occupied_rooms INT NOT NULL,
  stayover_rooms INT NOT NULL,
  arrival_rooms INT NOT NULL,
  departure_rooms INT NOT NULL,

  -- Room status breakdown
  oo_rooms INT DEFAULT 0,      -- Out of Order
  oi_rooms INT DEFAULT 0,      -- Out of Inventory
  hu_rooms INT DEFAULT 0,      -- House Use
  complimentary_rooms INT DEFAULT 0,

  -- Occupancy metrics
  occupancy_percentage NUMERIC(5,2),
  rooms_sold INT DEFAULT 0,

  -- Revenue breakdown
  total_revenue NUMERIC(12,2),
  room_revenue NUMERIC(12,2),
  extra_revenue NUMERIC(12,2),
  fit_revenue NUMERIC(12,2),
  grp_revenue NUMERIC(12,2),

  -- KPIs
  adr NUMERIC(10,2),
  revpar NUMERIC(10,2),

  -- Comparison with actuals
  actual_rooms_sold INT,
  actual_revenue NUMERIC(12,2),
  actual_adr NUMERIC(10,2),
  actual_revpar NUMERIC(10,2),
  variance_revenue NUMERIC(12,2),
  variance_percentage NUMERIC(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(forecast_date, property_id)
);
```

---

### Phase 2: Server Actions & Services

#### New Server Actions

**1. `generateForecast`**
- Generates forecast for specified date range
- Applies seasonality adjustments
- Includes room status constraints
- Creates room-by-room projections

**2. `adjustForecastItem`**
- Manual adjustment of forecast items
- Records original values and override reason
- Updates derived calculations

**3. `updateRoomStatusDate`**
- Add/remove room status (OO/OI/HU)
- Validate date ranges don't overlap
- Apply to affected forecasts

**4. `getForecastRoomGrid`**
- Room-by-room, day-by-day grid data
- Filters by building, room type
- Multiple format support (summary/detailed)

**5. `getForecastSummary`**
- Aggregated daily summary
- FIT vs GRP breakdown
- Comparison with actuals

**6. `importFromKFO`**
- Import legacy forecast data
- Map legacy IDs to new UUIDs
- Transform data format

---

### Phase 3: Frontend Implementation

#### New Pages

**1. `/dashboard/reports/forecast/grid`**
- Room-by-room forecast grid
- Day-by-day columns
- Color-coded cells
- Bulk adjustment interface

**2. `/dashboard/reports/forecast/summary`**
- Daily summary KPI cards
- FIT vs GRP breakdown charts
- Comparison reports

**3. `/dashboard/reports/forecast/adjustments`**
- Manual adjustment history
- Audit trail view
- Approval workflow

#### New Components

**1. `ForecastGrid`**
- Reusable grid component
- Virtual scrolling for large datasets
- Cell formatting and styling

**2. `ForecastFilters`**
- Date range picker
- Building selector
- Room type multi-select
- Format toggle

**3. `ForecastCellEditor`**
- Inline editing for adjustments
- Cell validation
- Reason capture

---

### Phase 4: RPC Functions (Database)

**1. `rpc_generate_daily_forecast`**
```sql
CREATE OR REPLACE FUNCTION rpc_generate_daily_forecast(
  p_start_date DATE,
  p_end_date DATE,
  p_config_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF forecast_room_daily AS $$
-- Logic:
-- 1. Get configuration (seasonality, room status)
-- 2. For each date:
--    a. Get existing reservations
--    b. Calculate stayovers
--    c. Calculate arrivals/departures
--    d. Apply room status constraints
--    e. For unfilled rooms:
--       i. Use historical average
--       ii. Apply weekend premium
--       iii. Apply holiday premium
--    f. Calculate revenue (room + extra)
--    g. Determine guest type (FIT/GRP)
-- 2. Update or create forecast records
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**2. `rpc_calculate_daily_summary`**
```sql
CREATE OR REPLACE FUNCTION rpc_calculate_daily_summary(
  p_forecast_date DATE,
  p_property_id UUID
)
RETURNS forecast_summary_daily AS $$
-- Logic:
-- 1. Aggregate room_daily data
-- 2. Calculate KPIs (ADR, RevPAR, occupancy)
-- 3. Calculate FIT vs GRP breakdown
-- 4. Update forecast_summary_daily
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**3. `rpc_adjust_forecast_item`**
```sql
CREATE OR REPLACE FUNCTION rpc_adjust_forecast_item(
  p_item_id UUID,
  p_new_rate NUMERIC,
  p_override_reason TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS forecast_room_daily AS $$
-- Logic:
-- 1. Record original values
-- 2. Apply new rate
-- 3. Recalculate derived fields
-- 4. Set override flags
-- 5. Update summary if needed
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Phase 5: Views and Reports

**1. `v_forecast_room_grid`**
```sql
CREATE OR REPLACE VIEW v_forecast_room_grid AS
SELECT
  f.forecast_date,
  r.room_number,
  r.room_number || ' (' || rt.name || ')' AS room_label,
  b.name AS building_name,
  rt.name AS room_type_name,

  -- Status
  f.room_status,
  f.booking_status,
  f.guest_type,
  f.pax_adults,
  f.pax_children,

  -- Rates
  f.rate_code,
  f.rate_amount,
  a.allot_code,

  -- Revenue
  f.expected_room_revenue,
  f.expected_extra_revenue,
  f.expected_revenue,

  -- Display
  f.is_override,
  f.override_reason,

  -- Room info
  r.status AS actual_room_status,
  rs.status AS room_status_type,
  rs.from_date,
  rs.to_date

FROM forecast_room_daily f
JOIN rooms r ON r.id = f.room_id
LEFT JOIN room_status_dates rs ON rs.room_id = r.id
  AND rs.status_type = f.room_status
  AND rs.from_date <= f.forecast_date
  AND rs.to_date >= f.forecast_date
LEFT JOIN buildings b ON b.id = r.building_id
LEFT JOIN room_types rt ON rt.id = r.room_type_id
LEFT JOIN corporate_allotments a ON a.allot_code = f.allot_code
ORDER BY f.forecast_date, r.room_number;
```

**2. `v_forecast_summary_comparison`**
```sql
CREATE OR REPLACE VIEW v_forecast_summary_comparison AS
SELECT
  fs.forecast_date,
  fs.total_rooms,
  fs.occupied_rooms,
  fs.occupancy_percentage,

  -- Forecast revenue
  fs.total_revenue AS forecast_revenue,
  fs.room_revenue AS forecast_room_revenue,
  fs.extra_revenue AS forecast_extra_revenue,
  fs.fit_revenue AS forecast_fit_revenue,
  fs.grp_revenue AS forecast_grp_revenue,

  -- Actual revenue
  COALESCE(fs.actual_revenue, 0) AS actual_revenue,
  COALESCE(fs.actual_room_revenue, 0) AS actual_room_revenue,

  -- Variance
  (COALESCE(fs.actual_revenue, 0) - fs.total_revenue) AS revenue_variance,
  CASE WHEN fs.total_revenue > 0
       THEN ((COALESCE(fs.actual_revenue, 0) - fs.total_revenue) / fs.total_revenue * 100)
       ELSE 0
  END AS variance_percentage,

  -- KPIs comparison
  fs.adr AS forecast_adr,
  COALESCE(fs.actual_adr, 0) AS actual_adr,
  fs.revpar AS forecast_revpar,
  COALESCE(fs.actual_revpar, 0) AS actual_revpar,

  -- Accuracy tracking
  CASE WHEN fs.total_revenue > 0
       THEN ABS((COALESCE(fs.actual_revenue, 0) - fs.total_revenue) / fs.total_revenue) * 100
       ELSE 0
  END AS accuracy_percentage,

  fs.created_at
FROM forecast_summary_daily fs;
```

---

## Implementation Steps

### Step 1: Create Database Schema V11
- [ ] Create `forecast_configurations` table
- [ ] Create `room_status_dates` table
- [ ] Create `corporate_allotments` table
- [ ] Create `forecast_room_daily` table
- [ ] Create `forecast_summary_daily` table
- [ ] Create indexes
- [ ] Create RLS policies

### Step 2: Create RPC Functions
- [ ] `rpc_generate_daily_forecast`
- [ ] `rpc_calculate_daily_summary`
- [ ] `rpc_adjust_forecast_item`
- [ ] `rpc_update_room_status_date`
- [ ] `rpc_get_forecast_room_grid`
- [ ] `rpc_get_forecast_summary`

### Step 3: Create Views
- [ ] `v_forecast_room_grid` view
- [ ] `v_forecast_summary_comparison` view
- [ ] `v_forecast_by_room_type` view
- [ ] `v_forecast_by_building` view

### Step 4: Create Server Actions
- [ ] `generateForecast` action
- [ ] `getForecastRoomGrid` action
- [ ] `getForecastSummary` action
- [ ] `adjustForecastItem` action
- [ ] `getForecastAdjustments` action
- [ ] `updateRoomStatusDate` action
- [ ] `importFromKFO` action

### Step 5: Create Frontend Components
- [ ] `ForecastGrid` component
- [ ] `ForecastFilters` component
- [ ] `ForecastCellEditor` component
- [ ] `ForecastKPICards` component
- [ ] `ForecastComparisonChart` component

### Step 6: Create Frontend Pages
- [ ] Update `/dashboard/reports/forecast/grid` page
- [ ] Update `/dashboard/reports/forecast/summary` page
- [ ] Create `/dashboard/reports/forecast/adjustments` page
- [ ] Update navigation menu

### Step 7: Implement Features
- [ ] Room-by-room grid display
- [ ] Color-coded cell rendering
- [ ] FIT vs GRP breakdown
- [ ] Room type breakdown
- [ ] Building filter
- [ ] Manual adjustment interface
- [ ] Adjustment audit trail
- [ ] Forecast vs actual comparison
- [ ] Export to Excel

### Step 8: Testing & Validation
- [ ] Test forecast generation
- [ ] Test manual adjustments
- [ ] Test room status updates
- [ ] Test FIT/GRP breakdown
- [ ] Test comparison reports
- [ ] Validate against KFO output

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Performance with large datasets | Medium | Virtual scrolling, pagination, caching |
| Complex business logic | Medium | Unit tests, gradual rollout |
| Data migration from KFO | Low | Import utility, validation |
| Forecast accuracy issues | Medium | Seasonality tuning, manual overrides |

---

## Success Criteria

- [ ] Room-by-room forecast grid implemented
- [ ] FIT vs GRP breakdown working
- [ ] Room type breakdown supported
- [ ] Building filter implemented
- [ ] Manual adjustments functional
- [ ] Adjustment audit trail complete
- [ ] Forecast vs actual comparison working
- [ ] Room status (OO/OI/HU) handled
- [ ] Booking status management working
- [ ] Seasonality configuration available
- [ ] Corporate allotments supported
- [ ] Export to Excel functional
- [ ] All KFO forecast features available

---

**Estimated Timeline:** 3-4 weeks for full KFO parity

**Recommendation:** Prioritize core forecast grid and adjustments first, then add advanced features incrementally.

---

## Next Steps

1. Review this plan with stakeholders
2. Approve database schema changes
3. Implement Phase 1 (Database Schema)
4. Deploy to staging environment
5. Implement Phase 2 (RPC Functions)
6. Implement Phase 3 (Views)
7. Implement Phase 4 (Server Actions)
8. Implement Phase 5 (Frontend Components)
9. Implement Phase 6 (Frontend Pages)
10. Test and validate
11. Deploy to production

---

**Prepared by:** Claude Code (Sonnet 4.6)
**Date:** 2026-03-03
**Project:** Hotel PMS - KFO Forecast Migration
