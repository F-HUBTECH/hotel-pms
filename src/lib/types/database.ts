// =============================================
// Database Types - matches Supabase schema
// =============================================

export type UserRole = "super_admin" | "admin" | "manager" | "staff";
export type RoomStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "maintenance"
  | "out_of_order"
  | "dirty"
  | "clean";
export type CalculationType =
  | "fixed"
  | "percentage"
  | "per_night"
  | "per_person";
export type ReservationStatus =
  | "reserved"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";
export type FolioStatus = "open" | "closed" | "void";
export type TransactionType =
  | "room_charge"
  | "service"
  | "tax"
  | "payment"
  | "refund";
export type VatType = "V" | "N" | "E"; // Vatable | Non-VAT | Exempt
export type PayfFlag = "" | "I" | "P" | "C" | "W";
// I = Item, P = Paid (settled), C = Credit Note issued, W = Voided

// =============================================
// Profile
// =============================================
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// Buildings
// =============================================
export interface Building {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}
export type BuildingInsert = Omit<Building, "id" | "created_at" | "updated_at">;
export type BuildingUpdate = Partial<BuildingInsert>;

// =============================================
// Floor Plans
// =============================================
export interface FloorPlan {
  id: string;
  building_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  // Joined
  building?: Building;
}
export type FloorPlanInsert = Omit<
  FloorPlan,
  "id" | "created_at" | "updated_at" | "building"
>;
export type FloorPlanUpdate = Partial<FloorPlanInsert>;

// =============================================
// Room Types
// =============================================
export interface RoomType {
  id: string;
  code: string;
  name: string;
  description: string;
  base_price: number;
  max_occupancy?: number;
  created_at: string;
  updated_at: string;
}
export type RoomTypeInsert = Omit<RoomType, "id" | "created_at" | "updated_at">;
export type RoomTypeUpdate = Partial<RoomTypeInsert>;

// =============================================
// Rooms
// =============================================
export interface Room {
  id: string;
  room_number: string;
  building_id: string;
  floor_plan_id: string | null;
  room_type_id: string;
  status: RoomStatus;
  created_at: string;
  updated_at: string;
  // Joined
  building?: Building;
  floor_plan?: FloorPlan;
  room_type?: RoomType;
}
export type RoomInsert = Omit<
  Room,
  "id" | "created_at" | "updated_at" | "building" | "floor_plan" | "room_type"
>;
export type RoomUpdate = Partial<RoomInsert>;

// =============================================
// Rate Groups
// =============================================
export interface RateGroup {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
}
export type RateGroupInsert = Omit<
  RateGroup,
  "id" | "created_at" | "updated_at"
>;
export type RateGroupUpdate = Partial<RateGroupInsert>;

// =============================================
// Rate Formulas
// =============================================
export interface RateFormula {
  id: string;
  rate_group_id: string;
  calculation_type: CalculationType;
  value: number;
  description: string;
  created_at: string;
  updated_at: string;
  rate_group?: RateGroup;
}
export type RateFormulaInsert = Omit<
  RateFormula,
  "id" | "created_at" | "updated_at" | "rate_group"
>;
export type RateFormulaUpdate = Partial<RateFormulaInsert>;

// =============================================
// Simple name-only tables
// =============================================
export interface NamedEntity {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
export type NamedEntityInsert = Omit<
  NamedEntity,
  "id" | "created_at" | "updated_at"
>;
export type NamedEntityUpdate = Partial<NamedEntityInsert>;

// Market Groups, Guest Types, Passport Types, Visa Types,
// Booking Sources, Channels, Departments, User Groups, Folio Groups
export type MarketGroup = NamedEntity;
export type GuestType = NamedEntity;
export type PassportType = NamedEntity;
export type VisaType = NamedEntity;
export type BookingSource = NamedEntity;
export type Channel = NamedEntity;
export type Department = NamedEntity;
export type UserGroup = NamedEntity;
export type FolioGroup = NamedEntity;

// =============================================
// Markets
// =============================================
export interface Market {
  id: string;
  market_group_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  market_group?: MarketGroup;
}
export type MarketInsert = Omit<
  Market,
  "id" | "created_at" | "updated_at" | "market_group"
>;
export type MarketUpdate = Partial<MarketInsert>;

// =============================================
// Nationalities
// =============================================
export interface Nationality {
  id: string;
  name: string;
  country_code: string;
  created_at: string;
  updated_at: string;
}
export type NationalityInsert = Omit<
  Nationality,
  "id" | "created_at" | "updated_at"
>;
export type NationalityUpdate = Partial<NationalityInsert>;

// =============================================
// Special Services
// =============================================
export interface SpecialService {
  id: string;
  name: string;
  price: number;
  created_at: string;
  updated_at: string;
}
export type SpecialServiceInsert = Omit<
  SpecialService,
  "id" | "created_at" | "updated_at"
>;
export type SpecialServiceUpdate = Partial<SpecialServiceInsert>;

// =============================================
// Zone Codes
// =============================================
export interface ZoneCode {
  id: string;
  code: string;
  description: string;
  created_at: string;
  updated_at: string;
}
export type ZoneCodeInsert = Omit<ZoneCode, "id" | "created_at" | "updated_at">;
export type ZoneCodeUpdate = Partial<ZoneCodeInsert>;

// =============================================
// Generic response type
// =============================================
export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

// =============================================
// Guests
// =============================================
export interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  nationality_id: string | null;
  passport_type_id: string | null;
  passport_number: string;
  visa_type_id: string | null;
  address: string;
  vip?: boolean;
  birthday?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  company?: string | null;
  tax_id?: string | null;
  remark?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  nationality?: Nationality;
  passport_type?: PassportType;
  visa_type?: VisaType;
}
export type GuestInsert = Omit<
  Guest,
  | "id"
  | "created_at"
  | "updated_at"
  | "nationality"
  | "passport_type"
  | "visa_type"
>;
export type GuestUpdate = Partial<GuestInsert>;

// =============================================
// Reservations
// =============================================
export interface Reservation {
  id: string;
  reservation_number: string;
  guest_id: string;
  room_id: string | null;
  room_type_id: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  rate: number;
  status: ReservationStatus;
  source_id: string | null;
  market_id: string | null;
  notes: string;
  share_with?: string | null;
  room_qty?: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Agent/Company
  agent_id?: string | null;
  company_id?: string | null;
  vip_level?: string | null;
  arrival_flight?: string | null;
  arrival_time?: string | null;
  departure_flight?: string | null;
  departure_time?: string | null;
  // Allotment
  allotment_code?: string | null;
  // Joined
  guest?: Guest;
  room?: Room;
  room_type?: RoomType;
  source?: BookingSource;
  market?: Market;
  creator?: Profile;
  agent?: { id: string; name: string; company_type?: string } | null;
  company?: { id: string; name: string; company_type?: string } | null;
}
export type ReservationInsert = Omit<
  Reservation,
  | "id"
  | "reservation_number"
  | "created_at"
  | "updated_at"
  | "guest"
  | "room"
  | "room_type"
  | "source"
  | "market"
  | "creator"
>;
export type ReservationUpdate = Partial<ReservationInsert>;

// =============================================
// Revenue Transaction Codes
// (revenuetrancode — maps code → description, VAT, GL)
// =============================================
export interface RevenueTransactionCode {
  id: string;
  code: string;
  description: string;
  gl_account_code: string | null;
  department_id: string | null;
  vat_type: VatType;
  vat_inclusive: boolean;
  default_vat_rate: number;
  default_serv_rate: number;
  allow_manual_post: boolean;
  is_rebate: boolean;
  is_payment_code: boolean;
  is_advance_payment: boolean;
  default_folio_seq: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================
// Billing Addresses
// (Billaddress.pas — ที่อยู่ใบเสร็จ/ใบกำกับภาษี)
// =============================================
export interface BillingAddress {
  id: string;
  reservation_id: string | null;
  company_name: string;
  attn_name: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  country: string;
  tax_id: string;
  phone: string;
  email: string;
  reference_no: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export type BillingAddressInsert = Omit<
  BillingAddress,
  "id" | "created_at" | "updated_at"
>;
export type BillingAddressUpdate = Partial<BillingAddressInsert>;

// =============================================
// Folio Setup (Billing Instructions)
// (foliosetupdetail + foliosetupmaster)
// =============================================
export interface FolioSetup {
  id: string;
  reservation_id: string;
  tran_code: string;
  folio_seq: number;
  limit_amount: number;
  until_date: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  // Joined
  tran_code_info?: RevenueTransactionCode;
}
export type FolioSetupInsert = Omit<
  FolioSetup,
  "id" | "created_at" | "tran_code_info"
>;

// =============================================
// Folio Payments
// (billtransaction with is_payment_code=true, stored separately)
// =============================================
export interface FolioPayment {
  id: string;
  folio_id: string;
  tran_code: string | null;
  payment_method: string;
  amount: number;
  reference_number: string;
  notes: string;
  pay_remark1: string;
  pay_remark2: string;
  pay_remark3: string;
  card_type: string;
  card_number_last4: string;
  approval_code: string;
  shift_code: string;
  is_voided: boolean;
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_by: string | null;
  created_at: string;
}

// =============================================
// Tax Invoices (TAX_INV, INV_NO — ใบกำกับภาษี)
// =============================================
export interface TaxInvoice {
  id: string;
  invoice_number: number;
  folio_id: string;
  reservation_id: string | null;
  issue_date: string;
  company_name: string;
  tax_id: string;
  address: string;
  subtotal: number;
  vat_amount: number;
  service_charge: number;
  total_amount: number;
  is_credit_note: boolean;
  original_inv_id: string | null;
  issued_by: string | null;
  printed_at: string | null;
  created_at: string;
}

// =============================================
// Folios (Phase 4 Accounting — updated V8)
// =============================================
export interface Folio {
  id: string;
  reservation_id: string;
  folio_seq: number; // 1-4 (Folio 1, 2, 3, 4)
  folio_number: string | null;
  total_amount: number;
  paid_amount: number;
  tax_amount: number;
  service_charge: number;
  discount: number;
  balance: number;
  status: FolioStatus;
  // Lock (block/unblock folio)
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  // Billing address link
  billing_address_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  // Joined
  reservation?: Reservation;
  items?: FolioItem[];
  folio_payments?: FolioPayment[];
  billing_address?: BillingAddress;
}

// =============================================
// Folio Items (updated V8 — VAT, shift, credit note)
// =============================================
export interface FolioItem {
  id: string;
  folio_id: string;
  // Transaction code (TRAN_CODE)
  tran_code: string | null;
  description: string;
  amount: number;
  org_amount: number; // original amount before correction
  item_date: string;
  quantity: number;
  unit_price: number;
  folio_group_id?: string | null;
  // VAT / Service Charge breakdown (VAT_PER, VAT_AMT, SERV_PER, SERV_AMT)
  vat_type: VatType;
  vat_rate: number;
  vat_amount: number;
  service_rate: number;
  service_amount: number;
  vatable_amount: number; // VATABLE
  non_vat_amount: number; // NONVAT
  // Payment/status flag (PAYF — I=item, P=paid, C=credit, W=void)
  payf: PayfFlag;
  // Credit Note (CRNOTE)
  credit_note_no: number;
  credit_note_ref: number;
  // Tax Invoice
  tax_inv_no: number;
  // Reference / Remarks (REFERENCE, REMARK, PAYREMARK1/2/3)
  reference: string;
  remark: string;
  pay_remark1: string;
  pay_remark2: string;
  pay_remark3: string;
  // Audit / Shift tracking (audituser, SHIFTCODE)
  shift_code: string;
  posted_by: string | null;
  // Auto-post (AUTOPOST_DATE — night audit)
  auto_post_date: string | null;
  // Advance payment flag
  is_advance_payment: boolean;
  // Void
  is_voided: boolean;
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  created_at?: string;
  // Joined
  folio_group?: { id: string; name: string };
  tran_code_info?: RevenueTransactionCode;
}

// =============================================
// Folio Transactions
// =============================================
export interface FolioTransaction {
  id: string;
  folio_id: string;
  transaction_type: TransactionType;
  description: string;
  debit: number;
  credit: number;
  reference_no: string;
  posted_by: string | null;
  posted_at: string;

  // Joined
  posted_by_user?: Profile;
}

// =============================================
// Account Postings (General Ledger)
// =============================================
export interface AccountPosting {
  id: string;
  folio_transaction_id: string;
  gl_account_code: string;
  debit: number;
  credit: number;
  posted_date: string;
  created_at: string;
}

// =============================================
// Chart of Accounts
// =============================================
export interface ChartOfAccount {
  id: string;
  account_code: string;
  account_name: string;
  type: "asset" | "liability" | "income" | "expense";
  created_at: string;
}

// =============================================
// Payment Methods
// =============================================
export interface PaymentMethod {
  id: string;
  name: string;
  accounting_code: string;
  created_at: string;
}

// =============================================
// Forecasts
// =============================================
export interface Forecast {
  id: string;
  property_id: string;
  forecast_date: string;
  total_rooms: number;
  expected_occupancy: number;
  expected_revenue: number;
  occupancy_percentage: number;
  adr: number;
  revpar: number;
  created_at: string;
}

// =============================================
// Audit Logs
// =============================================
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  // Joined
  user?: Profile;
}

// =============================================
// PHASE 2 & MULTI-PROPERTY FULL ENTITIES
// =============================================

export interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  timezone: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomInventory {
  id: string;
  property_id: string;
  room_type_id: string;
  inventory_date: string;
  total_rooms: number;
  available_rooms: number;
  reserved_rooms: number;
  out_of_order_rooms: number;
  created_at: string;
  updated_at: string;
}

export interface RatePlan {
  id: string;
  property_id: string;
  name: string;
  room_type_id: string;
  base_price: number;
  refundable: boolean;
  cancellation_policy: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeasonalRate {
  id: string;
  rate_plan_id: string;
  start_date: string;
  end_date: string;
  price: number;
  created_at: string;
}

export interface WeekdayRate {
  id: string;
  rate_plan_id: string;
  weekday: number;
  price: number;
  created_at: string;
}

export type PaymentMethodType = "cash" | "credit_card" | "transfer" | "other";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  payment_method: PaymentMethodType;
  status: PaymentStatus;
  reference_number: string;
  notes: string;
  paid_at: string;
  created_by: string | null;
  created_at: string;
}

export type HousekeepingStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";
export type HousekeepingPriority = "low" | "normal" | "high" | "urgent";
export type TaskType = "cleaning" | "inspection" | "maintenance" | "turndown";

export interface HousekeepingTask {
  id: string;
  room_id: string;
  status: HousekeepingStatus;
  assigned_to: string | null;
  priority: HousekeepingPriority;
  task_type: TaskType;
  notes: string;
  scheduled_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NightAudit {
  id: string;
  property_id: string;
  audit_date: string;
  total_rooms: number;
  occupied_rooms: number;
  occupancy_rate: number;
  total_revenue: number;
  adr: number;
  revpar: number;
  no_shows: number;
  performed_by: string | null;
  created_at: string;
}

export interface ChannelReservation {
  id: string;
  reservation_id: string | null;
  channel_id: string;
  external_id: string;
  raw_payload: Record<string, unknown>;
  sync_status: "pending" | "synced" | "failed" | "cancelled";
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}
