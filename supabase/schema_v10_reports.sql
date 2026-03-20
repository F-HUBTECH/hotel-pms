-- =============================================
-- Hotel PMS - Schema V10: Advanced Reports
-- Daily revenue reports, payment reconciliation, folio aging, tax invoice summary
-- =============================================

-- =============================================
-- 1. DAILY REVENUE REPORT
-- =============================================
CREATE OR REPLACE VIEW public.v_daily_revenue_report AS
WITH daily_revenue AS (
  SELECT
    DATE(fi.created_at) AS report_date,
    CASE
      WHEN tc.code = 'ROOM' THEN 'Room Revenue'
      WHEN tc.code IN ('BREAK', 'LUNCH', 'DINNER') THEN 'Food & Beverage'
      WHEN tc.code = 'MINIBAR' THEN 'Mini Bar'
      WHEN tc.code = 'LAUNDRY' THEN 'Laundry'
      WHEN tc.code = 'PHONE' THEN 'Telephone'
      WHEN tc.code = 'INET' THEN 'Internet'
      WHEN tc.code = 'SPA' THEN 'Spa & Wellness'
      WHEN tc.code = 'PARK' THEN 'Parking'
      WHEN tc.code = 'MISC' THEN 'Miscellaneous'
      WHEN tc.code = 'DAMAGE' THEN 'Damage Charges'
      WHEN tc.code = 'EXBED' THEN 'Extra Bed'
      ELSE 'Other Charges'
    END AS category,
    tc.code AS tran_code,
    tc.description AS tran_description,
    COUNT(fi.id) AS transaction_count,
    SUM(fi.amount) AS total_amount,
    SUM(fi.vat_amount) AS total_vat,
    SUM(fi.service_amount) AS total_service_charge,
    SUM(fi.vatable_amount) AS total_vatable,
    SUM(fi.non_vat_amount) AS total_non_vat
  FROM folio_items fi
  JOIN revenue_transaction_codes tc ON tc.code = fi.tran_code
  WHERE fi.is_voided = false
    AND fi.payf NOT IN ('W')
  GROUP BY
    DATE(fi.created_at),
    CASE
      WHEN tc.code = 'ROOM' THEN 'Room Revenue'
      WHEN tc.code IN ('BREAK', 'LUNCH', 'DINNER') THEN 'Food & Beverage'
      WHEN tc.code = 'MINIBAR' THEN 'Mini Bar'
      WHEN tc.code = 'LAUNDRY' THEN 'Laundry'
      WHEN tc.code = 'PHONE' THEN 'Telephone'
      WHEN tc.code = 'INET' THEN 'Internet'
      WHEN tc.code = 'SPA' THEN 'Spa & Wellness'
      WHEN tc.code = 'PARK' THEN 'Parking'
      WHEN tc.code = 'MISC' THEN 'Miscellaneous'
      WHEN tc.code = 'DAMAGE' THEN 'Damage Charges'
      WHEN tc.code = 'EXBED' THEN 'Extra Bed'
      ELSE 'Other Charges'
    END,
    tc.code,
    tc.description
)
SELECT
  report_date,
  category,
  tran_code,
  tran_description,
  transaction_count,
  total_amount,
  total_vat,
  total_service_charge,
  total_vatable,
  total_non_vat,
  total_amount - total_service_charge AS net_revenue
FROM daily_revenue
ORDER BY report_date DESC, category, tran_code;

-- =============================================
-- 2. PAYMENT RECONCILIATION REPORT
-- =============================================
CREATE OR REPLACE VIEW public.v_payment_reconciliation_report AS
SELECT
  DATE(fp.created_at) AS report_date,
  fp.payment_method,
  COUNT(fp.id) AS payment_count,
  SUM(fp.amount) AS total_amount,
  COUNT(CASE WHEN fp.is_voided = false THEN 1 END) AS active_payments,
  COUNT(CASE WHEN fp.is_voided = true THEN 1 END) AS voided_payments,
  SUM(CASE WHEN fp.is_voided = false THEN fp.amount ELSE 0 END) AS net_amount,
  SUM(CASE WHEN fp.is_voided = true THEN fp.amount ELSE 0 END) AS voided_amount
FROM folio_payments fp
GROUP BY DATE(fp.created_at), fp.payment_method
ORDER BY report_date DESC, payment_method;

-- =============================================
-- 3. FOLIO AGING REPORT
-- =============================================
CREATE OR REPLACE VIEW public.v_folio_aging_report AS
SELECT
  f.id AS folio_id,
  f.folio_seq,
  f.folio_number,
  r.reservation_number,
  r.room_id,
  rm.room_number,
  g.first_name || ' ' || g.last_name AS guest_name,
  g.email AS guest_email,
  g.phone AS guest_phone,
  r.check_in_date,
  r.check_out_date,
  r.rate,
  f.total_amount,
  f.paid_amount,
  f.balance,
  f.status AS folio_status,
  CASE
    WHEN f.status = 'closed' THEN 0
    WHEN r.check_out_date < CURRENT_DATE THEN 91 -- Overdue
    WHEN r.check_out_date = CURRENT_DATE THEN 90 -- Due today
    WHEN r.check_out_date = CURRENT_DATE + INTERVAL '1 day' THEN 60 -- Due tomorrow
    WHEN r.check_out_date BETWEEN CURRENT_DATE + INTERVAL '2 days' AND CURRENT_DATE + INTERVAL '7 days' THEN 30 -- Due 2-7 days
    WHEN r.check_out_date > CURRENT_DATE + INTERVAL '7 days' THEN 1 -- Future
    ELSE 0
  END AS aging_days,
  CASE
    WHEN f.status = 'closed' THEN 'Closed'
    WHEN r.check_out_date < CURRENT_DATE THEN 'Overdue'
    WHEN r.check_out_date = CURRENT_DATE THEN 'Due Today'
    WHEN r.check_out_date = CURRENT_DATE + INTERVAL '1 day' THEN 'Due Tomorrow'
    WHEN r.check_out_date BETWEEN CURRENT_DATE + INTERVAL '2 days' AND CURRENT_DATE + INTERVAL '7 days' THEN 'Due 2-7 Days'
    WHEN r.check_out_date > CURRENT_DATE + INTERVAL '7 days' THEN 'Future'
    ELSE 'Unknown'
  END AS aging_category,
  COUNT(fi.id) AS item_count,
  MAX(fi.created_at) AS last_activity,
  COUNT(fp.id) AS payment_count
FROM folios f
JOIN reservations r ON r.id = f.reservation_id
JOIN guests g ON g.id = r.guest_id
LEFT JOIN rooms rm ON rm.id = r.room_id
LEFT JOIN folio_items fi ON fi.folio_id = f.id AND fi.is_voided = false
LEFT JOIN folio_payments fp ON fp.folio_id = f.id AND fp.is_voided = false
WHERE f.deleted_at IS NULL
GROUP BY
  f.id, f.folio_seq, f.folio_number,
  r.reservation_number, r.room_id, r.check_in_date, r.check_out_date, r.rate,
  f.total_amount, f.paid_amount, f.balance, f.status,
  rm.room_number, g.first_name, g.last_name, g.email, g.phone
HAVING f.balance != 0 OR f.status = 'open'
ORDER BY r.check_out_date, f.folio_seq;

-- =============================================
-- 4. TAX INVOICE SUMMARY REPORT
-- =============================================
CREATE OR REPLACE VIEW public.v_tax_invoice_summary AS
SELECT
  ti.issue_date AS report_date,
  ti.invoice_number,
  ti.is_credit_note,
  ti.original_inv_id,
  f.folio_seq,
  f.folio_number,
  r.reservation_number,
  ba.company_name,
  ba.tax_id,
  ba.address,
  ti.subtotal,
  ti.vat_amount,
  ti.service_charge,
  ti.total_amount,
  p.full_name AS issued_by_name,
  ti.printed_at,
  ti.created_at,
  COUNT(fi.id) AS item_count
FROM tax_invoices ti
JOIN folios f ON f.id = ti.folio_id
JOIN reservations r ON r.id = ti.reservation_id
LEFT JOIN billing_addresses ba ON ba.reservation_id = r.id
LEFT JOIN profiles p ON p.id = ti.issued_by
LEFT JOIN folio_items fi ON fi.tax_inv_no = ti.invoice_number AND fi.folio_id = f.id
ORDER BY ti.issue_date DESC, ti.invoice_number DESC;

-- =============================================
-- 5. AUDIT TRAIL REPORT
-- =============================================
CREATE OR REPLACE VIEW public.v_audit_trail_report AS
SELECT
  'folio_item' AS record_type,
  fi.id AS record_id,
  fi.created_at AS timestamp,
  DATE(fi.created_at) AS report_date,
  fi.tran_code,
  fi.description,
  fi.amount,
  fi.payf,
  fi.is_voided,
  fi.voided_at,
  CASE WHEN fi.is_voided = true THEN 'VOIDED'
       WHEN fi.payf = 'P' THEN 'PAID'
       WHEN fi.payf = 'C' THEN 'CREDITED'
       ELSE 'ACTIVE' END AS status,
  fi.shift_code,
  u1.full_name AS posted_by_name,
  u2.full_name AS voided_by_name,
  fi.remark,
  f.folio_seq,
  f.folio_number,
  r.reservation_number,
  rm.room_number,
  g.first_name || ' ' || g.last_name AS guest_name
FROM folio_items fi
JOIN folios f ON f.id = fi.folio_id
JOIN reservations r ON r.id = f.reservation_id
LEFT JOIN rooms rm ON rm.id = r.room_id
JOIN guests g ON g.id = r.guest_id
LEFT JOIN profiles u1 ON u1.id = fi.posted_by
LEFT JOIN profiles u2 ON u2.id = fi.voided_by
WHERE fi.deleted_at IS NULL

UNION ALL

SELECT
  'folio_payment' AS record_type,
  fp.id AS record_id,
  fp.created_at AS timestamp,
  DATE(fp.created_at) AS report_date,
  fp.tran_code,
  fp.payment_method AS description,
  fp.amount,
  NULL::TEXT AS payf,
  fp.is_voided,
  fp.voided_at,
  CASE WHEN fp.is_voided = true THEN 'VOIDED' ELSE 'ACTIVE' END AS status,
  fp.shift_code,
  u1.full_name AS posted_by_name,
  u2.full_name AS voided_by_name,
  fp.notes AS remark,
  f.folio_seq,
  f.folio_number,
  r.reservation_number,
  rm.room_number,
  g.first_name || ' ' || g.last_name AS guest_name
FROM folio_payments fp
JOIN folios f ON f.id = fp.folio_id
JOIN reservations r ON r.id = f.reservation_id
LEFT JOIN rooms rm ON rm.id = r.room_id
JOIN guests g ON g.id = r.guest_id
LEFT JOIN profiles u1 ON u1.id = fp.created_by
LEFT JOIN profiles u2 ON u2.id = fp.voided_by
WHERE fp.deleted_at IS NULL

ORDER BY timestamp DESC;

-- =============================================
-- 6. SHIFT SUMMARY REPORT
-- =============================================
CREATE OR REPLACE VIEW public.v_shift_summary_report AS
SELECT
  s.shift_date AS report_date,
  s.shift_code,
  s.shift_type,
  s.status,
  s.start_time,
  s.end_time,
  p.full_name AS cashier_name,
  s.total_cash,
  s.total_cards,
  s.total_transfers,
  s.total_ar,
  s.total_revenue,
  s.total_vat,
  s.total_service_charge,
  s.room_count,
  s.checkout_count,
  s.checkin_count,
  s.notes,
  s.closed_at,
  s.closed_by
FROM shifts s
LEFT JOIN profiles p ON p.id = s.cashier_id
ORDER BY s.shift_date DESC, s.shift_type, s.shift_code;

-- =============================================
-- 7. ROOM REVENUE BY ROOM TYPE
-- =============================================
CREATE OR REPLACE VIEW public.v_room_revenue_by_type AS
SELECT
  DATE(fi.created_at) AS report_date,
  rt.code AS room_type_code,
  rt.name AS room_type_name,
  rt.base_price,
  COUNT(DISTINCT r.room_id) AS rooms_occupied,
  COUNT(fi.id) AS charge_count,
  SUM(fi.amount) AS total_revenue,
  SUM(fi.vat_amount) AS total_vat,
  SUM(fi.service_amount) AS total_service_charge,
  AVG(fi.amount) AS avg_charge
FROM folio_items fi
JOIN folios f ON f.id = fi.folio_id
JOIN reservations r ON r.id = f.reservation_id
JOIN rooms rm ON rm.id = r.room_id
JOIN room_types rt ON rt.id = rm.room_type_id
WHERE fi.tran_code = 'ROOM'
  AND fi.is_voided = false
  AND fi.payf NOT IN ('W')
GROUP BY DATE(fi.created_at), rt.code, rt.name, rt.base_price
ORDER BY report_date DESC, rt.code;

-- =============================================
-- 8. MONTHLY REVENUE SUMMARY
-- =============================================
CREATE OR REPLACE VIEW public.v_monthly_revenue_summary AS
SELECT
  DATE_TRUNC('month', fi.created_at) AS report_month,
  CASE
    WHEN tc.code = 'ROOM' THEN 'Room Revenue'
    WHEN tc.code IN ('BREAK', 'LUNCH', 'DINNER') THEN 'Food & Beverage'
    WHEN tc.code = 'MINIBAR' THEN 'Mini Bar'
    WHEN tc.code = 'LAUNDRY' THEN 'Laundry'
    WHEN tc.code = 'PHONE' THEN 'Telephone'
    WHEN tc.code = 'INET' THEN 'Internet'
    WHEN tc.code = 'SPA' THEN 'Spa & Wellness'
    WHEN tc.code = 'PARK' THEN 'Parking'
    WHEN tc.code = 'MISC' THEN 'Miscellaneous'
    ELSE 'Other Charges'
  END AS category,
  COUNT(fi.id) AS transaction_count,
  SUM(fi.amount) AS total_amount,
  SUM(fi.vat_amount) AS total_vat,
  SUM(fi.service_amount) AS total_service_charge,
  SUM(fi.amount) - SUM(fi.service_charge) AS net_revenue,
  COUNT(DISTINCT f.id) AS unique_folios,
  COUNT(DISTINCT r.id) AS unique_reservations
FROM folio_items fi
JOIN revenue_transaction_codes tc ON tc.code = fi.tran_code
JOIN folios f ON f.id = fi.folio_id
JOIN reservations r ON r.id = f.reservation_id
WHERE fi.is_voided = false
  AND fi.payf NOT IN ('W')
GROUP BY
  DATE_TRUNC('month', fi.created_at),
  CASE
    WHEN tc.code = 'ROOM' THEN 'Room Revenue'
    WHEN tc.code IN ('BREAK', 'LUNCH', 'DINNER') THEN 'Food & Beverage'
    WHEN tc.code = 'MINIBAR' THEN 'Mini Bar'
    WHEN tc.code = 'LAUNDRY' THEN 'Laundry'
    WHEN tc.code = 'PHONE' THEN 'Telephone'
    WHEN tc.code = 'INET' THEN 'Internet'
    WHEN tc.code = 'SPA' THEN 'Spa & Wellness'
    WHEN tc.code = 'PARK' THEN 'Parking'
    WHEN tc.code = 'MISC' THEN 'Miscellaneous'
    ELSE 'Other Charges'
  END
ORDER BY report_month DESC, category;

-- =============================================
-- 9. DEPARTMENT REVENUE REPORT
-- =============================================
CREATE OR REPLACE VIEW public.v_department_revenue_report AS
SELECT
  DATE(fi.created_at) AS report_date,
  d.name AS department_name,
  d.code AS department_code,
  COUNT(fi.id) AS transaction_count,
  SUM(fi.amount) AS total_amount,
  SUM(fi.vat_amount) AS total_vat,
  SUM(fi.service_amount) AS total_service_charge,
  SUM(fi.vatable_amount) AS total_vatable,
  SUM(fi.non_vat_amount) AS total_non_vat
FROM folio_items fi
JOIN revenue_transaction_codes tc ON tc.code = fi.tran_code
LEFT JOIN departments d ON d.id = tc.department_id
WHERE fi.is_voided = false
  AND fi.payf NOT IN ('W')
GROUP BY DATE(fi.created_at), d.name, d.code
ORDER BY report_date DESC, d.name;

-- =============================================
-- 10. GUEST ACCOUNT STATEMENT
-- =============================================
CREATE OR REPLACE VIEW public.v_guest_account_statement AS
SELECT
  r.reservation_number,
  g.first_name || ' ' || g.last_name AS guest_name,
  g.email,
  rm.room_number,
  r.check_in_date,
  r.check_out_date,
  f.folio_seq,
  f.folio_number,
  'CHARGE' AS transaction_type,
  fi.tran_code,
  fi.description,
  fi.amount,
  fi.vat_amount,
  fi.service_amount,
  fi.payf,
  fi.is_voided,
  fi.created_at AS transaction_date,
  CASE WHEN fi.is_voided = true THEN -fi.amount ELSE fi.amount END AS net_amount
FROM folio_items fi
JOIN folios f ON f.id = fi.folio_id
JOIN reservations r ON r.id = f.reservation_id
JOIN guests g ON g.id = r.guest_id
LEFT JOIN rooms rm ON rm.id = r.room_id
WHERE fi.deleted_at IS NULL

UNION ALL

SELECT
  r.reservation_number,
  g.first_name || ' ' || g.last_name AS guest_name,
  g.email,
  rm.room_number,
  r.check_in_date,
  r.check_out_date,
  f.folio_seq,
  f.folio_number,
  'PAYMENT' AS transaction_type,
  fp.tran_code,
  fp.payment_method AS description,
  -fp.amount AS amount,
  0 AS vat_amount,
  0 AS service_amount,
  NULL::TEXT AS payf,
  fp.is_voided,
  fp.created_at AS transaction_date,
  CASE WHEN fp.is_voided = true THEN fp.amount ELSE -fp.amount END AS net_amount
FROM folio_payments fp
JOIN folios f ON f.id = fp.folio_id
JOIN reservations r ON r.id = f.reservation_id
JOIN guests g ON g.id = r.guest_id
LEFT JOIN rooms rm ON rm.id = r.room_id
WHERE fp.deleted_at IS NULL

ORDER BY r.reservation_number, f.folio_seq, transaction_date;

-- =============================================
-- Done: Schema V10 Reports
-- =============================================
