-- ==========================================
-- Phase 5: Daily Revenue Summary View
-- Replicates the Legacy KFO "Manager Report"
-- ==========================================

CREATE OR REPLACE VIEW daily_revenue_summary AS
WITH daily_transactions AS (
    SELECT 
        DATE(posted_at) as revenue_date,
        transaction_type,
        SUM(amount) as net_amount,
        SUM(tax_amount) as tax_amount,
        SUM(service_charge) as service_charge,
        SUM(total_amount) as gross_amount
    FROM 
        folio_transactions
    WHERE 
        -- Only count actual debits as revenue (charges)
        transaction_type IN ('room_charge', 'service') 
        -- Ignore raw taxes and payments as they are balance sheet items, not revenue categories directly, but tax_amount generated from room_charge is captured above 
    GROUP BY 
        DATE(posted_at),
        transaction_type
),
payments_summary AS (
    SELECT 
        DATE(posted_at) as revenue_date,
        'payment_collected' as transaction_type,
        0 as net_amount,
        0 as tax_amount,
        0 as service_charge,
        SUM(amount) as gross_amount -- Payments are logged as Credits (negative), but we sum absolute for reporting collection
    FROM 
        folio_transactions
    WHERE 
        transaction_type = 'payment'
    GROUP BY 
        DATE(posted_at)
)
SELECT * FROM daily_transactions
UNION ALL
SELECT * FROM payments_summary
ORDER BY revenue_date DESC, transaction_type ASC;

COMMENT ON VIEW daily_revenue_summary IS 'Aggregates folio transactions by date and type to support the Daily Manager Revenue Report.';

-- ==========================================
-- Trial Balance (Credits vs Debits) View
-- ==========================================
CREATE OR REPLACE VIEW trial_balance_report AS
SELECT 
    gl.account_type,
    gl.account_code,
    gl.account_name,
    SUM(ap.debit_amount) as total_debit,
    SUM(ap.credit_amount) as total_credit,
    SUM(ap.debit_amount - ap.credit_amount) as net_balance
FROM 
    chart_of_accounts gl
LEFT JOIN 
    account_postings ap ON gl.id = ap.account_id
GROUP BY 
    gl.account_type, gl.account_code, gl.account_name
ORDER BY 
    gl.account_type DESC, gl.account_code ASC;

-- ==========================================
-- Guest Ledger View (In-house Folio Balances)
-- ==========================================
CREATE OR REPLACE VIEW guest_ledger_report AS
SELECT 
    f.id as folio_id,
    f.folio_number,
    r.reservation_number,
    p.full_name as guest_name,
    rm.room_number,
    r.check_in_date,
    r.check_out_date,
    SUM(ft.amount) as room_charges,
    SUM(ft.tax_amount) as taxes,
    SUM(ft.service_charge) as service_charges,
    SUM(ft.total_amount) as total_charges,
    (SELECT SUM(amount) FROM folio_transactions WHERE transaction_type = 'payment' AND folio_id = f.id) as payments,
    f.balance as current_balance
FROM 
    folios f
JOIN 
    reservations r ON f.reservation_id = r.id
JOIN 
    profiles p ON r.guest_id = p.id
JOIN 
    rooms rm ON r.room_id = rm.id
LEFT JOIN 
    folio_transactions ft ON f.id = ft.folio_id AND ft.transaction_type IN ('room_charge', 'service')
WHERE 
    f.status = 'open' AND r.status IN ('checked_in', 'checked_out')
GROUP BY 
    f.id, f.folio_number, r.reservation_number, p.full_name, rm.room_number, r.check_in_date, r.check_out_date, f.balance
ORDER BY 
    rm.room_number ASC;

-- ==========================================
-- Aging Report View (City Ledger Overdue Accounts)
-- ==========================================
CREATE OR REPLACE VIEW aging_report AS
SELECT 
    f.id as folio_id,
    f.folio_number,
    p.full_name as account_name,
    f.closed_at,
    f.balance as outstanding_amount,
    CURRENT_DATE - DATE(f.closed_at) as days_overdue,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) <= 30 THEN f.balance ELSE 0 END as current_30,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) > 30 AND CURRENT_DATE - DATE(f.closed_at) <= 60 THEN f.balance ELSE 0 END as days_31_60,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) > 60 AND CURRENT_DATE - DATE(f.closed_at) <= 90 THEN f.balance ELSE 0 END as days_61_90,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) > 90 THEN f.balance ELSE 0 END as days_over_90
FROM 
    folios f
JOIN 
    reservations r ON f.reservation_id = r.id
JOIN 
    profiles p ON r.guest_id = p.id
WHERE 
    f.status = 'closed' AND f.balance > 0
ORDER BY 
    days_overdue DESC;
