"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type {
  ActionResponse,
  Folio,
  FolioItem,
  FolioPayment,
  RevenueTransactionCode,
  BillingAddress,
  FolioSetup,
  TaxInvoice,
} from "@/lib/types/database";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────

const postItemSchema = z.object({
  folio_id: z.string().uuid(),
  tran_code: z.string().min(1, "Transaction code is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  quantity: z.number().int().min(1).default(1),
  item_date: z.string(),
  reference: z.string().optional().default(""),
  remark: z.string().optional().default(""),
  folio_group_id: z.string().uuid().nullable().optional(),
  override_vat_rate: z.number().min(0).max(100).nullable().optional(),
  override_sc_rate: z.number().min(0).max(100).nullable().optional(),
});

const receivePaymentSchema = z.object({
  folio_id: z.string().uuid(),
  tran_code: z.string().min(1).default("CASH"),
  payment_method: z.string().min(1),
  amount: z.number().positive("Payment amount must be greater than 0"),
  reference_number: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  pay_remark1: z.string().optional().default(""),
  pay_remark2: z.string().optional().default(""),
  pay_remark3: z.string().optional().default(""),
  card_type: z.string().optional().default(""),
  card_number_last4: z.string().optional().default(""),
  approval_code: z.string().optional().default(""),
  payf: z.enum(['P', 'C']).optional().default('P'),
  payment_type: z.enum(['PA', 'PT', 'PR']).optional().default('PA'),
});

const billingAddressSchema = z.object({
  reservation_id: z.string().uuid(),
  company_name: z.string().optional().default(""),
  attn_name: z.string().optional().default(""),
  address_line1: z.string().optional().default(""),
  address_line2: z.string().optional().default(""),
  address_line3: z.string().optional().default(""),
  city: z.string().optional().default(""),
  country: z.string().optional().default(""),
  tax_id: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  reference_no: z.string().optional().default(""),
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
// FOLIO QUERY HELPERS
// ─────────────────────────────────────────────

const FOLIO_SELECT = `
  *,
  reservation:reservations(
    id, reservation_number, check_in_date, check_out_date, status, rate,
    guest:guests(id, first_name, last_name, email, phone),
    room:rooms(id, room_number)
  )
`;

// ─────────────────────────────────────────────
// 1. GET TRANSACTION CODES
//    (revenuetrancode list for dropdown)
// ─────────────────────────────────────────────
export async function getTransactionCodes(
  onlyManual = true,
  includePayments = false,
): Promise<ActionResponse<RevenueTransactionCode[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("revenue_transaction_codes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (onlyManual) query = query.eq("allow_manual_post", true);
  if (!includePayments) query = query.eq("is_payment_code", false);

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as RevenueTransactionCode[] };
}

export async function getPaymentCodes(): Promise<
  ActionResponse<RevenueTransactionCode[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("revenue_transaction_codes")
    .select("*")
    .eq("is_active", true)
    .eq("is_payment_code", true)
    .order("sort_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as RevenueTransactionCode[] };
}

// ─────────────────────────────────────────────
// 2. GET OR CREATE 4 FOLIOS FOR A RESERVATION
//    (Folio 1, 2, 3, 4 per guest)
// ─────────────────────────────────────────────
export async function getOrCreateReservationFolios(
  reservationId: string,
): Promise<ActionResponse<Folio[]>> {
  const supabase = await createClient();

  // Use the RPC to ensure all 4 folios exist
  const { error: rpcError } = await supabase.rpc(
    "get_or_create_reservation_folios",
    { p_reservation_id: reservationId },
  );
  if (rpcError) {
    // Fallback: just fetch existing folios if RPC not available
    console.warn(
      "get_or_create_reservation_folios RPC error:",
      rpcError.message,
    );
  }

  // Fetch all folios with full data
  const { data, error } = await supabase
    .from("folios")
    .select(FOLIO_SELECT)
    .eq("reservation_id", reservationId)
    .is("deleted_at", null)
    .order("folio_seq", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as unknown as Folio[] };
}

// ─────────────────────────────────────────────
// 3. GET ALL OPEN FOLIOS (Cashier main list)
//    Search by guest name or room number
// ─────────────────────────────────────────────
export interface GetOpenFoliosOptions {
  search?: string;
  /** cbChkouttoday — show only guests whose check-out date is today */
  dueOutToday?: boolean;
  /** cbChkOutOnly — include checked-out (status=checked_out) as well */
  checkoutOnly?: boolean;
}

export async function getOpenFolios(
  search = "",
  opts: GetOpenFoliosOptions = {},
): Promise<ActionResponse<Folio[]>> {
  const supabase = await createClient();

  const todayStr = new Date().toISOString().split("T")[0];

  // Statuses to include
  const statuses = opts.checkoutOnly ? ["checked_out"] : ["checked_in"];

  // Build reservation query
  let reservationQuery = supabase
    .from("reservations")
    .select("id")
    .in("status", statuses)
    .is("deleted_at", null);

  // cbChkouttoday / cbdueout filter
  if (opts.dueOutToday) {
    reservationQuery = reservationQuery.eq("check_out_date", todayStr);
  }

  // Search by guest name / room / reservation number
  if (search.trim()) {
    const { data: guests } = await supabase
      .from("guests")
      .select("id")
      .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

    const { data: rooms } = await supabase
      .from("rooms")
      .select("id")
      .ilike("room_number", `%${search}%`);

    const guestIds = (guests ?? []).map((g: any) => g.id);
    const roomIds = (rooms ?? []).map((r: any) => r.id);

    if (guestIds.length > 0 || roomIds.length > 0) {
      if (guestIds.length > 0 && roomIds.length > 0) {
        reservationQuery = reservationQuery.or(
          `guest_id.in.(${guestIds.join(",")}),room_id.in.(${roomIds.join(",")})`,
        );
      } else if (guestIds.length > 0) {
        reservationQuery = reservationQuery.in("guest_id", guestIds);
      } else {
        reservationQuery = reservationQuery.in("room_id", roomIds);
      }
    } else {
      reservationQuery = reservationQuery.ilike(
        "reservation_number",
        `%${search}%`,
      );
    }
  }

  const { data: reservations, error: resError } = await reservationQuery;
  if (resError) return { success: false, error: resError.message };
  if (!reservations || reservations.length === 0)
    return { success: true, data: [] };

  const reservationIds = reservations.map((r: any) => r.id);

  // Fetch folio_seq = 1 only for the list (primary folio per guest)
  const { data, error } = await supabase
    .from("folios")
    .select(FOLIO_SELECT)
    .in("reservation_id", reservationIds)
    .eq("folio_seq", 1)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as unknown as Folio[] };
}

// ─────────────────────────────────────────────
// 4. GET SINGLE FOLIO BY ID
// ─────────────────────────────────────────────
export async function getFolioById(
  folioId: string,
): Promise<ActionResponse<Folio>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folios")
    .select(FOLIO_SELECT)
    .eq("id", folioId)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as unknown as Folio };
}

// ─────────────────────────────────────────────
// 5. POST TRANSACTION (with VAT / SC via RPC)
//    (PostNewFolioTransactionEX)
// ─────────────────────────────────────────────
export async function postFolioTransaction(
  formData: unknown,
): Promise<ActionResponse<{ item_id: string }>> {
  const parsed = postItemSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Check folio is not locked
  const { data: folio } = await supabase
    .from("folios")
    .select("is_locked, status")
    .eq("id", parsed.data.folio_id)
    .single();

  if (!folio) return { success: false, error: "Folio not found" };
  if (folio.is_locked)
    return {
      success: false,
      error: "Folio is locked. Please unlock before posting.",
    };
  if (folio.status !== "open")
    return { success: false, error: "Folio is not open." };

  // Call the RPC that handles VAT calculation
  const { data, error } = await supabase.rpc("rpc_post_folio_item", {
    p_folio_id: parsed.data.folio_id,
    p_tran_code: parsed.data.tran_code,
    p_description: parsed.data.description,
    p_amount: parsed.data.amount,
    p_quantity: parsed.data.quantity,
    p_item_date: parsed.data.item_date,
    p_reference: parsed.data.reference ?? "",
    p_remark: parsed.data.remark ?? "",
    p_folio_group_id: parsed.data.folio_group_id ?? null,
    p_user_id: userId,
    p_shift_code: "",
    p_override_vat_rate: parsed.data.override_vat_rate ?? null,
    p_override_sc_rate: parsed.data.override_sc_rate ?? null,
  });

  if (error) {
    // Fallback: insert directly if RPC not deployed yet
    const tc = await supabase
      .from("revenue_transaction_codes")
      .select("*")
      .eq("code", parsed.data.tran_code)
      .single();

    if (tc.error)
      return {
        success: false,
        error: `Transaction code error: ${tc.error.message}`,
      };
    const tcData = tc.data;

    // Calculate VAT
    const gross = parsed.data.amount * parsed.data.quantity;
    let vatAmt = 0;
    let servAmt = 0;
    let vatableAmt = 0;
    let nonVatAmt = 0;
    const vatRate = parsed.data.override_vat_rate ?? tcData.default_vat_rate;
    const servRate = parsed.data.override_sc_rate ?? tcData.default_serv_rate;

    if (tcData.vat_type === "V") {
      if (tcData.vat_inclusive) {
        vatAmt = Math.round(((gross * vatRate) / (100 + vatRate)) * 100) / 100;
        servAmt =
          Math.round(((gross * servRate) / (100 + vatRate + servRate)) * 100) /
          100;
        vatableAmt = gross;
      } else {
        servAmt = Math.round(((gross * servRate) / 100) * 100) / 100;
        vatAmt = Math.round((((gross + servAmt) * vatRate) / 100) * 100) / 100;
        vatableAmt = gross;
      }
    } else {
      nonVatAmt = gross;
    }

    const { data: insertData, error: insertError } = await supabase
      .from("folio_items")
      .insert({
        folio_id: parsed.data.folio_id,
        tran_code: parsed.data.tran_code,
        description: parsed.data.description,
        amount: gross,
        org_amount: gross,
        item_date: parsed.data.item_date,
        quantity: parsed.data.quantity,
        unit_price: parsed.data.amount,
        folio_group_id: parsed.data.folio_group_id ?? null,
        vat_type: tcData.vat_type,
        vat_rate: vatRate,
        vat_amount: vatAmt,
        service_rate: servRate,
        service_amount: servAmt,
        vatable_amount: vatableAmt,
        non_vat_amount: nonVatAmt,
        reference: parsed.data.reference ?? "",
        remark: parsed.data.remark ?? "",
        shift_code: "",
        posted_by: userId,
        is_voided: false,
        payf: "I",
      })
      .select("id")
      .single();

    if (insertError) return { success: false, error: insertError.message };

    // Manually recalculate totals
    await recalculateFolioTotal(parsed.data.folio_id);

    revalidatePath("/dashboard/cashier");
    return { success: true, data: { item_id: insertData.id } };
  }

  await recalculateFolioTotal(parsed.data.folio_id);
  revalidatePath("/dashboard/cashier");
  return { success: true, data: { item_id: data } };
}

// ─────────────────────────────────────────────
// 6. RECEIVE PAYMENT
//    (ReceivePayment — stores to folio_payments)
// ─────────────────────────────────────────────
export async function receiveFolioPayment(
  formData: unknown,
): Promise<ActionResponse<{ payment_id: string }>> {
  const parsed = receivePaymentSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Check folio lock
  const { data: folio } = await supabase
    .from("folios")
    .select("is_locked, status")
    .eq("id", parsed.data.folio_id)
    .single();

  if (!folio) return { success: false, error: "Folio not found" };
  if (folio.is_locked) return { success: false, error: "Folio is locked." };
  if (folio.status !== "open")
    return { success: false, error: "Folio is not open." };

  // Call RPC or fallback insert
  const { data, error } = await supabase.rpc("rpc_receive_folio_payment", {
    p_folio_id: parsed.data.folio_id,
    p_tran_code: parsed.data.tran_code,
    p_payment_method: parsed.data.payment_method,
    p_amount: parsed.data.amount,
    p_reference: parsed.data.reference_number ?? "",
    p_notes: parsed.data.notes ?? "",
    p_pay_remark1: parsed.data.pay_remark1 ?? "",
    p_pay_remark2: parsed.data.pay_remark2 ?? "",
    p_pay_remark3: parsed.data.pay_remark3 ?? "",
    p_card_type: parsed.data.card_type ?? "",
    p_card_last4: parsed.data.card_number_last4 ?? "",
    p_approval_code: parsed.data.approval_code ?? "",
    p_shift_code: "",
    p_user_id: userId,
  });

  if (error) {
    // Fallback direct insert
    const { data: insertData, error: insertError } = await supabase
      .from("folio_payments")
      .insert({
        folio_id: parsed.data.folio_id,
        tran_code: parsed.data.tran_code,
        payment_method: parsed.data.payment_method,
        amount: parsed.data.amount,
        reference_number: parsed.data.reference_number ?? "",
        notes: parsed.data.notes ?? "",
        pay_remark1: parsed.data.pay_remark1 ?? "",
        pay_remark2: parsed.data.pay_remark2 ?? "",
        pay_remark3: parsed.data.pay_remark3 ?? "",
        card_type: parsed.data.card_type ?? "",
        card_number_last4: parsed.data.card_number_last4 ?? "",
        approval_code: parsed.data.approval_code ?? "",
        shift_code: "",
        created_by: userId,
        is_voided: false,
      })
      .select("id")
      .single();

    if (insertError) return { success: false, error: insertError.message };

    await recalculateFolioTotal(parsed.data.folio_id);
    revalidatePath("/dashboard/cashier");
    return { success: true, data: { payment_id: insertData.id } };
  }

  await recalculateFolioTotal(parsed.data.folio_id);
  revalidatePath("/dashboard/cashier");
  return { success: true, data: { payment_id: data } };
}

// ─────────────────────────────────────────────
// 7. VOID FOLIO ITEM
//    (sets PAYF='W', voidstatus='Y')
// ─────────────────────────────────────────────
export async function voidFolioItem(
  itemId: string,
  reason: string,
): Promise<ActionResponse> {
  if (!reason.trim())
    return { success: false, error: "Void reason is required" };

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Get item to check folio lock
  const { data: item } = await supabase
    .from("folio_items")
    .select("folio_id, is_voided, payf")
    .eq("id", itemId)
    .single();

  if (!item) return { success: false, error: "Item not found" };
  if (item.is_voided || item.payf === "W")
    return { success: false, error: "Item is already voided" };
  if (item.payf === "P")
    return { success: false, error: "Cannot void a settled item" };

  const { data: folio } = await supabase
    .from("folios")
    .select("is_locked")
    .eq("id", item.folio_id)
    .single();

  if (folio?.is_locked) return { success: false, error: "Folio is locked." };

  // Try RPC first
  const { error: rpcError } = await supabase.rpc("rpc_void_folio_item", {
    p_item_id: itemId,
    p_reason: reason,
    p_user_id: userId,
  });

  if (rpcError) {
    // Fallback direct update
    const { error: updateError } = await supabase
      .from("folio_items")
      .update({
        is_voided: true,
        payf: "W",
        void_reason: reason,
        voided_at: new Date().toISOString(),
        voided_by: userId,
      })
      .eq("id", itemId);

    if (updateError) return { success: false, error: updateError.message };
  }

  await recalculateFolioTotal(item.folio_id);
  revalidatePath("/dashboard/cashier");
  return { success: true };
}

// ─────────────────────────────────────────────
// 8. ISSUE CREDIT NOTE
//    (DoCorrectPymt — reverses a transaction,
//           sets original payf='C', inserts negative copy)
// ─────────────────────────────────────────────
export async function issueCreditNote(
  originalItemId: string,
  reason: string,
): Promise<ActionResponse<{ credit_item_id: string }>> {
  if (!reason.trim())
    return { success: false, error: "Credit note reason is required" };

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data: item } = await supabase
    .from("folio_items")
    .select("*, folio:folios(is_locked)")
    .eq("id", originalItemId)
    .single();

  if (!item) return { success: false, error: "Item not found" };
  if ((item.folio as any)?.is_locked)
    return { success: false, error: "Folio is locked." };
  if (item.payf === "C")
    return {
      success: false,
      error: "Credit note already issued for this item",
    };
  if (item.is_voided || item.payf === "W")
    return { success: false, error: "Cannot credit note a voided item" };

  // Try RPC
  const { data: crId, error: rpcError } = await supabase.rpc(
    "rpc_issue_credit_note",
    {
      p_original_item_id: originalItemId,
      p_reason: reason,
      p_user_id: userId,
      p_shift_code: "",
    },
  );

  if (rpcError) {
    // Fallback: manual reversal
    const { data: maxCr } = await supabase
      .from("folio_items")
      .select("credit_note_no")
      .order("credit_note_no", { ascending: false })
      .limit(1)
      .single();

    const crNo = (maxCr?.credit_note_no ?? 0) + 1;

    // Mark original as C
    await supabase
      .from("folio_items")
      .update({ payf: "C", credit_note_no: crNo })
      .eq("id", originalItemId);

    // Insert reversal
    const { data: newItem, error: insertError } = await supabase
      .from("folio_items")
      .insert({
        folio_id: item.folio_id,
        tran_code: item.tran_code,
        description: `CR.${crNo} ${item.description}`,
        amount: item.amount * -1,
        org_amount: item.org_amount * -1,
        item_date: new Date().toISOString().split("T")[0],
        quantity: item.quantity,
        unit_price: item.unit_price,
        folio_group_id: item.folio_group_id,
        vat_type: item.vat_type,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount * -1,
        service_rate: item.service_rate,
        service_amount: item.service_amount * -1,
        vatable_amount: item.vatable_amount * -1,
        non_vat_amount: item.non_vat_amount * -1,
        reference: reason,
        remark: reason,
        shift_code: "",
        posted_by: userId,
        credit_note_no: crNo,
        credit_note_ref: item.credit_note_no,
        is_voided: false,
        payf: "C",
      })
      .select("id")
      .single();

    if (insertError) return { success: false, error: insertError.message };

    await recalculateFolioTotal(item.folio_id);
    revalidatePath("/dashboard/cashier");
    return { success: true, data: { credit_item_id: newItem.id } };
  }

  await recalculateFolioTotal(item.folio_id);
  revalidatePath("/dashboard/cashier");
  return { success: true, data: { credit_item_id: crId } };
}

// ─────────────────────────────────────────────
// 9. TRANSFER ITEMS BETWEEN FOLIOS
//    (MoveFolioTransTo — move charges across folios)
// ─────────────────────────────────────────────
export async function transferFolioItems(
  itemIds: string[],
  targetFolioId: string,
): Promise<ActionResponse<{ moved: number }>> {
  if (itemIds.length === 0)
    return { success: false, error: "No items selected" };
  if (!targetFolioId)
    return { success: false, error: "Target folio is required" };

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Try RPC
  const { data: moved, error: rpcError } = await supabase.rpc(
    "rpc_transfer_folio_items",
    {
      p_item_ids: itemIds,
      p_target_folio_id: targetFolioId,
      p_user_id: userId,
    },
  );

  if (rpcError) {
    // Fallback: manual update
    const { data: items } = await supabase
      .from("folio_items")
      .select("id, folio_id")
      .in("id", itemIds)
      .eq("is_voided", false);

    if (!items || items.length === 0)
      return { success: false, error: "No transferable items found" };

    const sourceFolioIds = [...new Set(items.map((i: any) => i.folio_id))];

    const { error: updateError } = await supabase
      .from("folio_items")
      .update({ folio_id: targetFolioId })
      .in("id", itemIds)
      .eq("is_voided", false);

    if (updateError) return { success: false, error: updateError.message };

    // Recalc both source and target
    for (const srcId of sourceFolioIds) {
      if (srcId !== targetFolioId) await recalculateFolioTotal(srcId);
    }
    await recalculateFolioTotal(targetFolioId);

    revalidatePath("/dashboard/cashier");
    return { success: true, data: { moved: items.length } };
  }

  // Recalc target
  await recalculateFolioTotal(targetFolioId);
  revalidatePath("/dashboard/cashier");
  return { success: true, data: { moved: moved ?? 0 } };
}

// ─────────────────────────────────────────────
// 10. LOCK / UNLOCK FOLIO
//     (Block/Unblock folio)
// ─────────────────────────────────────────────
export async function setFolioLock(
  folioId: string,
  lock: boolean,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Try RPC
  const { error: rpcError } = await supabase.rpc("rpc_lock_folio", {
    p_folio_id: folioId,
    p_lock: lock,
    p_user_id: userId,
  });

  if (rpcError) {
    // Fallback
    const { error } = await supabase
      .from("folios")
      .update({
        is_locked: lock,
        locked_by: lock ? userId : null,
        locked_at: lock ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", folioId);

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/cashier");
  return { success: true };
}

// ─────────────────────────────────────────────
// 11. BILLING ADDRESS — GET & SAVE
//     (Billaddress.pas — ที่อยู่ใบกำกับภาษี)
// ─────────────────────────────────────────────
export async function getBillingAddress(
  reservationId: string,
): Promise<ActionResponse<BillingAddress | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_addresses")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as BillingAddress | null };
}

export async function saveBillingAddress(
  formData: unknown,
): Promise<ActionResponse<BillingAddress>> {
  const parsed = billingAddressSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Check if existing address to update or insert
  const { data: existing } = await supabase
    .from("billing_addresses")
    .select("id")
    .eq("reservation_id", parsed.data.reservation_id)
    .limit(1)
    .maybeSingle();

  let result;
  if (existing?.id) {
    const { data, error } = await supabase
      .from("billing_addresses")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    result = data;
  } else {
    const { data, error } = await supabase
      .from("billing_addresses")
      .insert({ ...parsed.data, created_by: userId })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    result = data;
  }

  revalidatePath("/dashboard/cashier");
  return { success: true, data: result as BillingAddress };
}

// ─────────────────────────────────────────────
// 12. FOLIO SETUP (Billing Instructions)
//     (foliosetupmaster + foliosetupdetail)
// ─────────────────────────────────────────────
export async function getFolioSetup(
  reservationId: string,
): Promise<ActionResponse<FolioSetup[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folio_setup")
    .select(
      "*, tran_code_info:revenue_transaction_codes(code, description, vat_type)",
    )
    .eq("reservation_id", reservationId)
    .order("folio_seq", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as unknown as FolioSetup[] };
}

export async function saveFolioSetupItem(
  reservationId: string,
  tranCode: string,
  folioSeq: number,
  limitAmount = 0,
  untilDate: string | null = null,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase.from("folio_setup").upsert(
    {
      reservation_id: reservationId,
      tran_code: tranCode,
      folio_seq: folioSeq,
      limit_amount: limitAmount,
      until_date: untilDate,
      created_by: userId,
    },
    { onConflict: "reservation_id,tran_code" },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteFolioSetupItem(
  setupId: string,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("folio_setup")
    .delete()
    .eq("id", setupId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─────────────────────────────────────────────
// 13. TAX INVOICE — Issue & Get
//     (Tax Invoice / ใบกำกับภาษี)
// ─────────────────────────────────────────────
export async function issueTaxInvoice(
  folioId: string,
  billingAddressId?: string,
): Promise<ActionResponse<TaxInvoice>> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Get folio totals
  const { data: folio } = await supabase
    .from("folios")
    .select(
      "*, reservation:reservations(id), billing_address:billing_addresses(*)",
    )
    .eq("id", folioId)
    .single();

  if (!folio) return { success: false, error: "Folio not found" };

  const ba = billingAddressId
    ? (
        await supabase
          .from("billing_addresses")
          .select("*")
          .eq("id", billingAddressId)
          .single()
      ).data
    : (folio as any).billing_address;

  const { data, error } = await supabase
    .from("tax_invoices")
    .insert({
      folio_id: folioId,
      reservation_id: (folio as any).reservation?.id ?? null,
      issue_date: new Date().toISOString().split("T")[0],
      company_name: ba?.company_name ?? "",
      tax_id: ba?.tax_id ?? "",
      address: [ba?.address_line1, ba?.address_line2, ba?.city, ba?.country]
        .filter(Boolean)
        .join(", "),
      subtotal:
        (folio as any).total_amount -
        (folio as any).tax_amount -
        (folio as any).service_charge,
      vat_amount: (folio as any).tax_amount,
      service_charge: (folio as any).service_charge,
      total_amount: (folio as any).total_amount,
      is_credit_note: false,
      issued_by: userId,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/cashier");
  return { success: true, data: data as TaxInvoice };
}

export async function getTaxInvoices(
  folioId: string,
): Promise<ActionResponse<TaxInvoice[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_invoices")
    .select("*")
    .eq("folio_id", folioId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as TaxInvoice[] };
}

// ─────────────────────────────────────────────
// 14. VOID FOLIO PAYMENT
// ─────────────────────────────────────────────
export async function voidFolioPayment(
  paymentId: string,
  reason: string,
): Promise<ActionResponse> {
  if (!reason.trim())
    return { success: false, error: "Void reason is required" };

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data: payment } = await supabase
    .from("folio_payments")
    .select("folio_id, is_voided")
    .eq("id", paymentId)
    .single();

  if (!payment) return { success: false, error: "Payment not found" };
  if (payment.is_voided)
    return { success: false, error: "Payment is already voided" };

  const { error } = await supabase
    .from("folio_payments")
    .update({
      is_voided: true,
      void_reason: reason,
      voided_at: new Date().toISOString(),
      voided_by: userId,
    })
    .eq("id", paymentId);

  if (error) return { success: false, error: error.message };

  await recalculateFolioTotal(payment.folio_id);
  revalidatePath("/dashboard/cashier");
  return { success: true };
}

// ─────────────────────────────────────────────
// 15. HELPER: Recalculate folio totals
//     Sums folio_items (non-voided) and folio_payments
// ─────────────────────────────────────────────
async function recalculateFolioTotal(folioId: string): Promise<void> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("folio_items")
    .select("amount, vat_amount, service_amount")
    .eq("folio_id", folioId)
    .eq("is_voided", false)
    .not("payf", "eq", "W");

  const { data: payments } = await supabase
    .from("folio_payments")
    .select("amount")
    .eq("folio_id", folioId)
    .eq("is_voided", false);

  const totalCharges = (items ?? []).reduce(
    (s: number, i: any) => s + Number(i.amount),
    0,
  );
  const totalVat = (items ?? []).reduce(
    (s: number, i: any) => s + Number(i.vat_amount ?? 0),
    0,
  );
  const totalSC = (items ?? []).reduce(
    (s: number, i: any) => s + Number(i.service_amount ?? 0),
    0,
  );
  const totalPaid = (payments ?? []).reduce(
    (s: number, p: any) => s + Number(p.amount),
    0,
  );

  await supabase
    .from("folios")
    .update({
      total_amount: Math.round(totalCharges * 100) / 100,
      tax_amount: Math.round(totalVat * 100) / 100,
      service_charge: Math.round(totalSC * 100) / 100,
      paid_amount: Math.round(totalPaid * 100) / 100,
      balance: Math.round((totalCharges - totalPaid) * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folioId);
}

// ─────────────────────────────────────────────
// 16. PAYMENT CODE CONSTANTS
// Moved to @/lib/constants/payment-methods — import from there.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Legacy compatibility exports (kept for other pages)
// ─────────────────────────────────────────────
export async function getFolio(reservationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folios")
    .select(FOLIO_SELECT)
    .eq("reservation_id", reservationId)
    .eq("folio_seq", 1)
    .limit(1)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function postTransaction(formData: unknown) {
  return postFolioTransaction(formData);
}

// ─────────────────────────────────────────────
// 17. CHECKOUT FROM CASHIER
//    (doCompleteChkOut — validates zero balance,
//          updates reservation status, handles share guests)
// ─────────────────────────────────────────────
export async function checkoutReservation(
  reservationId: string,
  forceCheckout = false,
): Promise<ActionResponse<{ checkout_completed: boolean }>> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Get all folios for this reservation
  const { data: folios, error: folioError } = await supabase
    .from("folios")
    .select(
      "id, folio_seq, balance, is_locked, status, reservation:reservations(id, status, check_out_date)",
    )
    .eq("reservation_id", reservationId)
    .is("deleted_at", null);

  if (folioError) return { success: false, error: folioError.message };
  if (!folios || folios.length === 0)
    return { success: false, error: "No folios found for this reservation" };

  // Check for locked folios
  const lockedFolios = folios.filter((f: any) => f.is_locked);
  if (lockedFolios.length > 0) {
    return {
      success: false,
      error: `Cannot checkout: Folio(s) ${lockedFolios.map((f: any) => f.folio_seq).join(", ")} are locked`,
    };
  }

  // Check for non-zero balances (unless forceCheckout)
  if (!forceCheckout) {
    const nonZeroFolios = folios.filter(
      (f: any) => Math.abs(Number(f.balance || 0)) > 0.01,
    );
    if (nonZeroFolios.length > 0) {
      return {
        success: false,
        error: `Cannot checkout: Folio(s) ${nonZeroFolios.map((f: any) => f.folio_seq).join(", ")} have non-zero balance. Please settle or use force checkout.`,
      };
    }
  }

  // Update all folios to closed status
  const folioIds = folios.map((f: any) => f.id);
  const { error: updateFolioError } = await supabase
    .from("folios")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: userId,
      updated_at: new Date().toISOString(),
    })
    .in("id", folioIds);

  if (updateFolioError)
    return { success: false, error: updateFolioError.message };

  // Update reservation status to checked_out
  const { error: updateResError } = await supabase
    .from("reservations")
    .update({
      status: "checked_out",
      actual_check_out: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId);

  if (updateResError) return { success: false, error: updateResError.message };

  // Update room status to available
  const { data: reservation } = await supabase
    .from("reservations")
    .select("room_id")
    .eq("id", reservationId)
    .single();

  if (reservation?.room_id) {
    await supabase
      .from("rooms")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .eq("id", reservation.room_id);
  }

  revalidatePath("/dashboard/cashier");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/room-chart");
  return { success: true, data: { checkout_completed: true } };
}

// ─────────────────────────────────────────────
// 18. SPLIT TRANSACTION
//    (SplitInto — split a charge into partial amounts)
// ─────────────────────────────────────────────
export async function splitFolioItem(
  itemId: string,
  splitAmounts: { amount: number; targetFolioId?: string }[],
  reason: string,
): Promise<ActionResponse<{ split_items: string[] }>> {
  if (!reason.trim())
    return { success: false, error: "Split reason is required" };
  if (splitAmounts.length === 0)
    return { success: false, error: "At least one split amount is required" };

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Get original item
  const { data: item, error: itemError } = await supabase
    .from("folio_items")
    .select("*, folio:folios(is_locked, reservation_id)")
    .eq("id", itemId)
    .single();

  if (itemError) return { success: false, error: itemError.message };
  if (!item) return { success: false, error: "Item not found" };
  if ((item.folio as any)?.is_locked)
    return { success: false, error: "Source folio is locked" };
  if (item.payf === "P" || item.payf === "W" || item.is_voided)
    return { success: false, error: "Cannot split a voided or settled item" };

  const totalSplit = splitAmounts.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(totalSplit - Number(item.amount)) > 0.01) {
    return {
      success: false,
      error: `Split amounts (${totalSplit}) must equal original amount (${item.amount})`,
    };
  }

  const splitItemIds: string[] = [];

  // Get next split reference number
  const { data: maxSplit } = await supabase
    .from("folio_items")
    .select("reference")
    .ilike("reference", "SPLIT%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let splitNum = 1;
  if (maxSplit?.reference) {
    const match = maxSplit.reference.match(/SPLIT-(\d+)/);
    if (match) splitNum = parseInt(match[1]) + 1;
  }
  const splitRef = `SPLIT-${splitNum}`;

  // Update original item with first split amount
  const firstSplit = splitAmounts[0];
  const { error: updateOriginalError } = await supabase
    .from("folio_items")
    .update({
      amount: firstSplit.amount,
      reference: `${splitRef}-1/${splitAmounts.length}`,
      remark: `${reason} (Split ${splitRef})`,
    })
    .eq("id", itemId);

  if (updateOriginalError)
    return { success: false, error: updateOriginalError.message };

  splitItemIds.push(itemId);

  // Create additional split items
  for (let i = 1; i < splitAmounts.length; i++) {
    const split = splitAmounts[i];
    const targetFolioId = split.targetFolioId || item.folio_id;

    const { data: newItem, error: insertError } = await supabase
      .from("folio_items")
      .insert({
        folio_id: targetFolioId,
        tran_code: item.tran_code,
        description: item.description,
        amount: split.amount,
        org_amount: item.org_amount,
        item_date: item.item_date,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_type: item.vat_type,
        vat_rate: item.vat_rate,
        vat_amount:
          Math.round(
            (split.amount / Number(item.amount)) *
              Number(item.vat_amount) *
              100,
          ) / 100,
        service_rate: item.service_rate,
        service_amount:
          Math.round(
            (split.amount / Number(item.amount)) *
              Number(item.service_amount || 0) *
              100,
          ) / 100,
        vatable_amount: item.vat_type === "V" ? split.amount : 0,
        non_vat_amount: item.vat_type !== "V" ? split.amount : 0,
        reference: `${splitRef}-${i + 1}/${splitAmounts.length}`,
        remark: `${reason} (Split ${splitRef})`,
        shift_code: "",
        posted_by: userId,
        is_voided: false,
        payf: "I",
      })
      .select("id")
      .single();

    if (insertError) return { success: false, error: insertError.message };
    if (newItem) splitItemIds.push(newItem.id);
  }

  // Recalculate folio totals for affected folios
  const affectedFolioIds = [
    ...new Set([
      item.folio_id,
      ...splitAmounts.map((s) => s.targetFolioId).filter(Boolean),
    ]),
  ];
  for (const folioId of affectedFolioIds) {
    await recalculateFolioTotal(folioId);
  }

  revalidatePath("/dashboard/cashier");
  return { success: true, data: { split_items: splitItemIds } };
}

export async function receivePayment(formData: unknown) {
  return receiveFolioPayment(formData);
}

export async function voidTransaction(itemId: string, reason: string) {
  return voidFolioItem(itemId, reason);
}

// ─────────────────────────────────────────────
// POST CORRECTION ITEM
// Postcorrectionofthisrecord1 — posts an offsetting (negative) entry
// to reverse a charge without fully voiding it (leaves audit trail)
// ─────────────────────────────────────────────
export async function postCorrectionItem(
  originalItemId: string,
  reason: string,
): Promise<ActionResponse<{ correction_item_id: string }>> {
  if (!reason.trim()) return { success: false, error: "Reason is required" };

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Fetch original item
  const { data: item, error: itemErr } = await supabase
    .from("folio_items")
    .select("*")
    .eq("id", originalItemId)
    .single();

  if (itemErr || !item) return { success: false, error: "Item not found" };
  if (item.is_voided)
    return { success: false, error: "Item is already voided" };
  if (item.payf === "W")
    return { success: false, error: "Item is already cancelled" };

  // Get shift
  const { data: shiftRow } = await supabase
    .from("audit_shifts")
    .select("shift_code")
    .eq("is_current", true)
    .maybeSingle();
  const shiftCode = shiftRow?.shift_code ?? "";

  // Insert offsetting (negative) item
  const { data: corrItem, error: insertErr } = await supabase
    .from("folio_items")
    .insert({
      folio_id: item.folio_id,
      tran_code: item.tran_code,
      description: `CORRECTION: ${item.description}`,
      amount: -Math.abs(Number(item.amount)),
      org_amount: -Math.abs(Number(item.org_amount)),
      item_date: new Date().toISOString().split("T")[0],
      quantity: item.quantity,
      unit_price: -Math.abs(Number(item.unit_price ?? 0)),
      vat_type: item.vat_type,
      vat_rate: item.vat_rate,
      vat_amount: -Math.abs(Number(item.vat_amount ?? 0)),
      service_rate: item.service_rate,
      service_amount: -Math.abs(Number(item.service_amount ?? 0)),
      vatable_amount: -Math.abs(Number(item.vatable_amount ?? 0)),
      non_vat_amount: -Math.abs(Number(item.non_vat_amount ?? 0)),
      reference: `CORR-${originalItemId.slice(0, 8)}`,
      remark: reason,
      shift_code: shiftCode,
      posted_by: userId,
      is_voided: false,
      payf: "C", // PAYF='C' = correction/credit
    })
    .select("id")
    .single();

  if (insertErr || !corrItem) {
    return { success: false, error: insertErr?.message ?? "Insert failed" };
  }

  // Mark original item payf = 'C' (corrected)
  await supabase
    .from("folio_items")
    .update({ payf: "C", remark: reason })
    .eq("id", originalItemId);

  await recalculateFolioTotal(item.folio_id);
  revalidatePath("/dashboard/cashier");
  return { success: true, data: { correction_item_id: corrItem.id } };
}

// ─────────────────────────────────────────────
// UPDATE FOLIO REMARK
// Remark per folio (btnExpandremark / btnComment)
// ─────────────────────────────────────────────
export async function updateFolioRemark(
  folioId: string,
  remark: string,
): Promise<ActionResponse<null>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("folios")
    .update({ remark, updated_at: new Date().toISOString() })
    .eq("id", folioId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/cashier");
  return { success: true, data: null };
}

// ─────────────────────────────────────────────
// RECEIVE PAYMENT FOR SELECTED ITEMS
// btnSelectedPay — pays only checked/selected folio items
// Creates a payment entry and marks those items as paid
// payf: 'P' = Paid with Tax Invoice, 'C' = Paid Cash (no tax invoice)
// payment_type: 'PA' = Pay All, 'PT' = Partial, 'PR' = Refund
// ─────────────────────────────────────────────
export async function receivePaymentForItems(
  itemIds: string[],
  paymentData: {
    tran_code: string;
    payment_method: string;
    reference_number?: string;
    notes?: string;
    pay_remark1?: string;
    pay_remark2?: string;
    pay_remark3?: string;
    card_type?: string;
    card_number_last4?: string;
    approval_code?: string;
    payf?: 'P' | 'C';
    payment_type?: 'PA' | 'PT' | 'PR';
    amount?: number;
  },
): Promise<ActionResponse<{ payment_id: string }>> {
  if (itemIds.length === 0)
    return { success: false, error: "No items selected" };

  const supabase = await createClient();
  const userId = await getCurrentUserId();

  // Fetch items to get folio_id and sum amount
  const { data: items, error: itemsErr } = await supabase
    .from("folio_items")
    .select("id, folio_id, amount, is_voided, payf")
    .in("id", itemIds);

  if (itemsErr || !items)
    return { success: false, error: "Could not fetch items" };

  const unpaidItems = items.filter(
    (i: any) => !i.is_voided && i.payf !== "P" && i.payf !== "W",
  );
  if (unpaidItems.length === 0)
    return { success: false, error: "No unpaid items in selection" };

  const folioId = unpaidItems[0].folio_id;
  
  // Use provided amount or calculate from items
  const totalAmt = paymentData.amount ?? unpaidItems.reduce(
    (s: number, i: any) => s + Number(i.amount),
    0,
  );

  // Determine PAYF value: P = Tax Invoice, C = Cash
  const payfValue = paymentData.payf ?? 'P';
  
  // For refunds, amount should be negative (money going back)
  const isRefund = paymentData.payment_type === 'PR';
  const finalAmount = isRefund ? -Math.abs(totalAmt) : totalAmt;

  const { data: shiftRow } = await supabase
    .from("audit_shifts")
    .select("shift_code")
    .eq("is_current", true)
    .maybeSingle();
  const shiftCode = shiftRow?.shift_code ?? "";

  // Check folio lock
  const { data: folio } = await supabase
    .from("folios")
    .select("is_locked, status")
    .eq("id", folioId)
    .single();

  if (!folio) return { success: false, error: "Folio not found" };
  if (folio.is_locked) return { success: false, error: "Folio is locked." };
  if (folio.status !== "open") return { success: false, error: "Folio is not open." };

  // Insert payment record
  const { data: pymt, error: pymtErr } = await supabase
    .from("folio_payments")
    .insert({
      folio_id: folioId,
      tran_code: paymentData.tran_code,
      payment_method: paymentData.payment_method,
      amount: finalAmount,
      reference_number: paymentData.reference_number ?? "",
      notes: paymentData.notes ?? "",
      pay_remark1: paymentData.pay_remark1 ?? "",
      pay_remark2: paymentData.pay_remark2 ?? "",
      pay_remark3: paymentData.pay_remark3 ?? "",
      card_type: paymentData.card_type ?? "",
      card_number_last4: paymentData.card_number_last4 ?? "",
      approval_code: paymentData.approval_code ?? "",
      shift_code: shiftCode,
      created_by: userId,
      is_voided: false,
    })
    .select("id")
    .single();

  if (pymtErr || !pymt)
    return {
      success: false,
      error: pymtErr?.message ?? "Payment insert failed",
    };

  // Mark selected items as paid with appropriate PAYF value
  await supabase
    .from("folio_items")
    .update({ payf: payfValue })
    .in(
      "id",
      unpaidItems.map((i: any) => i.id),
    );

  await recalculateFolioTotal(folioId);
  revalidatePath("/dashboard/cashier");
  return { success: true, data: { payment_id: pymt.id } };
}
