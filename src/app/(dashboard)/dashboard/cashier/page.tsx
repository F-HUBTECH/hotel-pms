"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getOpenFolios,
  getOrCreateReservationFolios,
  getTransactionCodes,
  getPaymentCodes,
  postFolioTransaction,
  receiveFolioPayment,
  receivePaymentForItems,
  voidFolioItem,
  voidFolioPayment,
  issueCreditNote,
  transferFolioItems,
  setFolioLock,
  getBillingAddress,
  saveBillingAddress,
  checkoutReservation,
  splitFolioItem,
  issueTaxInvoice,
  getTaxInvoices,
  getFolioSetup,
  saveFolioSetupItem,
  deleteFolioSetupItem,
  postCorrectionItem,
  updateFolioRemark,
} from "@/lib/actions/folios";
import { checkRight } from "@/lib/actions/user-rights";
import { FUNCTION_CODES } from "@/lib/constants/function-codes";
import { PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import type {
  Folio,
  FolioItem,
  FolioPayment,
  TaxInvoice,
  FolioSetup,
  RevenueTransactionCode,
  BillingAddress,
} from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  CreditCard,
  Trash2,
  ArrowRightLeft,
  Loader2,
  FileText,
  Lock,
  LockOpen,
  MapPin,
  RotateCcw,
  Printer,
  CheckSquare,
  Square,
  Receipt,
  Scissors,
  FileCheck,
  Settings2,
  Ban,
  X,
  User,
  BedDouble,
  Calendar,
  DollarSign,
  RefreshCw,
  LogOut,
  MessageSquare,
  Undo2,
  ListChecks,
  MoreVertical,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

// ─── Row color coding (KFO PAYF flag) ────────────────────────────────────────
function getRowStyle(payf: string, isVoided: boolean) {
  if (isVoided || payf === "W")
    return { bg: "bg-red-50 opacity-60", text: "text-red-400 line-through" };
  if (payf === "P") return { bg: "bg-blue-50", text: "text-blue-700" };
  if (payf === "C") return { bg: "bg-green-50", text: "text-green-700" };
  return { bg: "", text: "text-slate-800" };
}

function getPayfBadge(payf: string, isVoided: boolean) {
  if (isVoided || payf === "W")
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600">
        VOID
      </span>
    );
  if (payf === "P")
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600">
        PAID
      </span>
    );
  if (payf === "C")
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-600">
        CORR
      </span>
    );
  if (payf === "A")
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-600">
        ADV
      </span>
    );
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
      CHRG
    </span>
  );
}

const fmt = (n: number | undefined | null) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

const fmtDate = (s: string | undefined | null) => {
  if (!s) return "—";
  const d = new Date(s);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// ─── HTML Folio print builder ─────────────────────────────────────────────────
function buildFolioHtml(opts: {
  folio: Folio;
  guestName: string;
  roomNumber: string;
  reservationNumber: string;
  checkIn: string;
  checkOut: string;
  billingAddress?: BillingAddress | null;
  hotelName?: string;
}): string {
  const {
    folio,
    guestName,
    roomNumber,
    reservationNumber,
    checkIn,
    checkOut,
    billingAddress,
    hotelName = "Hotel",
  } = opts;
  const items = folio.items ?? [];
  const payments = folio.folio_payments ?? [];

  const totalCharges = items
    .filter((i) => !i.is_voided && i.payf !== "W")
    .reduce((s, i) => s + Number(i.amount), 0);
  const totalVat = items
    .filter((i) => !i.is_voided && i.payf !== "W")
    .reduce((s, i) => s + Number(i.vat_amount), 0);
  const totalSC = items
    .filter((i) => !i.is_voided && i.payf !== "W")
    .reduce((s, i) => s + Number(i.service_amount), 0);
  const totalPaid = payments
    .filter((p) => !p.is_voided)
    .reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalCharges - totalPaid;

  const rowsHtml = items
    .map(
      (i) =>
        `<tr style="color:${i.is_voided ? "#aaa" : "#222"};text-decoration:${i.is_voided ? "line-through" : "none"}">
          <td style="padding:2px 6px">${fmtDate(i.item_date)}</td>
          <td style="padding:2px 6px;font-family:monospace">${i.tran_code ?? ""}</td>
          <td style="padding:2px 6px">${i.description}${i.reference ? `<br/><small style="color:#888">Ref: ${i.reference}</small>` : ""}</td>
          <td style="padding:2px 6px;text-align:right">${fmt(i.amount)}</td>
          <td style="padding:2px 6px;text-align:right">${Number(i.vat_amount) > 0 ? fmt(i.vat_amount) : "-"}</td>
          <td style="padding:2px 6px;text-align:right">${Number(i.service_amount) > 0 ? fmt(i.service_amount) : "-"}</td>
        </tr>`,
    )
    .join("");

  const pymtRowsHtml = payments
    .filter((p) => !p.is_voided)
    .map(
      (p) =>
        `<tr style="color:#1d4ed8">
          <td style="padding:2px 6px">${fmtDate(p.created_at)}</td>
          <td style="padding:2px 6px;font-family:monospace">${p.tran_code ?? p.payment_method}</td>
          <td style="padding:2px 6px">${p.reference_number ? `Ref: ${p.reference_number}` : ""}</td>
          <td style="padding:2px 6px;text-align:right;font-weight:bold">(${fmt(p.amount)})</td>
          <td colspan="2"></td>
        </tr>`,
    )
    .join("");

  const billTo = billingAddress?.company_name
    ? `<strong>Bill To:</strong> ${billingAddress.company_name}<br/>
       ${billingAddress.attn_name ? `Attn: ${billingAddress.attn_name}<br/>` : ""}
       ${billingAddress.address_line1}<br/>
       ${billingAddress.city}${billingAddress.country ? `, ${billingAddress.country}` : ""}<br/>
       ${billingAddress.tax_id ? `Tax ID: ${billingAddress.tax_id}` : ""}`
    : `<strong>Guest:</strong> ${guestName}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Folio — ${guestName}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;padding:20px}
    h2{margin:0;font-size:18px}
    table{width:100%;border-collapse:collapse}
    th{background:#f1f5f9;padding:4px 6px;text-align:left;font-size:11px;border-bottom:2px solid #cbd5e1}
    th.r{text-align:right}
    .sum td{padding:2px 6px}
    .tot td{font-weight:bold;border-top:2px solid #111}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;margin-bottom:12px">
    <div>
      <h2>${hotelName}</h2>
      <div style="font-size:13px;margin-top:4px"><strong>FOLIO ${folio.folio_seq}</strong>${folio.folio_number ? ` — #${folio.folio_number}` : ""}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#555">
      Printed: ${new Date().toLocaleString("th-TH")}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="font-size:11px">
      ${billTo}
    </div>
    <div style="font-size:11px;text-align:right">
      <strong>Room:</strong> ${roomNumber}<br/>
      <strong>Res#:</strong> ${reservationNumber}<br/>
      <strong>Check-In:</strong> ${fmtDate(checkIn)}<br/>
      <strong>Check-Out:</strong> ${fmtDate(checkOut)}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Code</th><th>Description</th>
        <th class="r">Amount</th><th class="r">VAT</th><th class="r">S/C</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      ${pymtRowsHtml}
    </tbody>
    <tfoot>
      <tr class="sum"><td colspan="3" style="text-align:right">Charges:</td><td style="text-align:right">${fmt(totalCharges)}</td><td style="text-align:right">${fmt(totalVat)}</td><td style="text-align:right">${fmt(totalSC)}</td></tr>
      <tr class="sum"><td colspan="3" style="text-align:right;color:#1d4ed8">Total Paid:</td><td style="text-align:right;color:#1d4ed8">(${fmt(totalPaid)})</td><td colspan="2"></td></tr>
      <tr class="tot"><td colspan="3" style="text-align:right">BALANCE DUE:</td><td style="text-align:right;font-size:14px;color:${balance > 0.005 ? "#dc2626" : "#16a34a"}">${fmt(balance)}</td><td colspan="2"></td></tr>
    </tfoot>
  </table>
  <div style="margin-top:20px;font-size:10px;color:#888;text-align:center">Thank you for staying with us.</div>
</body>
</html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CashierPage() {
  // ── Guest list state ──────────────────────────────────────────────────────
  const [folios, setFolios] = useState<Folio[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDueOut, setFilterDueOut] = useState(false);
  const [filterCheckoutOnly, setFilterCheckoutOnly] = useState(false);

  // ── Selected reservation & 4 folios ──────────────────────────────────────
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [reservationFolios, setReservationFolios] = useState<(Folio | null)[]>([null, null, null, null]);
  const [activeFolioSeq, setActiveFolioSeq] = useState<1 | 2 | 3 | 4>(1);
  const [folioLoading, setFolioLoading] = useState(false);

  const activeFolio = reservationFolios[activeFolioSeq - 1];

  // ── Transaction & payment codes ───────────────────────────────────────────
  const [tranCodes, setTranCodes] = useState<RevenueTransactionCode[]>([]);
  const [paymentCodes, setPaymentCodes] = useState<RevenueTransactionCode[]>([]);

  // ── Item selection ────────────────────────────────────────────────────────
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // ── Billing address ───────────────────────────────────────────────────────
  const [billingAddress, setBillingAddress] = useState<BillingAddress | null>(null);

  // ─── Post Charge dialog ───────────────────────────────────────────────────
  const [postOpen, setPostOpen] = useState(false);
  const [postForm, setPostForm] = useState({
    tran_code: "",
    description: "",
    amount: 0,
    quantity: 1,
    item_date: new Date().toISOString().split("T")[0],
    reference: "",
    remark: "",
  });
  const [selectedTranCode, setSelectedTranCode] = useState<RevenueTransactionCode | null>(null);
  const [postLoading, setPostLoading] = useState(false);

  // ─── Payment dialog ───────────────────────────────────────────────────────
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    tran_code: "CASH",
    payment_method: "cash",
    amount: 0,
    reference_number: "",
    notes: "",
    pay_remark1: "",
    pay_remark2: "",
    pay_remark3: "",
    card_type: "",
    card_number_last4: "",
    approval_code: "",
  });
  const [payLoading, setPayLoading] = useState(false);

  // ─── Void charge dialog ───────────────────────────────────────────────────
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<FolioItem | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);

  // ─── Void payment dialog ──────────────────────────────────────────────────
  const [voidPayOpen, setVoidPayOpen] = useState(false);
  const [voidPayTarget, setVoidPayTarget] = useState<FolioPayment | null>(null);
  const [voidPayReason, setVoidPayReason] = useState("");
  const [voidPayLoading, setVoidPayLoading] = useState(false);

  // ─── Credit note dialog ───────────────────────────────────────────────────
  const [crNoteOpen, setCrNoteOpen] = useState(false);
  const [crNoteTarget, setCrNoteTarget] = useState<FolioItem | null>(null);
  const [crNoteReason, setCrNoteReason] = useState("");
  const [crNoteLoading, setCrNoteLoading] = useState(false);

  // ─── Post Correction dialog ───────────────────────────────────────────────
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrTarget, setCorrTarget] = useState<FolioItem | null>(null);
  const [corrReason, setCorrReason] = useState("");
  const [corrLoading, setCorrLoading] = useState(false);

  // ─── Transfer dialog ──────────────────────────────────────────────────────
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetFolioSeq, setTargetFolioSeq] = useState<string>("2");
  const [transferLoading, setTransferLoading] = useState(false);

  // ─── Billing address dialog ───────────────────────────────────────────────
  const [billAddrOpen, setBillAddrOpen] = useState(false);
  const [billAddrForm, setBillAddrForm] = useState({
    company_name: "",
    attn_name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    country: "Thailand",
    tax_id: "",
    phone: "",
    email: "",
    reference_no: "",
  });
  const [billAddrLoading, setBillAddrLoading] = useState(false);

  // ─── Checkout dialog ──────────────────────────────────────────────────────
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [forceCheckout, setForceCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // ─── Split transaction dialog ─────────────────────────────────────────────
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitTargetItem, setSplitTargetItem] = useState<FolioItem | null>(null);
  const [splitAmounts, setSplitAmounts] = useState<{ amount: number; targetFolioSeq: number }[]>([]);
  const [splitReason, setSplitReason] = useState("");
  const [splitLoading, setSplitLoading] = useState(false);

  // ─── Tax invoice dialog ───────────────────────────────────────────────────
  const [taxInvOpen, setTaxInvOpen] = useState(false);
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
  const [taxInvLoading, setTaxInvLoading] = useState(false);

  // ─── Bill setup dialog ────────────────────────────────────────────────────
  const [billSetupOpen, setBillSetupOpen] = useState(false);
  const [folioSetupItems, setFolioSetupItems] = useState<FolioSetup[]>([]);
  const [billSetupLoading, setBillSetupLoading] = useState(false);
  const [newSetupCode, setNewSetupCode] = useState("");
  const [newSetupFolio, setNewSetupFolio] = useState("1");
  const [newSetupLimit, setNewSetupLimit] = useState(0);
  const [newSetupUntil, setNewSetupUntil] = useState("");

  // ─── Advance payment dialog ───────────────────────────────────────────────
  const [advPayOpen, setAdvPayOpen] = useState(false);
  const [advPayForm, setAdvPayForm] = useState({
    tran_code: "DEPST",
    payment_method: "cash",
    amount: 0,
    reference_number: "",
    notes: "",
    pay_remark1: "",
    pay_remark2: "",
    pay_remark3: "",
    card_type: "",
    card_number_last4: "",
    approval_code: "",
  });
  const [advPayLoading, setAdvPayLoading] = useState(false);

  // ─── Pay selected items dialog ────────────────────────────────────────────
  const [selPayOpen, setSelPayOpen] = useState(false);
  const [selPayForm, setSelPayForm] = useState({
    tran_code: "CASH",
    payment_method: "cash",
    reference_number: "",
    notes: "",
    pay_remark1: "",
    pay_remark2: "",
    pay_remark3: "",
    card_type: "",
    card_number_last4: "",
    approval_code: "",
  });
  const [selPayLoading, setSelPayLoading] = useState(false);

  // ─── Folio remark dialog ──────────────────────────────────────────────────
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [remarkTarget, setRemarkTarget] = useState<FolioItem | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [remarkLoading, setRemarkLoading] = useState(false);

  // ─── Partial Payment dialog ──────────────────────────────────────────────
  const [partialPayOpen, setPartialPayOpen] = useState(false);
  const [partialPayAmount, setPartialPayAmount] = useState(0);
  const [partialPayLoading, setPartialPayLoading] = useState(false);

  // ─── Payment type: PA=Pay All, PT=Partial, PR=Refund ───────────────────
  const [paymentType, setPaymentType] = useState<'PA' | 'PT' | 'PR'>('PA');
  const [hasTaxInvoice, setHasTaxInvoice] = useState(true);

  // ─── Load guest list ──────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setListLoading(true);
    const result = await getOpenFolios(search, {
      dueOutToday: filterDueOut,
      checkoutOnly: filterCheckoutOnly,
    });
    if (result.success && Array.isArray(result.data)) {
      setFolios(result.data);
    } else {
      setFolios([]);
    }
    setListLoading(false);
  }, [search, filterDueOut, filterCheckoutOnly]);

  useEffect(() => {
    fetchList();
    getTransactionCodes(true, false).then((r) => {
      if (r.success && r.data) setTranCodes(r.data);
    });
    getPaymentCodes().then((r) => {
      if (r.success && r.data) setPaymentCodes(r.data);
    });
  }, [fetchList]);

  // ─── Select reservation ───────────────────────────────────────────────────
  const selectReservation = async (reservationId: string) => {
    if (selectedReservationId === reservationId) return;
    setSelectedReservationId(reservationId);
    setActiveFolioSeq(1);
    setSelectedItemIds([]);
    setFolioLoading(true);

    const result = await getOrCreateReservationFolios(reservationId);
    if (result.success && result.data) {
      const arr: (Folio | null)[] = [null, null, null, null];
      for (const f of result.data) {
        const seq = (f.folio_seq ?? 1) as 1 | 2 | 3 | 4;
        arr[seq - 1] = f;
      }
      setReservationFolios(arr);
    }

    const baResult = await getBillingAddress(reservationId);
    if (baResult.success) {
      setBillingAddress(baResult.data ?? null);
      if (baResult.data) {
        setBillAddrForm({
          company_name: baResult.data.company_name ?? "",
          attn_name: baResult.data.attn_name ?? "",
          address_line1: baResult.data.address_line1 ?? "",
          address_line2: baResult.data.address_line2 ?? "",
          city: baResult.data.city ?? "",
          country: baResult.data.country || "Thailand",
          tax_id: baResult.data.tax_id ?? "",
          phone: baResult.data.phone ?? "",
          email: baResult.data.email ?? "",
          reference_no: baResult.data.reference_no ?? "",
        });
      }
    }
    setFolioLoading(false);
  };

  // ─── Refresh folios ───────────────────────────────────────────────────────
  const refreshFolios = async () => {
    if (!selectedReservationId) return;
    const result = await getOrCreateReservationFolios(selectedReservationId);
    if (result.success && result.data) {
      const arr: (Folio | null)[] = [null, null, null, null];
      for (const f of result.data) {
        const seq = (f.folio_seq ?? 1) as 1 | 2 | 3 | 4;
        arr[seq - 1] = f;
      }
      setReservationFolios(arr);
    }
    await fetchList();
  };

  // ─── Tran code change → auto-fill description ─────────────────────────────
  const handleTranCodeChange = (code: string) => {
    const tc = tranCodes.find((t) => t.code === code) ?? null;
    setSelectedTranCode(tc);
    setPostForm((f) => ({
      ...f,
      tran_code: code,
      description: tc?.description ?? f.description,
    }));
  };

  // ─── Payment code → sync payment_method ──────────────────────────────────
  const syncPaymentMethod = <T extends { tran_code: string; payment_method: string }>(
    code: string,
    form: T,
    setForm: (f: T) => void,
  ) => {
    const pm = PAYMENT_METHODS.find(
      (m) =>
        m.value === code.toLowerCase() ||
        code.toLowerCase().includes(m.value.replace("_", "")),
    );
    setForm({ ...form, tran_code: code, payment_method: pm?.value ?? "cash" });
  };

  // ─── VAT preview ──────────────────────────────────────────────────────────
  const computedVat = (() => {
    if (!selectedTranCode || postForm.amount <= 0) return null;
    const tc = selectedTranCode;
    const gross = postForm.amount * postForm.quantity;
    if (tc.vat_type !== "V") return { vat: 0, sc: 0, gross };
    if (tc.vat_inclusive) {
      const vat = Math.round(((gross * tc.default_vat_rate) / (100 + tc.default_vat_rate)) * 100) / 100;
      const sc = Math.round(((gross * tc.default_serv_rate) / (100 + tc.default_vat_rate + tc.default_serv_rate)) * 100) / 100;
      return { vat, sc, gross };
    } else {
      const sc = Math.round(((gross * tc.default_serv_rate) / 100) * 100) / 100;
      const vat = Math.round((((gross + sc) * tc.default_vat_rate) / 100) * 100) / 100;
      return { vat, sc, gross };
    }
  })();

  // ─── Post charge ──────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!activeFolio) return;
    if (!postForm.tran_code) { toast.error("Please select a transaction code"); return; }
    if (postForm.amount <= 0) { toast.error("Amount must be greater than 0"); return; }
    setPostLoading(true);
    const result = await postFolioTransaction({ folio_id: activeFolio.id, ...postForm });
    setPostLoading(false);
    if (result.success) {
      toast.success("Transaction posted");
      setPostOpen(false);
      setPostForm({
        tran_code: "", description: "", amount: 0, quantity: 1,
        item_date: new Date().toISOString().split("T")[0], reference: "", remark: "",
      });
      setSelectedTranCode(null);
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to post transaction");
    }
  };

  // ─── Receive payment (Pay All) ────────────────────────────────────────────
  const handlePayment = async () => {
    if (!activeFolio) return;
    
    const balance = activeFolio.balance ?? 0;
    
    // For PA (Pay All), auto-fill the balance
    if (paymentType === 'PA') {
      setPayForm(f => ({ ...f, amount: Math.max(0, balance) }));
    }
    
    if (payForm.amount <= 0) { toast.error("Amount must be greater than 0"); return; }
    
    setPayLoading(true);
    
    // For refund (PR), amount is negative
    const isRefund = paymentType === 'PR';
    const finalAmount = isRefund ? -Math.abs(payForm.amount) : payForm.amount;
    
    // For Pay All: mark all unpaid items as paid with the appropriate PAYF value
    if (paymentType === 'PA' || paymentType === 'PR') {
      const unpaidItems = (activeFolio.items ?? []).filter(
        (i: any) => !i.is_voided && i.payf !== 'P' && i.payf !== 'W' && i.payf !== 'C'
      );
      
      if (unpaidItems.length > 0) {
        // Set PAYF on items: P = Tax Invoice, C = Cash
        const payfValue = hasTaxInvoice ? 'P' : 'C';
        
        // First record the payment
        const payResult = await receiveFolioPayment({
          folio_id: activeFolio.id,
          tran_code: payForm.tran_code,
          payment_method: payForm.payment_method,
          amount: finalAmount,
          reference_number: payForm.reference_number,
          notes: payForm.notes,
          pay_remark1: payForm.pay_remark1,
          pay_remark2: payForm.pay_remark2,
          pay_remark3: payForm.pay_remark3,
          card_type: payForm.card_type,
          card_number_last4: payForm.card_number_last4,
          approval_code: payForm.approval_code,
          payf: payfValue,
          payment_type: paymentType,
        });
        
        if (!payResult.success) {
          setPayLoading(false);
          toast.error(payResult.error || "Failed to record payment");
          return;
        }
        
        // Then mark all unpaid items as paid
        await receivePaymentForItems(
          unpaidItems.map((i: any) => i.id),
          {
            tran_code: payForm.tran_code,
            payment_method: payForm.payment_method,
            reference_number: payForm.reference_number,
            notes: payForm.notes,
            pay_remark1: payForm.pay_remark1,
            pay_remark2: payForm.pay_remark2,
            pay_remark3: payForm.pay_remark3,
            card_type: payForm.card_type,
            card_number_last4: payForm.card_number_last4,
            approval_code: payForm.approval_code,
            payf: payfValue,
            payment_type: paymentType,
          }
        );
      } else {
        // No unpaid items, just record the payment
        const payResult = await receiveFolioPayment({
          folio_id: activeFolio.id,
          tran_code: payForm.tran_code,
          payment_method: payForm.payment_method,
          amount: finalAmount,
          reference_number: payForm.reference_number,
          notes: payForm.notes,
          pay_remark1: payForm.pay_remark1,
          pay_remark2: payForm.pay_remark2,
          pay_remark3: payForm.pay_remark3,
          card_type: payForm.card_type,
          card_number_last4: payForm.card_number_last4,
          approval_code: payForm.approval_code,
          payf: 'P',
          payment_type: paymentType,
        });
        
        if (!payResult.success) {
          setPayLoading(false);
          toast.error(payResult.error || "Failed to record payment");
          return;
        }
      }
    }
    
    setPayLoading(false);
    toast.success(paymentType === 'PR' ? "Refund processed" : "Payment recorded");
    setPayOpen(false);
    setPayForm({
      tran_code: "CASH", payment_method: "cash", amount: 0,
      reference_number: "", notes: "", pay_remark1: "", pay_remark2: "", pay_remark3: "",
      card_type: "", card_number_last4: "", approval_code: "",
    });
    setPaymentType('PA');
    setHasTaxInvoice(true);
    await refreshFolios();
    
    // Auto-print receipt after payment (KFO: PreviewAndWriteBill)
    setTimeout(() => handlePrintFolio(), 500);
  };

  // ─── Partial Payment ─────────────────────────────────────────────────────
  const handlePartialPayment = async () => {
    if (!activeFolio) return;
    if (partialPayAmount <= 0) { toast.error("Amount must be greater than 0"); return; }
    
    setPartialPayLoading(true);
    
    // For partial payment, we don't mark items as paid - just record the payment
    const result = await receiveFolioPayment({
      folio_id: activeFolio.id,
      tran_code: payForm.tran_code,
      payment_method: payForm.payment_method,
      amount: partialPayAmount,
      reference_number: payForm.reference_number,
      notes: payForm.notes,
      pay_remark1: payForm.pay_remark1,
      pay_remark2: payForm.pay_remark2,
      pay_remark3: payForm.pay_remark3,
      card_type: payForm.card_type,
      card_number_last4: payForm.card_number_last4,
      approval_code: payForm.approval_code,
      payf: hasTaxInvoice ? 'P' : 'C',
      payment_type: 'PT',
    });
    
    setPartialPayLoading(false);
    if (result.success) {
      toast.success("Partial payment recorded");
      setPartialPayOpen(false);
      setPartialPayAmount(0);
      await refreshFolios();
      
      // Auto-print receipt after payment
      setTimeout(() => handlePrintFolio(), 500);
    } else {
      toast.error(result.error || "Failed to record partial payment");
    }
  };

  // ─── Advance payment ──────────────────────────────────────────────────────
  const handleAdvPay = async () => {
    if (!activeFolio) return;
    if (advPayForm.amount <= 0) { toast.error("Amount must be greater than 0"); return; }
    setAdvPayLoading(true);
    const result = await receiveFolioPayment({ folio_id: activeFolio.id, ...advPayForm });
    setAdvPayLoading(false);
    if (result.success) {
      toast.success("Advance payment recorded");
      setAdvPayOpen(false);
      setAdvPayForm({
        tran_code: "DEPST", payment_method: "cash", amount: 0,
        reference_number: "", notes: "", pay_remark1: "", pay_remark2: "", pay_remark3: "",
        card_type: "", card_number_last4: "", approval_code: "",
      });
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to record advance payment");
    }
  };

  // ─── Void charge ──────────────────────────────────────────────────────
  const handleVoid = async () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) { toast.error("Void reason is required"); return; }
    setVoidLoading(true);
    const result = await voidFolioItem(voidTarget.id, voidReason);
    setVoidLoading(false);
    if (result.success) {
      toast.success("Transaction voided");
      setVoidOpen(false);
      setVoidTarget(null);
      setVoidReason("");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to void transaction");
    }
  };

  // ─── Void payment ─────────────────────────────────────────────────────
  const handleVoidPay = async () => {
    if (!voidPayTarget) return;
    if (!voidPayReason.trim()) { toast.error("Void reason is required"); return; }
    setVoidPayLoading(true);
    const result = await voidFolioPayment(voidPayTarget.id, voidPayReason);
    setVoidPayLoading(false);
    if (result.success) {
      toast.success("Payment voided");
      setVoidPayOpen(false);
      setVoidPayTarget(null);
      setVoidPayReason("");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to void payment");
    }
  };

  // ─── Credit note ───────────────────────────────────────────────────────
  const handleCrNote = async () => {
    if (!crNoteTarget) return;
    setCrNoteLoading(true);
    const result = await issueCreditNote(crNoteTarget.id, crNoteReason);
    setCrNoteLoading(false);
    if (result.success) {
      toast.success("Credit note issued");
      setCrNoteOpen(false);
      setCrNoteTarget(null);
      setCrNoteReason("");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to issue credit note");
    }
  };

  // ─── Post correction ───────────────────────────────────────────────────
  const handleCorrection = async () => {
    if (!corrTarget) return;
    if (!corrReason.trim()) { toast.error("Correction reason is required"); return; }
    setCorrLoading(true);
    const result = await postCorrectionItem(corrTarget.id, corrReason);
    setCorrLoading(false);
    if (result.success) {
      toast.success("Correction posted");
      setCorrOpen(false);
      setCorrTarget(null);
      setCorrReason("");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to post correction");
    }
  };

  // ─── Transfer to another folio ──────────────────────────────────────────
  const handleTransfer = async () => {
    if (!activeFolio || selectedItemIds.length === 0) return;
    const targetFolio = reservationFolios[parseInt(targetFolioSeq) - 1];
    if (!targetFolio) { toast.error("Target folio not found"); return; }
    setTransferLoading(true);
    const result = await transferFolioItems(selectedItemIds, targetFolio.id);
    setTransferLoading(false);
    if (result.success) {
      toast.success(`Transferred ${result.data} items to Folio ${targetFolioSeq}`);
      setTransferOpen(false);
      setSelectedItemIds([]);
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to transfer items");
    }
  };

  // ─── Lock/Unlock folio ─────────────────────────────────────────────────
  const handleLockToggle = async (folioId: string, currentLocked: boolean) => {
    const result = await setFolioLock(folioId, !currentLocked);
    if (result.success) {
      toast.success(currentLocked ? "Folio unlocked" : "Folio locked");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to update folio lock");
    }
  };

  // ─── Save billing address ───────────────────────────────────────────────
  const handleSaveBillingAddr = async () => {
    if (!selectedReservationId) return;
    setBillAddrLoading(true);
    const result = await saveBillingAddress({ reservation_id: selectedReservationId, ...billAddrForm });
    setBillAddrLoading(false);
    if (result.success) {
      toast.success("Billing address saved");
      setBillAddrOpen(false);
      if (result.data) setBillingAddress(result.data);
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to save billing address");
    }
  };

  // ─── Checkout reservation ──────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!selectedReservationId) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    const result = await checkoutReservation(selectedReservationId, forceCheckout);
    setCheckoutLoading(false);
    if (result.success) {
      toast.success("Reservation checked out successfully");
      setCheckoutOpen(false);
      setForceCheckout(false);
      setSelectedReservationId(null);
      setReservationFolios([null, null, null, null]);
      await fetchList();
    } else {
      setCheckoutError(result.error || "Failed to checkout reservation");
      if (!forceCheckout) {
        setForceCheckout(true);
      }
    }
  };

  // ─── Split transaction ─────────────────────────────────────────────────────
  const handleSplit = async () => {
    if (!splitTargetItem) return;
    if (!splitReason.trim()) { toast.error("Split reason is required"); return; }
    setSplitLoading(true);
    const result = await splitFolioItem(splitTargetItem.id, splitAmounts, splitReason);
    setSplitLoading(false);
    if (result.success) {
      toast.success("Transaction split successfully");
      setSplitOpen(false);
      setSplitTargetItem(null);
      setSplitAmounts([]);
      setSplitReason("");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to split transaction");
    }
  };

  // ─── Issue tax invoice ───────────────────────────────────────────────────
  const handleIssueTaxInvoice = async () => {
    if (!activeFolio) return;
    setTaxInvLoading(true);
    const result = await issueTaxInvoice(activeFolio.id);
    setTaxInvLoading(false);
    if (result.success) {
      toast.success("Tax invoice issued");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to issue tax invoice");
    }
  };

  // ─── Load folio setup ────────────────────────────────────────────────────
  const loadFolioSetup = useCallback(async () => {
    if (!selectedReservationId) return;
    setBillSetupLoading(true);
    const result = await getFolioSetup(selectedReservationId);
    setBillSetupLoading(false);
    if (result.success && result.data) {
      setFolioSetupItems(result.data);
    } else {
      setFolioSetupItems([]);
    }
  }, [selectedReservationId]);

  // ─── Add folio setup item ────────────────────────────────────────────────
  const handleAddFolioSetup = async () => {
    if (!selectedReservationId || !newSetupCode) return;
    const result = await saveFolioSetupItem(
      selectedReservationId,
      newSetupCode,
      parseInt(newSetupFolio),
      newSetupLimit,
      newSetupUntil || null,
    );
    if (result.success) {
      toast.success("Folio setup added");
      setNewSetupCode("");
      setNewSetupFolio("1");
      setNewSetupLimit(0);
      setNewSetupUntil("");
      await loadFolioSetup();
    } else {
      toast.error(result.error || "Failed to add folio setup");
    }
  };

  // ─── Delete folio setup item ──────────────────────────────────────────────
  const handleDeleteFolioSetup = async (setupId: string) => {
    const result = await deleteFolioSetupItem(setupId);
    if (result.success) {
      toast.success("Folio setup deleted");
      await loadFolioSetup();
    } else {
      toast.error(result.error || "Failed to delete folio setup");
    }
  };

  // ─── Pay selected items ───────────────────────────────────────────────────
  const handlePaySelected = async () => {
    if (!activeFolio || selectedItemIds.length === 0) return;
    if (selPayForm.payment_method === "card" && !selPayForm.card_number_last4) {
      toast.error("Card number (last 4) is required");
      return;
    }
    setSelPayLoading(true);
    
    // Set PAYF based on Tax Invoice toggle: P = Tax Invoice, C = Cash
    const result = await receivePaymentForItems(selectedItemIds, {
      ...selPayForm,
      payf: hasTaxInvoice ? 'P' : 'C',
    });
    setSelPayLoading(false);
    if (result.success) {
      toast.success("Payment recorded for selected items");
      setSelPayOpen(false);
      setSelectedItemIds([]);
      await refreshFolios();
      
      // Auto-print receipt after payment
      setTimeout(() => handlePrintFolio(), 500);
    } else {
      toast.error(result.error || "Failed to record payment");
    }
  };

  // ─── Update folio remark ────────────────────────────────────────────────
  const handleUpdateRemark = async () => {
    if (!remarkTarget) return;
    setRemarkLoading(true);
    const result = await updateFolioRemark(remarkTarget.id, remarkText);
    setRemarkLoading(false);
    if (result.success) {
      toast.success("Remark updated");
      setRemarkOpen(false);
      setRemarkTarget(null);
      setRemarkText("");
      await refreshFolios();
    } else {
      toast.error(result.error || "Failed to update remark");
    }
  };

  // ─── Print folio ───────────────────────────────────────────────────────
  const handlePrintFolio = () => {
    if (!activeFolio) return;
    const guestName = [
      activeFolio.reservation?.guest?.first_name,
      activeFolio.reservation?.guest?.last_name,
    ].filter(Boolean).join(" ") || "";
    const roomNumber = activeFolio.reservation?.room?.room_number || "";
    const reservationNumber = activeFolio.reservation?.reservation_number || "";
    const checkIn = activeFolio.reservation?.check_in_date || "";
    const checkOut = activeFolio.reservation?.check_out_date || "";

    const html = buildFolioHtml({
      folio: activeFolio,
      guestName,
      roomNumber,
      reservationNumber,
      checkIn,
      checkOut,
      billingAddress,
    });

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  };

  // ─── Load tax invoices when taxInvOpen ────────────────────────────────
  useEffect(() => {
    if (taxInvOpen && activeFolio) {
      getTaxInvoices(activeFolio.id).then((r) => {
        if (r.success && r.data) setTaxInvoices(r.data);
        else setTaxInvoices([]);
      });
    }
    if (billSetupOpen) loadFolioSetup();
  }, [taxInvOpen, billSetupOpen, loadFolioSetup, activeFolio]);

  // ─── Total selection amount ─────────────────────────────────────────────
  const selectedTotal = (() => {
    if (!activeFolio) return 0;
    return (activeFolio.items ?? [])
      .filter((i) => selectedItemIds.includes(i.id) && !i.is_voided && i.payf !== "W" && i.payf !== "P")
      .reduce((s, i) => s + Number(i.amount), 0);
  })();

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Header */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-indigo-600" />
            Cashier / Billing
          </h1>
          <div className="h-8 w-px bg-slate-300"></div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-slate-400 cursor-pointer hover:text-indigo-600" onClick={fetchList} />
            <span className="text-sm text-slate-500">Refresh</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dueOut"
              checked={filterDueOut}
              onChange={(e) => setFilterDueOut(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="dueOut" className="text-sm text-slate-600">Due Out Today</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="checkoutOnly"
              checked={filterCheckoutOnly}
              onChange={(e) => setFilterCheckoutOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="checkoutOnly" className="text-sm text-slate-600">Checkout Only</label>
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Main Content: Guest List + Folio Detail */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ───── Guest List (Left Panel) ─────────────────────────────────────── */}
        <div className="w-96 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by room, guest name, or res#..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : folios.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No open folios found
              </div>
            ) : (
              folios.map((f) => (
                <div
                  key={f.id}
                  onClick={() => selectReservation(f.reservation_id)}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                    selectedReservationId === f.reservation_id ? "bg-indigo-50 border-l-4 border-l-indigo-500" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BedDouble className="w-4 h-4 text-slate-500" />
                      <span className="font-bold text-slate-800">{f.reservation?.room?.room_number || "—"}</span>
                    </div>
                    {f.is_locked && <Lock className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="text-sm font-medium text-slate-700 mb-1">
                    {f.reservation?.guest?.first_name} {f.reservation?.guest?.last_name}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Folio {f.folio_seq}</span>
                    <span className="font-semibold text-indigo-600">฿{fmt(f.balance)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ───── Folio Detail (Right Panel) ───────────────────────────────────── */}
        {activeFolio ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* ───── Folio Header ─────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-slate-800">
                      {activeFolio.reservation?.guest?.first_name} {activeFolio.reservation?.guest?.last_name}
                    </h2>
                    <span className="text-sm text-slate-500">
                      {activeFolio.reservation?.reservation_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-4 h-4" />
                      {activeFolio.reservation?.room?.room_number || "Unassigned"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {fmtDate(activeFolio.reservation?.check_in_date)} → {fmtDate(activeFolio.reservation?.check_out_date)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handlePrintFolio}>
                    <Printer className="w-4 h-4 mr-2" /> Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBillAddrOpen(true)}>
                    <MapPin className="w-4 h-4 mr-2" /> Bill To
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCheckoutOpen(true)}>
                    <LogOut className="w-4 h-4 mr-2" /> Checkout
                  </Button>
                </div>
              </div>

              {/* ───── Folio Sequence Tabs ──────────────────────────────────────── */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((seq) => {
                  const folio = reservationFolios[seq - 1];
                  return (
                    <button
                      key={seq}
                      onClick={() => setActiveFolioSeq(seq as 1 | 2 | 3 | 4)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeFolioSeq === seq
                          ? "bg-indigo-600 text-white shadow-lg"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>Folio {seq}</span>
                        {folio?.is_locked && <Lock className="w-3 h-3" />}
                      </div>
                      {folio && (
                        <div className={`text-xs mt-0.5 ${folio.balance > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                          ฿{fmt(folio.balance)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ───── Lock/Unlock Button ──────────────────────────────────────── */}
              <div className="mt-3">
                <Button
                  size="sm"
                  variant={activeFolio.is_locked ? "outline" : "outline"}
                  onClick={() => handleLockToggle(activeFolio.id, activeFolio.is_locked)}
                  className={activeFolio.is_locked ? "text-amber-600 border-amber-300" : "text-indigo-600 border-indigo-300"}
                >
                  {activeFolio.is_locked ? <LockOpen className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  {activeFolio.is_locked ? "Unlock Folio" : "Lock Folio"}
                </Button>
              </div>
            </div>

            {/* ───── Quick Action Buttons ──────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-2">
              <Button size="sm" onClick={() => setPostOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" /> Post Charge
              </Button>
              <Button size="sm" onClick={async () => {
                const hasRight = await checkRight(FUNCTION_CODES.PAYMENT, "can_view");
                if (hasRight) {
                  setPayOpen(true);
                } else {
                  toast.error("You don't have permission to access Payment (KO39)");
                }
              }} className="bg-emerald-600 hover:bg-emerald-700">
                <CreditCard className="w-4 h-4 mr-2" /> Receive Payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdvPayOpen(true)}>
                <DollarSign className="w-4 h-4 mr-2" /> Advance Payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBillSetupOpen(true)}>
                <Settings2 className="w-4 h-4 mr-2" /> Bill Setup
              </Button>
              <div className="flex-1"></div>
              {selectedItemIds.length > 0 && (
                <Button size="sm" onClick={() => setSelPayOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckSquare className="w-4 h-4 mr-2" /> Pay Selected ({selectedItemIds.length})
                </Button>
              )}
            </div>

            {/* ───── Folio Items Table ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left border-b border-slate-200 w-8">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.length > 0}
                        onChange={(e) => {
                          const items = (activeFolio.items ?? []).filter(i => !i.is_voided && i.payf !== "W");
                          if (e.target.checked) {
                            setSelectedItemIds(items.map(i => i.id));
                          } else {
                            setSelectedItemIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="p-2 text-left border-b border-slate-200 text-slate-600">Date</th>
                    <th className="p-2 text-left border-b border-slate-200 text-slate-600">Code</th>
                    <th className="p-2 text-left border-b border-slate-200 text-slate-600">Description</th>
                    <th className="p-2 text-right border-b border-slate-200 text-slate-600">Amount</th>
                    <th className="p-2 text-right border-b border-slate-200 text-slate-600">VAT</th>
                    <th className="p-2 text-right border-b border-slate-200 text-slate-600">S/C</th>
                    <th className="p-2 text-center border-b border-slate-200 text-slate-600 w-20">Status</th>
                    <th className="p-2 text-center border-b border-slate-200 text-slate-600 w-12">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeFolio.items ?? []).map((item) => {
                    const style = getRowStyle(item.payf, item.is_voided ?? false);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItemIds(prev =>
                          prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        )}
                        className={`${style.bg} hover:bg-slate-100 transition-colors cursor-pointer`}
                      >
                        <td className="p-2 border-b border-slate-100">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 text-slate-500 text-xs">{fmtDate(item.item_date)}</td>
                        <td className="p-2 border-b border-slate-100 font-mono text-xs text-slate-600">{item.tran_code}</td>
                        <td className="p-2 border-b border-slate-100">
                          <div className={style.text}>
                            {item.description}
                            {item.reference && <div className="text-xs text-slate-400">Ref: {item.reference}</div>}
                            {item.remark && <div className="text-xs text-slate-400">Note: {item.remark}</div>}
                          </div>
                        </td>
                        <td className="p-2 border-b border-slate-100 text-right font-medium">{fmt(item.amount)}</td>
                        <td className="p-2 border-b border-slate-100 text-right text-xs text-slate-500">{fmt(item.vat_amount)}</td>
                        <td className="p-2 border-b border-slate-100 text-right text-xs text-slate-500">{fmt(item.service_amount)}</td>
                        <td className="p-2 border-b border-slate-100 text-center">
                          {getPayfBadge(item.payf, item.is_voided ?? false)}
                        </td>
                        <td className="p-2 border-b border-slate-100 text-center" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!item.is_voided && item.payf !== "W" && (
                                <>
                                  <DropdownMenuItem onClick={() => { setCorrTarget(item); setCorrReason(""); setCorrOpen(true); }}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Post Correction
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSplitTargetItem(item); setSplitAmounts([]); setSplitOpen(true); }}>
                                    <Scissors className="mr-2 h-4 w-4" />
                                    Split Transaction
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setRemarkTarget(item); setRemarkText(item.remark || ""); setRemarkOpen(true); }}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Edit Remark
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setCrNoteTarget(item); setCrNoteReason(""); setCrNoteOpen(true); }}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Issue Credit Note
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="w-full">
                                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                                  Transfer To Folio...
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {[1, 2, 3, 4].filter(seq => seq !== activeFolioSeq).map(seq => (
                                    <DropdownMenuItem key={seq} onClick={() => { setSelectedItemIds([item.id]); setTargetFolioSeq(String(seq)); setTransferOpen(true); }}>
                                      Folio {seq}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              {!item.is_voided && item.payf !== "W" && (
                                <DropdownMenuItem variant="destructive" onClick={() => { setVoidTarget(item); setVoidReason(""); setVoidOpen(true); }}>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Void Transaction
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                  {(activeFolio.folio_payments ?? []).map((pay) => (
                    <tr key={pay.id} className="bg-emerald-50">
                      <td className="p-2 border-b border-slate-100"></td>
                      <td className="p-2 border-b border-slate-100 text-slate-500 text-xs">{fmtDate(pay.created_at)}</td>
                      <td className="p-2 border-b border-slate-100 font-mono text-xs text-emerald-600">{pay.tran_code || pay.payment_method}</td>
                      <td className="p-2 border-b border-slate-100">
                        <div className="text-emerald-700">PAYMENT</div>
                        {pay.reference_number && <div className="text-xs text-slate-400">Ref: {pay.reference_number}</div>}
                        {pay.notes && <div className="text-xs text-slate-400">{pay.notes}</div>}
                      </td>
                      <td className="p-2 border-b border-slate-100 text-right font-bold text-emerald-600">({fmt(pay.amount)})</td>
                      <td className="p-2 border-b border-slate-100"></td>
                      <td className="p-2 border-b border-slate-100"></td>
                      <td className="p-2 border-b border-slate-100 text-center">
                        {pay.is_voided ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600">VOID</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-600">PAID</span>
                        )}
                      </td>
                      <td className="p-2 border-b border-slate-100 text-center" onClick={(e) => e.stopPropagation()}>
                        {!pay.is_voided && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem variant="destructive" onClick={async () => { 
                                const hasRight = await checkRight(FUNCTION_CODES.VOID, "can_view");
                                if (hasRight) {
                                  setVoidPayTarget(pay); 
                                  setVoidPayReason(""); 
                                  setVoidPayOpen(true); 
                                } else {
                                  toast.error("You don't have permission to Void (KO40)");
                                }
                              }}>
                                <Ban className="mr-2 h-4 w-4" />
                                Void Payment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 sticky bottom-0">
                  <tr className="border-t-2 border-slate-300">
                    <td colSpan={4} className="p-3 text-right font-bold text-slate-700">BALANCE DUE</td>
                    <td colSpan={5} className={`p-3 text-right text-xl font-black ${activeFolio.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      ฿{fmt(activeFolio.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Receipt className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg">Select a folio to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* Dialogs */}
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {/* ───── Post Charge Dialog ────────────────────────────────────────────── */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Code *</label>
              <Select value={postForm.tran_code} onValueChange={handleTranCodeChange}>
                <SelectTrigger><SelectValue placeholder="Select code" /></SelectTrigger>
                <SelectContent>
                  {tranCodes.map((tc) => (
                    <SelectItem key={tc.code} value={tc.code}>{tc.code} — {tc.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description *</label>
              <Input value={postForm.description} onChange={(e) => setPostForm({...postForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount *</label>
                <Input type="number" min={0} step="0.01" value={postForm.amount} onChange={(e) => setPostForm({...postForm, amount: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <Input type="number" min={1} value={postForm.quantity} onChange={(e) => setPostForm({...postForm, quantity: Number(e.target.value)})} />
              </div>
            </div>
            {computedVat && (
              <div className="bg-slate-50 p-3 rounded text-xs space-y-1">
                <div className="flex justify-between"><span>Gross:</span><span>฿{fmt(computedVat.gross)}</span></div>
                <div className="flex justify-between text-slate-500"><span>VAT ({selectedTranCode?.default_vat_rate}%):</span><span>฿{fmt(computedVat.vat)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Service Charge ({selectedTranCode?.default_serv_rate}%):</span><span>฿{fmt(computedVat.sc)}</span></div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Item Date</label>
              <Input type="date" value={postForm.item_date} onChange={(e) => setPostForm({...postForm, item_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference</label>
              <Input value={postForm.reference} onChange={(e) => setPostForm({...postForm, reference: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Remark</label>
              <Input value={postForm.remark} onChange={(e) => setPostForm({...postForm, remark: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPostOpen(false)}>Cancel</Button>
              <Button onClick={handlePost} disabled={postLoading} className="bg-indigo-600 hover:bg-indigo-700">
                {postLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post Charge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Receive Payment Dialog ────────────────────────────────────────── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Balance Display */}
            {activeFolio && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Balance Due:</span>
                  <span className="text-xl font-bold text-slate-800">฿{fmt(activeFolio.balance)}</span>
                </div>
              </div>
            )}

            {/* Payment Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Type *</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentType === 'PA' ? 'default' : 'outline'}
                  className={paymentType === 'PA' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  onClick={() => {
                    setPaymentType('PA');
                    if (activeFolio) {
                      setPayForm(f => ({ ...f, amount: Math.max(0, activeFolio.balance ?? 0) }));
                    }
                  }}
                >
                  Pay All
                </Button>
                <Button
                  type="button"
                  variant={paymentType === 'PT' ? 'default' : 'outline'}
                  className={paymentType === 'PT' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  onClick={() => {
                    setPaymentType('PT');
                    setPartialPayAmount(0);
                    setPartialPayOpen(true);
                    setPayOpen(false);
                  }}
                >
                  Partial
                </Button>
                <Button
                  type="button"
                  variant={paymentType === 'PR' ? 'default' : 'outline'}
                  className={paymentType === 'PR' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  onClick={() => setPaymentType('PR')}
                >
                  Refund
                </Button>
              </div>
            </div>

            {/* Tax Invoice Toggle */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="hasTaxInvoice"
                checked={hasTaxInvoice}
                onChange={(e) => setHasTaxInvoice(e.target.checked)}
                className="rounded border-amber-400"
              />
              <label htmlFor="hasTaxInvoice" className="text-sm font-medium text-amber-800">
                Tax Invoice / ใบเสร็จรับเงิน
              </label>
              <span className="text-xs text-amber-600 ml-auto">
                {hasTaxInvoice ? 'PAID (P)' : 'CASH (C)'}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method *</label>
              <Select value={payForm.tran_code} onValueChange={(v) => syncPaymentMethod(v, payForm, setPayForm)}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {paymentCodes.map((pm) => (
                    <SelectItem key={pm.code} value={pm.code}>{pm.code} — {pm.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount *</label>
              <Input 
                type="number" 
                min={0} 
                step="0.01" 
                value={paymentType === 'PA' ? (activeFolio?.balance ?? 0) : payForm.amount}
                onChange={(e) => setPayForm({...payForm, amount: Number(e.target.value)})}
                disabled={paymentType === 'PA'}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference Number</label>
              <Input value={payForm.reference_number} onChange={(e) => setPayForm({...payForm, reference_number: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({...payForm, notes: e.target.value})} />
            </div>

            {paymentType === 'PR' && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-700">
                Refund: Money will be returned to guest. Please ensure this is correct.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setPayOpen(false);
                setPaymentType('PA');
                setHasTaxInvoice(true);
              }}>Cancel</Button>
              <Button 
                onClick={handlePayment} 
                disabled={payLoading || (paymentType === 'PA' && (activeFolio?.balance ?? 0) <= 0)} 
                className={paymentType === 'PR' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              >
                {payLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {paymentType === 'PR' ? 'Process Refund' : 'Receive Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Partial Payment Dialog ────────────────────────────────────────── */}
      <Dialog open={partialPayOpen} onOpenChange={setPartialPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partial Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Balance:</span>
                <span className="text-lg font-bold text-slate-800">฿{fmt(activeFolio?.balance ?? 0)}</span>
              </div>
            </div>

            {/* Tax Invoice Toggle for Partial */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="partialHasTaxInvoice"
                checked={hasTaxInvoice}
                onChange={(e) => setHasTaxInvoice(e.target.checked)}
                className="rounded border-amber-400"
              />
              <label htmlFor="partialHasTaxInvoice" className="text-sm font-medium text-amber-800">
                Tax Invoice / ใบเสร็จรับเงิน
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount to Pay *</label>
              <Input 
                type="number" 
                min={0} 
                max={activeFolio?.balance} 
                step="0.01" 
                value={partialPayAmount || ''}
                onChange={(e) => setPartialPayAmount(Number(e.target.value))}
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method *</label>
              <Select value={payForm.tran_code} onValueChange={(v) => syncPaymentMethod(v, payForm, setPayForm)}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {paymentCodes.map((pm) => (
                    <SelectItem key={pm.code} value={pm.code}>{pm.code} — {pm.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reference Number</label>
              <Input value={payForm.reference_number} onChange={(e) => setPayForm({...payForm, reference_number: e.target.value})} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({...payForm, notes: e.target.value})} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setPartialPayOpen(false);
                setPaymentType('PA');
                setPartialPayAmount(0);
              }}>Cancel</Button>
              <Button 
                onClick={handlePartialPayment} 
                disabled={partialPayLoading || partialPayAmount <= 0 || partialPayAmount > (activeFolio?.balance ?? 0)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {partialPayLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pay ฿{partialPayAmount.toLocaleString()}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Advance Payment Dialog ────────────────────────────────────────── */}
      <Dialog open={advPayOpen} onOpenChange={setAdvPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Advance Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method *</label>
              <Select value={advPayForm.tran_code} onValueChange={(v) => syncPaymentMethod(v, advPayForm, setAdvPayForm)}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {paymentCodes.map((pm) => (
                    <SelectItem key={pm.code} value={pm.code}>{pm.code} — {pm.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount *</label>
              <Input type="number" min={0} step="0.01" value={advPayForm.amount} onChange={(e) => setAdvPayForm({...advPayForm, amount: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference Number</label>
              <Input value={advPayForm.reference_number} onChange={(e) => setAdvPayForm({...advPayForm, reference_number: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdvPayOpen(false)}>Cancel</Button>
              <Button onClick={handleAdvPay} disabled={advPayLoading} className="bg-emerald-600 hover:bg-emerald-700">
                {advPayLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Advance Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Billing Address Dialog ──────────────────────────────────────────── */}
      <Dialog open={billAddrOpen} onOpenChange={setBillAddrOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Billing Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input value={billAddrForm.company_name} onChange={(e) => setBillAddrForm({...billAddrForm, company_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Attention</label>
              <Input value={billAddrForm.attn_name} onChange={(e) => setBillAddrForm({...billAddrForm, attn_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address Line 1</label>
              <Input value={billAddrForm.address_line1} onChange={(e) => setBillAddrForm({...billAddrForm, address_line1: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address Line 2</label>
              <Input value={billAddrForm.address_line2} onChange={(e) => setBillAddrForm({...billAddrForm, address_line2: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <Input value={billAddrForm.city} onChange={(e) => setBillAddrForm({...billAddrForm, city: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tax ID</label>
                <Input value={billAddrForm.tax_id} onChange={(e) => setBillAddrForm({...billAddrForm, tax_id: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input value={billAddrForm.phone} onChange={(e) => setBillAddrForm({...billAddrForm, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={billAddrForm.email} onChange={(e) => setBillAddrForm({...billAddrForm, email: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBillAddrOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBillingAddr} disabled={billAddrLoading}>
                {billAddrLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Bill Setup Dialog ─────────────────────────────────────────────── */}
      <Dialog open={billSetupOpen} onOpenChange={setBillSetupOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Folio Setup (Transaction Code Routing)</DialogTitle>
            <DialogDescription>Configure which transaction codes go to which folio</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4 mb-4">
              <Select value={newSetupCode} onValueChange={setNewSetupCode}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select transaction code" /></SelectTrigger>
                <SelectContent>
                  {tranCodes.map((tc) => (
                    <SelectItem key={tc.code} value={tc.code}>{tc.code} — {tc.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newSetupFolio} onValueChange={setNewSetupFolio}>
                <SelectTrigger className="w-32"><SelectValue placeholder="To folio" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Folio 1</SelectItem>
                  <SelectItem value="2">Folio 2</SelectItem>
                  <SelectItem value="3">Folio 3</SelectItem>
                  <SelectItem value="4">Folio 4</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Limit Amount" min={0} value={newSetupLimit} onChange={(e) => setNewSetupLimit(Number(e.target.value))} className="w-40" />
              <Input type="date" placeholder="Until Date" value={newSetupUntil} onChange={(e) => setNewSetupUntil(e.target.value)} className="w-40" />
              <Button onClick={handleAddFolioSetup} size="sm" className="bg-indigo-600">
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </div>
            {billSetupLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : folioSetupItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No folio setup configured</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Folio</th>
                    <th className="p-2 text-right">Limit</th>
                    <th className="p-2 text-left">Until</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {folioSetupItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="p-2 font-mono text-slate-600">{item.tran_code}</td>
                      <td className="p-2 text-slate-700">{item.tran_code_info?.description}</td>
                      <td className="p-2 font-medium">Folio {item.folio_seq}</td>
                      <td className="p-2 text-right">{item.limit_amount > 0 ? fmt(item.limit_amount) : "—"}</td>
                      <td className="p-2 text-slate-500">{fmtDate(item.until_date)}</td>
                      <td className="p-2">
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteFolioSetup(item.id)}>
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Checkout Dialog ──────────────────────────────────────────────── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout Reservation</DialogTitle>
          </DialogHeader>
          {checkoutError && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded mb-4">
              <p className="text-sm text-amber-800">{checkoutError}</p>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="forceCheckout" checked={forceCheckout} onChange={(e) => setForceCheckout(e.target.checked)} />
                <label htmlFor="forceCheckout" className="text-sm">Force checkout anyway</label>
              </div>
            </div>
          )}
          {activeFolio && activeFolio.balance > 0.01 && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded mb-4">
              <p className="text-sm text-rose-800 font-medium">
                Outstanding balance: ฿{fmt(activeFolio.balance)}
              </p>
              <p className="text-xs text-rose-600 mt-1">Please receive payment before checkout or use force checkout.</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button onClick={handleCheckout} disabled={checkoutLoading} className="bg-blue-600 hover:bg-blue-700">
              {checkoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Checkout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Pay Selected Items Dialog ──────────────────────────────────────── */}
      <Dialog open={selPayOpen} onOpenChange={setSelPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Selected Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded">
              <div className="text-sm text-slate-600">Selected Items:</div>
              <div className="text-2xl font-bold text-slate-800">฿{fmt(selectedTotal)}</div>
            </div>

            {/* Tax Invoice Toggle */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="selHasTaxInvoice"
                checked={hasTaxInvoice}
                onChange={(e) => setHasTaxInvoice(e.target.checked)}
                className="rounded border-amber-400"
              />
              <label htmlFor="selHasTaxInvoice" className="text-sm font-medium text-amber-800">
                Tax Invoice / ใบเสร็จรับเงิน
              </label>
              <span className="text-xs text-amber-600 ml-auto">
                {hasTaxInvoice ? 'PAID (P)' : 'CASH (C)'}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method *</label>
              <Select value={selPayForm.tran_code} onValueChange={(v) => syncPaymentMethod(v, selPayForm, setSelPayForm)}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {paymentCodes.map((pm) => (
                    <SelectItem key={pm.code} value={pm.code}>{pm.code} — {pm.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference Number</label>
              <Input value={selPayForm.reference_number} onChange={(e) => setSelPayForm({...selPayForm, reference_number: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelPayOpen(false)}>Cancel</Button>
              <Button onClick={handlePaySelected} disabled={selPayLoading} className="bg-emerald-600 hover:bg-emerald-700">
                {selPayLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pay ฿{fmt(selectedTotal)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Void Charge Dialog ──────────────────────────────────────────────── */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void Transaction</DialogTitle>
          </DialogHeader>
          {voidTarget && (
            <div className="bg-slate-50 p-4 rounded mb-4">
              <div className="text-sm text-slate-600">{voidTarget.description}</div>
              <div className="text-lg font-bold text-rose-600">฿{fmt(voidTarget.amount)}</div>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Void Reason *</label>
              <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Please enter reason for voiding..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
              <Button onClick={handleVoid} disabled={voidLoading} variant="destructive">
                {voidLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Void
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Void Payment Dialog ─────────────────────────────────────────────── */}
      <Dialog open={voidPayOpen} onOpenChange={setVoidPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void Payment</DialogTitle>
          </DialogHeader>
          {voidPayTarget && (
            <div className="bg-slate-50 p-4 rounded mb-4">
              <div className="text-sm text-slate-600">Payment: {voidPayTarget.tran_code}</div>
              <div className="text-lg font-bold text-emerald-600">฿{fmt(voidPayTarget.amount)}</div>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Void Reason *</label>
              <Input value={voidPayReason} onChange={(e) => setVoidPayReason(e.target.value)} placeholder="Please enter reason for voiding..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVoidPayOpen(false)}>Cancel</Button>
              <Button onClick={handleVoidPay} disabled={voidPayLoading} variant="destructive">
                {voidPayLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Void
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Credit Note Dialog ──────────────────────────────────────────────── */}
      <Dialog open={crNoteOpen} onOpenChange={setCrNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Credit Note</DialogTitle>
            <DialogDescription>Reverse a transaction by issuing a credit note</DialogDescription>
          </DialogHeader>
          {crNoteTarget && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded mb-4">
              <div className="text-sm text-amber-800 mb-1">Original Transaction:</div>
              <div className="text-sm text-amber-700">{crNoteTarget.description}</div>
              <div className="text-lg font-bold text-amber-600">฿{fmt(crNoteTarget.amount)}</div>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Credit Note Reason *</label>
              <Input value={crNoteReason} onChange={(e) => setCrNoteReason(e.target.value)} placeholder="Please enter reason for credit note..." />
            </div>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-700">
              <strong>Note:</strong> A credit note will be issued with negative amount, and the original transaction will be marked as "CORR".
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCrNoteOpen(false)}>Cancel</Button>
              <Button onClick={handleCrNote} disabled={crNoteLoading} className="bg-amber-600 hover:bg-amber-700">
                {crNoteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Issue Credit Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Transfer Items Dialog ────────────────────────────────────────────── */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Items to Another Folio</DialogTitle>
            <DialogDescription>Move selected items to a different folio</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded mb-4">
              <div className="text-sm text-slate-600">Selected Items:</div>
              <div className="text-lg font-bold text-slate-800">{selectedItemIds.length} item{selectedItemIds.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Folio *</label>
              <Select value={targetFolioSeq} onValueChange={setTargetFolioSeq}>
                <SelectTrigger><SelectValue placeholder="Select target folio" /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].filter(seq => seq !== activeFolioSeq).map(seq => (
                    <SelectItem key={seq} value={String(seq)}>Folio {seq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
              <Button onClick={handleTransfer} disabled={transferLoading} className="bg-indigo-600 hover:bg-indigo-700">
                {transferLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transfer Items
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───── Split Transaction Dialog ─────────────────────────────────────────── */}
      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Split Transaction</DialogTitle>
            <DialogDescription>Split a transaction amount across multiple folios</DialogDescription>
          </DialogHeader>
          {splitTargetItem && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded">
                <div className="text-sm text-slate-600">Original Transaction:</div>
                <div className="text-sm font-medium text-slate-800">{splitTargetItem.description}</div>
                <div className="text-lg font-bold text-indigo-600">฿{fmt(splitTargetItem.amount)}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Split Configuration</label>
                <div className="space-y-2">
                  {splitAmounts.map((split, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 w-20">Folio {split.targetFolioSeq}:</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={split.amount}
                        onChange={(e) => {
                          const newSplits = [...splitAmounts];
                          newSplits[idx].amount = Number(e.target.value);
                          setSplitAmounts(newSplits);
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newSplits = splitAmounts.filter((_, i) => i !== idx);
                          setSplitAmounts(newSplits);
                        }}
                      >
                        <X className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextFolio = splitAmounts.length + 1;
                    if (nextFolio <= 4) {
                      setSplitAmounts([...splitAmounts, { amount: 0, targetFolioSeq: nextFolio }]);
                    }
                  }}
                  disabled={splitAmounts.length >= 4}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Folio
                </Button>
              </div>

              <div className="bg-indigo-50 p-3 rounded text-xs text-indigo-700">
                <div className="flex justify-between">
                  <span>Total Split Amount:</span>
                  <span className="font-bold">฿{fmt(splitAmounts.reduce((sum, s) => sum + s.amount, 0))}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Remaining:</span>
                  <span className={`font-bold ${splitTargetItem.amount - splitAmounts.reduce((sum, s) => sum + s.amount, 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ฿{fmt(splitTargetItem.amount - splitAmounts.reduce((sum, s) => sum + s.amount, 0))}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Split Reason *</label>
                <Input value={splitReason} onChange={(e) => setSplitReason(e.target.value)} placeholder="Please enter reason for split..." />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleSplit}
                  disabled={splitLoading || splitAmounts.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {splitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Split Transaction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ───── Post Correction Dialog ─────────────────────────────────────────── */}
      <Dialog open={corrOpen} onOpenChange={setCorrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post Correction</DialogTitle>
            <DialogDescription>Apply a correction (negative entry) to reverse a transaction</DialogDescription>
          </DialogHeader>
          {corrTarget && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded mb-4">
                <div className="text-sm text-slate-600">Original Transaction:</div>
                <div className="text-sm font-medium text-slate-800">{corrTarget.description}</div>
                <div className="text-lg font-bold text-slate-800">฿{fmt(corrTarget.amount)}</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded mb-4">
                <div className="text-sm text-amber-800 mb-1">Correction Entry:</div>
                <div className="text-sm font-medium text-amber-700">CORRECTION: {corrTarget.description}</div>
                <div className="text-lg font-bold text-amber-600">-฿{fmt(corrTarget.amount)}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Correction Reason *</label>
                <Input value={corrReason} onChange={(e) => setCorrReason(e.target.value)} placeholder="Please enter reason for correction..." />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCorrOpen(false)}>Cancel</Button>
                <Button onClick={handleCorrection} disabled={corrLoading} className="bg-indigo-600 hover:bg-indigo-700">
                  {corrLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Post Correction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ───── Edit Remark Dialog ────────────────────────────────────────────── */}
      <Dialog open={remarkOpen} onOpenChange={setRemarkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaction Remark</DialogTitle>
            <DialogDescription>Add or update a note for this transaction</DialogDescription>
          </DialogHeader>
          {remarkTarget && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded mb-4">
                <div className="text-sm text-slate-600">Transaction:</div>
                <div className="text-sm font-medium text-slate-800">{remarkTarget.description}</div>
                <div className="text-lg font-bold text-slate-800">฿{fmt(remarkTarget.amount)}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Remark *</label>
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  placeholder="Enter a note for this transaction..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRemarkOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateRemark} disabled={remarkLoading} className="bg-indigo-600 hover:bg-indigo-700">
                  {remarkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Remark
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
