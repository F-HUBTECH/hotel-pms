"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/database";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────
// V10 Reports (Schema V10 - Advanced Reports)
// ─────────────────────────────────────────────

export async function getPaymentReconciliationReportV10(
  startDate: string,
  endDate?: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  let query = supabase
    .from("v_payment_reconciliation_report")
    .select("*")
    .gte("report_date", startDate);

  if (endDate) query = query.lte("report_date", endDate);

  const { data, error } = await query.order("report_date", { ascending: true });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getFolioAgingReportV10(): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_folio_aging_report")
    .select("*")
    .order("aging_category", { ascending: false })
    .order("check_out_date", { ascending: true });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getTaxInvoiceSummaryV10(
  startDate: string,
  endDate?: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  let query = supabase
    .from("v_tax_invoice_summary")
    .select("*")
    .gte("report_date", startDate);

  if (endDate) query = query.lte("report_date", endDate);

  const { data, error } = await query.order("report_date", { ascending: false });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getAuditTrailReportV10(
  startDate: string,
  endDate?: string,
  folioId?: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  let query = supabase
    .from("v_audit_trail_report")
    .select("*")
    .gte("report_date", startDate);

  if (endDate) query = query.lte("report_date", endDate);
  if (folioId) query = query.eq("folio_id", folioId);

  const { data, error } = await query.order("timestamp", { ascending: false });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getShiftSummaryReportV10(
  startDate: string,
  endDate?: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  let query = supabase
    .from("v_shift_summary_report")
    .select("*")
    .gte("report_date", startDate);

  if (endDate) query = query.lte("report_date", endDate);

  const { data, error } = await query.order("report_date", { ascending: false });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getRoomRevenueByTypeV10(
  startDate: string,
  endDate?: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  let query = supabase
    .from("v_room_revenue_by_type")
    .select("*")
    .gte("report_date", startDate);

  if (endDate) query = query.lte("report_date", endDate);

  const { data, error } = await query.order("report_date", { ascending: true });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getMonthlyRevenueSummaryV10(
  months: number = 6
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from("v_monthly_revenue_summary")
    .select("*")
    .gte("report_month", startDate.toISOString())
    .order("report_month", { ascending: false })
    .limit(months * 10);

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getDepartmentRevenueReportV10(
  startDate: string,
  endDate?: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  let query = supabase
    .from("v_department_revenue_report")
    .select("*")
    .gte("report_date", startDate);

  if (endDate) query = query.lte("report_date", endDate);

  const { data, error } = await query.order("report_date", { ascending: true });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

export async function getGuestAccountStatementV10(
  reservationNumber: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_guest_account_statement")
    .select("*")
    .eq("reservation_number", reservationNumber)
    .order("folio_seq", { ascending: true })
    .order("transaction_date", { ascending: true });

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}
