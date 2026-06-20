/**
 * Centralized route paths for the application.
 * Use these constants instead of hardcoded strings in links and navigation.
 */

export const ROUTES = {
    // Auth
    LOGIN: '/login',

    // Dashboard
    DASHBOARD: '/dashboard',

    // Front Desk
    RESERVATIONS: '/dashboard/reservations',
    RESERVATIONS_NEW: '/dashboard/reservations/new',
    RESERVATIONS_DETAIL: (id: string) => `/dashboard/reservations/${id}`,
    RESERVATIONS_INVOICE: (id: string) => `/dashboard/reservations/${id}/invoice`,
    ROOM_CHART: '/dashboard/room-chart',
    GROUPS: '/dashboard/groups',
    GROUPS_NEW: '/dashboard/groups/new',
    GROUPS_DETAIL: (id: string) => `/dashboard/groups/${id}`,
    CALENDAR: '/dashboard/calendar',
    GUESTS: '/dashboard/guests',

    // Cashier
    CASHIER: '/dashboard/cashier',
    CASHIER_FAST_POSTING: '/dashboard/cashier/fast-posting',
    CASHIER_FOLIO_HISTORY: '/dashboard/cashier/folio-history',
    CASHIER_FOLIO_INQUIRY: '/dashboard/cashier/folio-inquiry',
    CASHIER_SEARCH_TRANSACTION: '/dashboard/cashier/search-transaction',

    // Operations
    OPERATIONS_CHANNEL_SYNC: '/dashboard/operations/channel-sync',
    OPERATIONS_HOUSEKEEPING: '/dashboard/operations/housekeeping',
    OPERATIONS_NIGHT_AUDIT: '/dashboard/operations/night-audit',

    // Reports
    REPORTS: '/dashboard/reports',
    REPORTS_FORECAST: '/dashboard/reports/forecast',
    REPORTS_OCCUPANCY: '/dashboard/reports/occupancy',
    REPORTS_REVENUE: '/dashboard/reports/revenue',
    REPORTS_AGING: '/dashboard/reports/aging',
    REPORTS_GUEST_LEDGER: '/dashboard/reports/guest-ledger',
    REPORTS_TRIAL_BALANCE: '/dashboard/reports/trial-balance',

    // Master Data (admin only)
    MASTER: '/dashboard/master',
    MASTER_BUILDINGS: '/dashboard/master/buildings',
    MASTER_FLOOR_PLANS: '/dashboard/master/floor-plans',
    MASTER_ROOM_TYPES: '/dashboard/master/room-types',
    MASTER_ROOMS: '/dashboard/master/rooms',
    MASTER_RATE_PLANS: '/dashboard/master/rate-plans',
    MASTER_RATE_GROUPS: '/dashboard/master/rate-groups',
    MASTER_RATE_FORMULAS: '/dashboard/master/rate-formulas',
    MASTER_BOOKING_SOURCES: '/dashboard/master/booking-sources',
    MASTER_CHANNELS: '/dashboard/master/channels',
    MASTER_MARKET_GROUPS: '/dashboard/master/market-groups',
    MASTER_MARKETS: '/dashboard/master/markets',
    MASTER_GUEST_TYPES: '/dashboard/master/guest-types',
    MASTER_NATIONALITIES: '/dashboard/master/nationalities',
    MASTER_PASSPORT_TYPES: '/dashboard/master/passport-types',
    MASTER_VISA_TYPES: '/dashboard/master/visa-types',
    MASTER_DEPARTMENTS: '/dashboard/master/departments',
    MASTER_USER_GROUPS: '/dashboard/master/user-groups',
    MASTER_FOLIO_GROUPS: '/dashboard/master/folio-groups',
    MASTER_SPECIAL_SERVICES: '/dashboard/master/special-services',
    MASTER_ZONE_CODES: '/dashboard/master/zone-codes',
    MASTER_ALLOTMENTS: '/dashboard/master/allotments',
    MASTER_ROOM_VIEWS: '/dashboard/master/room-views',

    // Admin
    ADMIN_USER_RIGHTS: '/dashboard/admin/user-rights',
} as const
