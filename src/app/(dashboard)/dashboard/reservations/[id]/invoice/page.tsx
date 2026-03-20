import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Printer, MapPin, Building2, Phone } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function InvoicePage({ params }: { params: { id: string } }) {
    const supabase = await createClient()

    // Fetch the Reservation Details
    const { data: reservation, error: resvError } = await supabase
        .from('reservations')
        .select(`
            *,
            profiles:guest_id (*),
            room:room_id (room_number),
            room_type:room_type_id (name)
        `)
        .eq('id', params.id)
        .single()

    if (resvError || !reservation) {
        return <div className="p-8 text-rose-500">Error loading reservation.</div>
    }

    // Fetch the Folio associated with this reservation
    const { data: folio, error: folioError } = await supabase
        .from('folios')
        .select('*')
        .eq('reservation_id', params.id)
        .single()

    let transactions: any[] = []
    if (folio) {
        const { data: txs } = await supabase
            .from('folio_transactions')
            .select('*')
            .eq('folio_id', folio.id)
            .order('posted_at', { ascending: true })
        if (txs) transactions = txs
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(val || 0)
    }

    // Grouping for Net/Tax display block (simulating KFO Tax breakdown)
    const totalCharges = transactions.reduce((acc, t) => acc + (t.transaction_type !== 'payment' ? Number(t.amount) : 0), 0)
    const totalPayments = transactions.reduce((acc, t) => acc + (t.transaction_type === 'payment' ? Number(t.amount) : 0), 0)
    const netRevenue = transactions.reduce((acc, t) => acc + (t.transaction_type === 'room_charge' || t.transaction_type === 'service' ? Number(t.net_amount) : 0), 0)
    const totalVAT = transactions.reduce((acc, t) => acc + Number(t.tax_amount || 0), 0)
    const balanceDue = totalCharges + totalPayments // Payments are negatively stored

    return (
        <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
            {/* Print Action Bar - Hidden during actual printing */}
            <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
                <Link href={`/dashboard/reservations/${reservation.reservation_number}`} className="text-sm text-slate-500 hover:text-indigo-600">
                    &larr; Back to Reservation
                </Link>
                <button
                    onClick={() => {
                        window.print()
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium"
                >
                    <Printer className="w-4 h-4" />
                    Print Folio
                </button>
            </div>

            {/* A4 Document Paper Wrapper */}
            <div className="max-w-4xl mx-auto bg-white shadow-xl min-h-[1056px] mx-auto p-12 print:shadow-none print:p-0">

                {/* Header Section */}
                <div className="flex justify-between items-start border-b-2 border-slate-200 pb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase flex items-center gap-3">
                            <Building2 className="w-8 h-8 text-indigo-600" />
                            Oceanview Resort & Spa
                        </h1>
                        <div className="mt-4 text-sm text-slate-500 flex flex-col gap-1">
                            <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> 123 Resort Boulevard, Coastal District, 10200</span>
                            <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> +66 2 123 4567 | accounts@oceanview.com</span>
                            <span className="mt-1 font-mono text-xs">TAX ID: 0105559000001</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-light text-slate-300 uppercase tracking-widest mb-4">Invoice</div>
                        <div className="text-sm text-slate-600 space-y-1">
                            <div className="flex justify-between gap-8">
                                <span className="font-medium">Folio No:</span>
                                <span className="font-mono">{folio?.folio_number || 'PENDING'}</span>
                            </div>
                            <div className="flex justify-between gap-8">
                                <span className="font-medium">Date Issued:</span>
                                <span>{format(new Date(), 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="flex justify-between gap-8">
                                <span className="font-medium">Page:</span>
                                <span>1 of 1</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Guest Information */}
                <div className="flex justify-between items-start py-8">
                    <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg min-w-[300px]">
                        <div className="text-xs text-slate-500 font-bold uppercase mb-2">Billed To</div>
                        <div className="text-lg font-bold text-slate-900">{reservation.profiles?.full_name}</div>
                        <div className="text-sm text-slate-600 mt-1">{reservation.profiles?.email || 'No email provided'}</div>
                        <div className="text-sm text-slate-600">{reservation.profiles?.phone || 'No phone provided'}</div>
                    </div>

                    <div className="text-sm  space-y-2">
                        <div className="flex justify-between gap-8 border-b pb-1">
                            <span className="text-slate-500 font-medium">Reservation No:</span>
                            <span className="font-mono font-bold">{reservation.reservation_number}</span>
                        </div>
                        <div className="flex justify-between gap-8 border-b pb-1">
                            <span className="text-slate-500 font-medium">Room Number:</span>
                            <span className="font-bold">{reservation.room?.room_number || 'Unassigned'}</span>
                        </div>
                        <div className="flex justify-between gap-8 border-b pb-1">
                            <span className="text-slate-500 font-medium">Arrival:</span>
                            <span>{format(new Date(reservation.check_in_date), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex justify-between gap-8">
                            <span className="text-slate-500 font-medium">Departure:</span>
                            <span>{format(new Date(reservation.check_out_date), 'dd/MM/yyyy')}</span>
                        </div>
                    </div>
                </div>

                {/* Ledger / Transactions Table */}
                <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Code</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3 text-right">Charges</th>
                                <th className="px-6 py-3 text-right">Payments</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="text-slate-700">
                                    <td className="px-6 py-3 whitespace-nowrap">
                                        {format(new Date(tx.posted_at), 'dd/MM/yy HH:mm')}
                                    </td>
                                    <td className="px-6 py-3 font-mono text-xs text-slate-500 uppercase">
                                        {tx.transaction_type}
                                    </td>
                                    <td className="px-6 py-3">
                                        {tx.description}
                                        {tx.is_tax && <span className="ml-2 text-[10px] bg-slate-100 px-1 rounded text-slate-500 border">TAX ITEM</span>}
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium text-slate-900">
                                        {tx.transaction_type !== 'payment' ? formatCurrency(tx.amount) : ''}
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium text-slate-900">
                                        {tx.transaction_type === 'payment' ? formatCurrency(Math.abs(tx.amount)) : ''}
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                                        No transactions posted to this folio yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Folio Summary Mathematics */}
                <div className="mt-8 flex justify-end">
                    <div className="w-80 space-y-3">
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Total Charges:</span>
                            <span>{formatCurrency(totalCharges)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Total Payments:</span>
                            <span>{formatCurrency(Math.abs(totalPayments))}</span>
                        </div>
                        <hr className="border-slate-200" />

                        {/* VAT/Tax Breakdown matching KFO math */}
                        <div className="flex justify-between text-xs text-slate-400 pt-2">
                            <span>Net Revenue (Exc. Tax):</span>
                            <span>{formatCurrency(netRevenue)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>VAT (7% Included):</span>
                            <span>{formatCurrency(totalVAT)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 pb-2 border-b border-slate-200">
                            <span>Service Charge (10%):</span>
                            <span>{formatCurrency(0)} {/* Stub for Phase 7 SC rules if needed */}</span>
                        </div>

                        {/* Grand Total */}
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-lg font-bold text-slate-900 flex flex-col">
                                Balance Due
                                <span className="text-[10px] font-normal text-slate-400">All prices include VAT</span>
                            </span>
                            <span className={`text-2xl font-black ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {formatCurrency(balanceDue)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Signatures */}
                <div className="mt-32 flex justify-between px-12 pb-12">
                    <div className="text-center">
                        <div className="border-b border-slate-400 w-48 mb-2"></div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Guest Signature</div>
                    </div>
                    <div className="text-center">
                        <div className="border-b border-slate-400 w-48 mb-2"></div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Cashier</div>
                    </div>
                </div>

            </div>
        </div>
    )
}
