# Core Cashier Operations Validation Guide
## hotel-pms Legacy → Hotel-PMS Implementation Verification

---

## Overview

This document provides a comprehensive guide for validating that all core cashier operations in hotel-pms work exactly like the legacy hotel-pms Delphi system.

---

## Pre-Validation Checklist

### Prerequisites
- [ ] Supabase database with schema_v8_billing_folio.sql applied
- [ ] Test reservation created and checked-in
- [ ] Revenue transaction codes seeded (ROOM, BREAK, CASH, VISA, etc.)
- [ ] User account created with appropriate permissions
- [ ] Browser opened to http://localhost:3000/dashboard/cashier

### Test Reservation Setup
- [ ] Reservation #1: Room 101, 3 nights, single guest
- [ ] Folio 1, 2, 3, 4 created automatically
- [ ] Initial balance: 0.00 THB
- [ ] Status: Open, Not Locked

---

## Validation Test Cases

### 1. Post Charge (hotel-pms: PostNewFolioTransactionEX)

| Test Step | Expected Behavior | Verification |
|-----------|------------------|--------------|
| Select Folio 1 | Folio 1 tab becomes active | Tab highlighted |
| Click "Post Charge" | Post charge dialog opens | Dialog appears |
| Select transaction code "ROOM" | Room Charge selected | Code displayed |
| Enter amount 3500 | Amount populated | Amount = 3,500.00 |
| Click "Post" | Transaction posted | New item in list |
| Verify VAT calculation | VAT = 228.97 THB | 7% of gross |
| Verify Service Charge | SC = 299.15 THB | 10% of gross |
| Verify Net Amount | Net = 2,971.88 THB | Gross - VAT - SC |
| Verify Balance | Balance = 3,500.00 THB | Equal to posted amount |
| Verify PAYF flag | Badge = "CHRG" (gray) | Item not paid |
| Verify tran_code | Displayed as "ROOM" | Code correct |
| Verify timestamp | Current date/time | Accurate |
| Verify audit trail | posted_by = current user | User recorded |

**hotel-pms Parity Check:**
- [ ] VAT formula matches: `(Gross × 7) / (100 + 7) = 228.97`
- [ ] SC formula matches: `(Gross × 10) / (100 + 7 + 10) = 299.15`
- [ ] Folio total auto-recalculated
- [ ] Balance = total_amount - paid_amount

---

### 2. Post Multiple Charges

| Test Step | Expected Behavior |
|-----------|------------------|
| Post "BREAK" 250 THB | VAT 16.36, SC 21.37, Balance 3,750.00 |
| Post "MINIBAR" 350 THB | VAT 22.90, SC 29.91, Balance 4,100.00 |
| Post "LAUNDRY" 800 THB | VAT 52.34, SC 68.38, Balance 4,900.00 |
| Verify folio totals | Total = 4,900.00, VAT = 320.57, SC = 418.81 |

**Validation:**
- [ ] All items displayed in chronological order
- [ ] Cumulative balance correct
- [ ] Each item has correct VAT/SC breakdown
- [ ] PAYF flags all = "CHRG"

---

### 3. Receive Payment (hotel-pms: ReceivePayment)

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "Receive Payment" | Payment dialog opens |
| Select payment method "CASH" | Cash selected |
| Enter amount 2,000 THB | Amount populated |
| Click "Receive" | Payment recorded |
| Verify payment in list | Payment row (blue) shown |
| Verify balance | Balance = 2,900.00 THB (4,900 - 2,000) |
| Verify paid_amount | paid_amount = 2,000.00 THB |
| Verify PAYF flag | Payment items have PAYF = 'P' |

**Payment Method Tests:**
- [ ] **Cash**: No extra fields required
- [ ] **Visa Card**: Requires card_type, last4, approval_code
- [ ] **Bank Transfer**: Requires reference_number
- [ ] **City Ledger (AR)**: Mark as AR account

**hotel-pms Parity Check:**
- [ ] Payment stored in folio_payments table
- [ ] Folio totals auto-recalculated
- [ ] Balance = total_amount - paid_amount
- [ ] Audit trail: created_by, created_at

---

### 4. Void Transaction (hotel-pms: sets PAYF='W', voidstatus='Y')

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "More" → "Void" on laundry item | Void dialog opens |
| Enter reason "Guest didn't use" | Reason entered |
| Click "Confirm Void" | Item voided |
| Verify item appearance | Strikethrough, red background |
| Verify PAYF badge | Badge = "VOID" (red) |
| Verify void_reason | Reason stored |
| Verify balance | Balance = 4,100.00 THB (removed 800) |
| Verify audit trail | voided_at, voided_by populated |
| Verify voided flag | is_voided = true |
| Verify payf flag | payf = 'W' |

**Void Constraints (hotel-pms Rules):**
- [ ] Cannot void locked folio
- [ ] Cannot void already paid items
- [ ] Cannot void already voided items
- [ ] Void reason required
- [ ] Voided items included in audit trail

---

### 5. Issue Credit Note (hotel-pms: Credit Note)

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "More" → "Credit Note" on mini bar item | Credit note dialog opens |
| Enter reason "Item not available" | Reason entered |
| Click "Issue" | Credit note created |
| Verify original item | PAYF = "CORR" (green) |
| Verify credit note number | Sequential CR number assigned |
| Verify reversal item | Negative amount (-350.00) |
| Verify reversal VAT | Negative VAT (-22.90) |
| Verify reversal SC | Negative SC (-29.91) |
| Verify balance | Balance = 3,750.00 THB (4,100 - 350) |
| Verify credit_note_ref | Links to original item |

**Credit Note Constraints:**
- [ ] Cannot issue for voided items
- [ ] Cannot issue for already credited items
- [ ] Credit note creates negative transaction
- [ ] Original item marked as credited

---

### 6. Transfer Items Between Folios (hotel-pms: Transfer)

| Test Step | Expected Behavior |
|-----------|------------------|
| Select breakfast item (checkbox) | Item selected |
| Click "Transfer" | Transfer dialog opens |
| Select target Folio 2 | Target selected |
| Click "Transfer" | Item moved |
| Verify Folio 1 | Breakfast removed from list |
| Verify Folio 2 | Breakfast added to list |
| Verify Folio 1 balance | Balance = 3,500.00 THB (removed 250) |
| Verify Folio 2 balance | Balance = 250.00 THB |
| Verify audit trail | Transfer logged |

**Transfer Rules:**
- [ ] Can transfer between folios 1-4
- [ ] Can transfer to different reservations
- [ ] Cannot transfer voided items
- [ ] Cannot transfer to locked folio
- [ ] Cannot transfer paid items
- [ ] Transfer preserves VAT/SC calculation

---

### 7. Lock/Unlock Folio (hotel-pms: Block/Unblock)

**Lock Folio:**
| Test Step | Expected Behavior |
|-----------|------------------|
| Click "More" → "Lock Folio" | Lock icon appears |
| Verify is_locked flag | is_locked = true |
| Verify locked_by | Current user stored |
| Verify locked_at | Timestamp recorded |
| Try to post charge | Error: "Folio is locked" |
| Try to receive payment | Error: "Folio is locked" |
| Try to void | Error: "Folio is locked" |

**Unlock Folio:**
| Test Step | Expected Behavior |
|-----------|------------------|
| Click "More" → "Unlock Folio" | Lock icon disappears |
| Verify is_locked flag | is_locked = false |
| Verify locked_by | Cleared to null |
| Verify locked_at | Cleared to null |
| Try to post charge | Success: Charge posted |

**Lock Constraints (hotel-pms Rules):**
- [ ] Only locked folio prevents modifications
- [ ] Does NOT prevent viewing
- [ ] Does NOT prevent checkout
- [ ] Lock records user who locked it
- [ ] Can be unlocked by any authorized user

---

### 8. Folio Setup (Billing Instructions) (hotel-pms: FolioSetup)

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "Bill Setup" | Setup dialog opens |
| Add rule: ROOM → Folio 2 | Rule created |
| Set limit: 5000 THB | Limit stored |
| Set until: 2026-03-15 | Date stored |
| Post ROOM 3000 THB | Goes to Folio 2 |
| Post ROOM 6000 THB | Goes to Folio 1 (exceeds limit) |
| Post BREAK 250 THB | Goes to Folio 1 (no rule) |

**Setup Rules:**
- [ ] Tran code → Folio seq mapping
- [ ] Amount limit (0 = unlimited)
- [ ] Effective until date (null = until checkout)
- [ ] Multiple rules per reservation
- [ ] Rules checked in sort_order

---

### 9. Pay Selected Items

| Test Step | Expected Behavior |
|-----------|------------------|
| Select ROOM and BREAK items | Both checked |
| Click "Pay Selected" | Payment dialog opens |
| Enter amount 2,500 THB | Partial payment |
| Select payment method "VISA" | Credit card selected |
| Enter card details | Last 4, approval code |
| Click "Pay" | Payment applied to selected items |
| Verify item status | Items marked PAID (blue) |
| Verify PAYF flag | PAYF = 'P' |
| Verify folio balance | Balance reduced by 2,500 |

---

### 10. Checkout Flow (hotel-pms: Checkout)

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "Checkout" | Checkout dialog opens |
| Verify balance | Show current balance |
| Verify status items | List unpaid items |
| Click "Process Checkout" | Checkout initiated |
| Verify folio status | status = 'closed' |
| Verify reservation status | status = 'checked_out' |
| Generate folio print | Folio printed |
| Generate tax invoice | Invoice # assigned (if required) |

**Checkout Constraints:**
- [ ] Cannot checkout if balance > 0 (unless forced)
- [ ] Cannot checkout locked folio
- [ ] All unpaid items marked as PAID
- [ ] Folio set to closed status
- [ ] Room marked as available

---

### 11. Tax Invoice Generation (hotel-pms: TAX_INV)

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "Tax Invoice" | Invoice dialog opens |
| Verify company name | From billing address |
| Verify tax ID | From billing address |
| Verify amount | Sum of vatable items |
| Verify VAT amount | Sum of VAT |
| Verify SC amount | Sum of service charge |
| Click "Issue" | Invoice created |
| Verify invoice number | Sequential (100001+) |
| Verify tax_inv_no | Linked to folio items |
| Verify print | Invoice formatted for printing |

**Tax Invoice Rules:**
- [ ] Sequential numbering from 100001
- [ ] Links to folio and reservation
- [ ] Captures billing address snapshot
- [ ] Cannot modify after issuance
- [ ] Supports credit note reversal

---

### 12. Bill To / Billing Address (hotel-pms: BillAddress)

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "Bill To" | Address dialog opens |
| Enter company name | Company stored |
| Enter attention name | Attn stored |
| Enter address lines | Address stored |
| Enter tax ID | Tax ID stored |
| Click "Save" | Address saved |
| Verify on folio | Company displayed |
| Verify on print | Address on printed folio |
| Verify on invoice | Address on tax invoice |

**Billing Address Fields:**
- [ ] company_name (ห้างหุ้นส่วนจำกัด)
- [ ] attn_name (เรียน / Attention)
- [ ] address_line1, address_line2, address_line3
- [ ] city, country
- [ ] tax_id (เลขประจำตัวผู้เสียภาษี)
- [ ] phone, email
- [ ] reference_no (PO number)

---

### 13. Folio Remark (hotel-pms: Remark)

| Test Step | Expected Behavior |
|-----------|------------------|
| Click "More" → "Add Remark" | Remark dialog opens |
| Select folio item | Item highlighted |
| Enter remark text | Text entered |
| Click "Save" | Remark saved |
| Verify on item | Remark displayed |
| Verify in database | remark field populated |
| Verify audit trail | last_updated timestamp |

---

### 14. Shift Code Tracking (hotel-pms: SHIFTCODE)

| Test Step | Expected Behavior |
|-----------|------------------|
| Set shift code (dropdown) | Shift selected |
| Post transaction | shift_code populated |
| Receive payment | shift_code populated |
| Verify in database | shift_code stored |
| Verify on reports | Grouped by shift |

**Shift Codes (Typical):**
- [ ] Morning (06:00 - 14:00)
- [ ] Afternoon (14:00 - 22:00)
- [ ] Night (22:00 - 06:00)

---

### 15. Advance Payment (hotel-pms: Advance Payment)

| Test Step | Expected Behavior |
|-----------|------------------|
| Select transaction "DEPST" | Deposit selected |
| Enter amount 1,000 THB | Deposit amount |
| Click "Post" | Deposit posted |
| Verify is_advance_payment | true |
| Verify PAYF flag | 'ADV' (purple badge) |
| Verify balance | Balance = -1,000 THB (credit) |

**Advance Payment Rules:**
- [ ] Creates negative balance (credit)
- [ ] Marked with 'ADV' badge
- [ ] Can be applied to future charges
- [ ] Included in paid_amount calculation

---

## PAYF Flag Verification Matrix

| Flag | hotel-pms Meaning | Hotel-PMS | Badge Color | Display |
|------|--------------|------------|-------------|---------|
| `''` or `'I'` | Normal Item | Default | Gray | CHRG |
| `'P'` | Paid Item | Paid | Blue | PAID |
| `'C'` | Credit Note Issued | Credited | Green | CORR |
| `'W'` | Voided | Voided | Red | VOID |
| `'A'` | Advance Payment | Advance | Purple | ADV |

**Row Styling:**
- Voided (`W`): Red background, strikethrough, opacity 60%
- Paid (`P`): Blue background
- Credited (`C`): Green background
- Default (`''`/`I`): No background, normal text

---

## VAT/Service Charge Calculation Verification

### Type A (VAT Inclusive - Thailand Standard)

**Formula:**
```
VAT = (Gross × VAT_Rate) / (100 + VAT_Rate)
SC = (Gross × SC_Rate) / (100 + VAT_Rate + SC_Rate)
Net = Gross - VAT - SC
```

**Test: Gross 1,000 THB, 7% VAT, 10% SC**
```
VAT = (1,000 × 7) / 107 = 65.42 THB
SC = (1,000 × 10) / 117 = 85.47 THB
Net = 1,000 - 65.42 - 85.47 = 849.11 THB
```

**Verification Points:**
- [ ] VAT rounded to 2 decimal places
- [ ] SC rounded to 2 decimal places
- [ ] Rounding matches hotel-pms: `ROUND(... * 100) / 100`
- [ ] vatable_amount = gross (for V type)
- [ ] non_vat_amount = 0 (for V type)

### Type B (VAT Exclusive)

**Formula:**
```
SC = Net × SC_Rate / 100
VAT = (Net + SC) × VAT_Rate / 100
Gross = Net + SC + VAT
```

**Test: Net 1,000 THB, 7% VAT, 10% SC**
```
SC = 1,000 × 10 / 100 = 100.00 THB
VAT = (1,000 + 100) × 7 / 100 = 77.00 THB
Gross = 1,000 + 100 + 77 = 1,177.00 THB
```

### Non-VAT Items

**Formula:**
```
VAT = 0
SC = 0
NonVat = Amount
```

**Non-VAT Transaction Codes:**
- [ ] LATEOUT - Late Check-out
- [ ] EARLYIN - Early Check-in
- [ ] DISC - Discount

---

## Database Verification Queries

### Verify Folio Totals
```sql
SELECT
  f.folio_seq,
  f.total_amount,
  f.tax_amount,
  f.service_charge,
  f.paid_amount,
  f.balance
FROM folios f
WHERE f.reservation_id = '[test_reservation_id]';
```

**Expected:**
- total_amount = SUM of active folio_items.amount
- tax_amount = SUM of active folio_items.vat_amount
- service_charge = SUM of active folio_items.service_amount
- paid_amount = SUM of active folio_payments.amount
- balance = total_amount - paid_amount

### Verify Transaction History
```sql
SELECT
  fi.tran_code,
  fi.description,
  fi.amount,
  fi.vat_amount,
  fi.service_amount,
  fi.payf,
  fi.is_voided,
  fi.posted_by,
  fi.created_at
FROM folio_items fi
WHERE fi.folio_id = '[folio_id]'
ORDER BY fi.created_at;
```

### Verify Audit Trail
```sql
SELECT
  'item' AS type,
  fi.id,
  fi.tran_code,
  fi.amount,
  fi.payf,
  fi.is_voided,
  fi.voided_at,
  fi.voided_by,
  fi.created_at
FROM folio_items fi
WHERE fi.folio_id = '[folio_id]'

UNION ALL

SELECT
  'payment' AS type,
  fp.id,
  fp.tran_code,
  fp.amount,
  NULL AS payf,
  fp.is_voided,
  fp.voided_at,
  fp.voided_by,
  fp.created_at
FROM folio_payments fp
WHERE fp.folio_id = '[folio_id]'

ORDER BY created_at;
```

---

## Common Issues & Troubleshooting

### Issue: Balance Not Recalculating
**Symptoms:** Balance doesn't update after posting/payment
**Check:**
- [ ] Recalculate trigger exists: `trg_folio_items_recalc`
- [ ] Recalculate trigger exists: `trg_folio_payments_recalc`
- [ ] RPC function exists: `recalculate_folio_totals`

**Fix:** Run manual recalculation
```sql
SELECT recalculate_folio_totals('[folio_id]');
```

### Issue: VAT Calculation Incorrect
**Symptoms:** VAT amount differs from expected
**Check:**
- [ ] vat_type set correctly ('V', 'N', 'E')
- [ ] vat_inclusive flag matches transaction code
- [ ] VAT rate in revenue_transaction_codes correct
- [ ] Override rates not applied unexpectedly

**Fix:** Verify RPC function `rpc_post_folio_item` logic

### Issue: Cannot Post to Locked Folio
**Symptoms:** "Folio is locked" error
**Check:**
- [ ] Folio is_locked = true
- [ ] Need to unlock first

**Expected Behavior:** This is correct hotel-pms behavior

### Issue: Cannot Find Transaction Code
**Symptoms:** "Transaction code not found" error
**Check:**
- [ ] Transaction code exists in revenue_transaction_codes
- [ ] is_active = true
- [ ] allow_manual_post = true (for manual posting)

---

## Validation Completion Checklist

### Core Operations
- [ ] Post charge with VAT/SC
- [ ] Post multiple charges
- [ ] Receive payment (all methods)
- [ ] Void transaction
- [ ] Issue credit note
- [ ] Transfer items between folios
- [ ] Lock/unlock folio
- [ ] Folio setup (billing rules)
- [ ] Pay selected items
- [ ] Checkout flow
- [ ] Tax invoice generation
- [ ] Billing address management
- [ ] Folio remark
- [ ] Shift code tracking
- [ ] Advance payment

### Data Integrity
- [ ] Folio totals auto-recalculate
- [ ] Balance calculations correct
- [ ] VAT/SC calculations match hotel-pms
- [ ] PAYF flags correct
- [ ] Audit trail complete
- [ ] Foreign key integrity

### hotel-pms Parity
- [ ] All hotel-pms features available
- [ ] Calculation formulas match
- [ ] Business rules match
- [ ] User experience similar
- [ ] Data model compatible

---

## Next Steps After Validation

1. **Document Discrepancies**
   - Create issue list for any hotel-pms deviations
   - Prioritize critical issues
   - Plan fixes

2. **Performance Testing**
   - Test with large folios (100+ items)
   - Test concurrent operations
   - Identify bottlenecks

3. **Integration Testing**
   - Test with real hotel-pms data migration
   - Verify reports match
   - Check edge cases

4. **User Acceptance Testing**
   - Train staff on hotel-pms
   - Collect feedback
   - Iterate on issues

---

## Sign-off

| Role | Name | Date | Signature |
|-------|------|------|-----------|
| Technical Lead | | | |
| QA Lead | | | |
| Hotel Manager | | | |
| hotel-pms SME | | | |

**Validation Complete:** _______________
**Ready for Production:** _______________
