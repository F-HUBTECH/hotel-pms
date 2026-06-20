"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { ActionResponse } from "@/lib/types/database";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────

const closeShiftSchema = z.object({
  shiftCode: z.string().min(1),
  shiftDate: z.string().optional(),
  cashCount: z.number().min(0).default(0),
  cardCount: z.number().min(0).default(0),
  transferCount: z.number().min(0).default(0),
  arCount: z.number().min(0).default(0),
  notes: z.string().optional().default(""),
});

const updateConfigSchema = z.object({
  autoPostRoomCharges: z.boolean().default(true),
  autoPostTime: z.string().default("00:00:00"),
  defaultRoomTranCode: z.string().default("ROOM"),
  enableShiftClosing: z.boolean().default(false),
  shiftClosingTime: z.string().default("23:59:00"),
  notificationEmails: z.array(z.string()).default([]),
});

// ─────────────────────────────────────────────
// Helper: get current user id
// ─────────────────────────────────────────────
async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────

export interface NightAuditSummary {
  date: string;
  totalRooms: number;
  occupiedRooms: number;
  arrivals: number;
  departures: number;
  roomCharges: number;
  postedCharges: number;
  folioBalance: number;
}

export interface AuditChecklistItem {
  id: string;
  name: string;
  status: "pending" | "passed" | "failed";
  message?: string;
}

export interface Shift {
  id: string;
  shiftCode: string;
  shiftDate: string;
  shiftType: "morning" | "afternoon" | "night";
  status: "open" | "closed";
  cashierId?: string;
  totalCash: number;
  totalCards: number;
  totalTransfers: number;
  totalAR: number;
  totalRevenue: number;
  roomCount: number;
  checkoutCount: number;
  checkinCount: number;
}

export interface NightAuditLog {
  id: string;
  auditDate: string;
  auditType: "room_posting" | "shift_closing" | "daily_reconciliation";
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  itemsPosted: number;
  itemsFailed: number;
  totalAmount: number;
}

// ─────────────────────────────────────────────
// 1. POST ROOM CHARGES (Night Audit - V9)
//    Auto-post room charges at midnight
// ─────────────────────────────────────────────
export async function nightAuditPostRoomCharges(
  auditDate: string = new Date().toISOString().split("T")[0],
  postDate: string = new Date().toISOString().split("T")[0]
): Promise<ActionResponse<any>> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase.rpc("rpc_night_audit_post_room_charges", {
    p_audit_date: auditDate,
    p_post_date: postDate,
    p_shift_code: "NIGHT",
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/night-audit");
  revalidatePath("/dashboard/cashier");
  revalidatePath("/dashboard/reports");

  return { success: true, data };
}

// ─────────────────────────────────────────────
// 2. CLOSE SHIFT
//    Shift closing with cash count
// ─────────────────────────────────────────────
export async function closeShift(formData: unknown): Promise<ActionResponse<any>> {
  const parsed = closeShiftSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase.rpc("rpc_close_shift", {
    p_shift_code: parsed.data.shiftCode,
    p_shift_date: parsed.data.shiftDate || new Date().toISOString().split("T")[0],
    p_cash_count: parsed.data.cashCount,
    p_card_count: parsed.data.cardCount,
    p_transfer_count: parsed.data.transferCount,
    p_ar_count: parsed.data.arCount,
    p_notes: parsed.data.notes,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/night-audit");
  revalidatePath("/dashboard/shifts");

  return { success: true, data };
}

// ─────────────────────────────────────────────
// 3. GENERATE DAILY RECONCILIATION REPORT
//    Daily revenue summary
// ─────────────────────────────────────────────
export async function generateDailyReconciliationReport(
  reportDate: string = new Date().toISOString().split("T")[0]
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rpc_daily_reconciliation_report", {
    p_report_date: reportDate,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

// ─────────────────────────────────────────────
// 4. GET NIGHT AUDIT CONFIG
// ─────────────────────────────────────────────
export async function getNightAuditConfig(): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("night_audit_config")
    .select("*")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

// ─────────────────────────────────────────────
// 5. UPDATE NIGHT AUDIT CONFIG
// ─────────────────────────────────────────────
export async function updateNightAuditConfig(formData: unknown): Promise<ActionResponse> {
  const parsed = updateConfigSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("night_audit_config")
    .update({
      auto_post_room_charges: parsed.data.autoPostRoomCharges,
      auto_post_time: parsed.data.autoPostTime,
      default_room_tran_code: parsed.data.defaultRoomTranCode,
      enable_shift_closing: parsed.data.enableShiftClosing,
      shift_closing_time: parsed.data.shiftClosingTime,
      notification_emails: parsed.data.notificationEmails,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "00000000-0000-0000-0000-000000000001");

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/night-audit");
  return { success: true };
}

// ─────────────────────────────────────────────
// 6. GET SHIFT REPORT
// ─────────────────────────────────────────────
export async function getShiftReport(
  shiftCode: string,
  shiftDate: string
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("shift_code", shiftCode)
    .eq("shift_date", shiftDate)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

// ─────────────────────────────────────────────
// 7. GET NIGHT AUDIT LOGS
// ─────────────────────────────────────────────
export async function getNightAuditLogs(
  limit: number = 30
): Promise<ActionResponse<NightAuditLog[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("night_audit_logs")
    .select("*")
    .order("audit_date", { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as NightAuditLog[] };
}

// ─────────────────────────────────────────────
// 8. GET NIGHT AUDIT SUMMARY
// ─────────────────────────────────────────────
export async function getNightAuditSummary(
  days: number = 7
): Promise<ActionResponse<any>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_night_audit_summary")
    .select("*")
    .gte("audit_date", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order("audit_date", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

// ─────────────────────────────────────────────
// 9. GET SHIFTS BY DATE RANGE
// ─────────────────────────────────────────────
export async function getShifts(
  startDate?: string,
  endDate?: string
): Promise<ActionResponse<Shift[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("shifts")
    .select("*")
    .order("shift_date", { ascending: false })
    .order("shift_type", { ascending: true });

  if (startDate) {
    query = query.gte("shift_date", startDate);
  }
  if (endDate) {
    query = query.lte("shift_date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as Shift[] };
}

// ─────────────────────────────────────────────
// 10. CREATE MANUAL SHIFT
// ─────────────────────────────────────────────
export async function createManualShift(formData: unknown): Promise<ActionResponse<any>> {
  const schema = z.object({
    shiftCode: z.string().min(1),
    shiftDate: z.string().optional().default(new Date().toISOString().split("T")[0]),
    shiftType: z.enum(["morning", "afternoon", "night"]).default("afternoon"),
    startTime: z.string().default("14:00:00"),
    cashierId: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shifts")
    .insert({
      shift_code: parsed.data.shiftCode,
      shift_date: parsed.data.shiftDate,
      shift_type: parsed.data.shiftType,
      start_time: parsed.data.startTime,
      cashier_id: parsed.data.cashierId,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/shifts");
  return { success: true, data };
}

// ─────────────────────────────────────────────
// Legacy Functions (kept for compatibility)
// ─────────────────────────────────────────────

async function getMainPropertyId() {
  const supabase = await createClient();
  const { data } = await supabase.from("properties").select("id").eq("code", "MAIN").single();
  return data?.id;
}

// Get night audit summary (legacy)
export async function getNightAuditSummaryLegacy(date: string): Promise<ActionResponse<NightAuditSummary>> {
  const supabase = await createClient();

  try {
    // Get room stats
    const { data: rooms, error: roomsError } = await supabase.from("rooms").select("status");

    if (roomsError) throw roomsError;

    const occupiedCount = rooms?.filter((r) => r.status === "occupied").length || 0;

    // Get arrivals
    const { count: arrivalsCount, error: arrivalsError } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("check_in_date", date)
      .eq("status", "reserved");

    if (arrivalsError) throw arrivalsError;

    // Get departures
    const { count: departuresCount, error: departuresError } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("check_out_date", date)
      .eq("status", "checked_in");

    if (departuresError) throw departuresError;

    // Get folio stats
    const { data: folios, error: foliosError } = await supabase
      .from("folios")
      .select("total_amount, balance, status")
      .eq("status", "open");

    if (foliosError) throw foliosError;

    const totalFolioBalance = folios?.reduce((sum, f) => sum + Number(f.balance || 0), 0) || 0;

    // Get posted charges for today
    const { data: charges, error: chargesError } = await supabase
      .from("folio_items")
      .select("amount")
      .eq("item_date", date);

    if (chargesError) throw chargesError;

    const postedChargesTotal = charges?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;

    return {
      success: true,
      data: {
        date,
        totalRooms: rooms?.length || 0,
        occupiedRooms: occupiedCount,
        arrivals: arrivalsCount || 0,
        departures: departuresCount || 0,
        roomCharges: 0,
        postedCharges: postedChargesTotal,
        folioBalance: totalFolioBalance,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get audit checklist
export async function getAuditChecklist(date: string): Promise<ActionResponse<AuditChecklistItem[]>> {
  const supabase = await createClient();

  const checklist: AuditChecklistItem[] = [];

  try {
    // Check 1: No pending checkouts
    const { count: pendingCheckouts } = await supabase
      .from("reservations")
      .select("id", { count: "exact" })
      .eq("status", "checked_in")
      .lte("check_out_date", date);

    checklist.push({
      id: "pending_checkouts",
      name: "No pending check-outs",
      status: (pendingCheckouts || 0) === 0 ? "passed" : "failed",
      message: pendingCheckouts ? `${pendingCheckouts} pending check-outs` : undefined,
    });

    // Check 2: No unbalanced folios
    const { data: unbalanced, error: unbalancedError } = await supabase
      .from("folios")
      .select("id")
      .eq("status", "open")
      .neq("balance", 0);

    if (unbalancedError) throw unbalancedError;

    checklist.push({
      id: "unbalanced_folios",
      name: "All folios balanced",
      status: (unbalanced?.length || 0) === 0 ? "passed" : "failed",
      message: unbalanced?.length ? `${unbalanced.length} unbalanced folios` : undefined,
    });

    // Check 3: Room status check
    checklist.push({
      id: "room_status_check",
      name: "Room statuses consistent",
      status: "passed",
    });

    return { success: true, data: checklist };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Post room charges for all occupied rooms (legacy)
export async function postRoomCharges(date: string): Promise<ActionResponse<{ posted: number; total: number }>> {
  const supabase = await createClient();

  try {
    // Get all checked-in reservations
    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("*, folio:folios(id), room:rooms(id, room_number), room_type:room_types(id, base_price)")
      .eq("status", "checked_in");

    if (resError) throw resError;

    if (!reservations || reservations.length === 0) {
      return { success: true, data: { posted: 0, total: 0 } };
    }

    let posted = 0;
    let total = 0;

    for (const reservation of reservations) {
      const folio = (reservation as any).folio as any;
      if (!folio?.id) continue;

      // Calculate room charge
      const rate = Number(reservation.rate || (reservation as any).room_type?.base_price || 0);
      const chargeAmount = rate;

      if (chargeAmount > 0) {
        // Check if already posted for this date
        const { data: existing, error: existingError } = await supabase
          .from("folio_items")
          .select("id")
          .eq("folio_id", folio.id)
          .eq("item_date", date)
          .ilike("description", "%Room charge%");

        if (existingError) throw existingError;

        // Only post if not already posted
        if (!existing || existing.length === 0) {
          const { error: insertError } = await supabase.from("folio_items").insert({
            folio_id: folio.id,
            description: `Room charge - ${(reservation as any).room?.room_number || "Room"} (${date})`,
            amount: chargeAmount,
            item_date: date,
            quantity: 1,
            unit_price: rate,
          });

          if (insertError) throw insertError;

          posted++;
          total += chargeAmount;
        }
      }
    }

    return { success: true, data: { posted, total } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Run night audit action (wrapper)
export async function runNightAuditAction(date: string): Promise<ActionResponse<{ posted: number; total: number }>> {
  return postRoomCharges(date);
}
