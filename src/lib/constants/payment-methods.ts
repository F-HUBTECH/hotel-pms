// ─────────────────────────────────────────────
// Payment method constants
// Kept in a plain module (not "use server") so they can be
// imported by both server actions and client components.
// ─────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: "💵" },
  { value: "VISA", label: "Visa Card", icon: "💳" },
  { value: "MCARD", label: "Master Card", icon: "💳" },
  { value: "AMEX", label: "American Express", icon: "💳" },
  { value: "JCB", label: "JCB Card", icon: "💳" },
  { value: "BKTRF", label: "Bank Transfer", icon: "🏦" },
  { value: "CHQUE", label: "Cheque", icon: "📄" },
  { value: "ONLINE", label: "Online Payment", icon: "🌐" },
  { value: "DEPST", label: "Advance Deposit", icon: "📥" },
  { value: "AR", label: "City Ledger / AR", icon: "🏢" },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];
