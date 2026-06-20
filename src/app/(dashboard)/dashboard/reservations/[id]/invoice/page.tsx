import { createClient } from '@/lib/supabase/server'
import { Printer, MapPin, Building2, Phone, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function InvoicePage({ params }: { params: { id: string } }) {
    const supabase = await createClient()

    // Fetch property info for hotel header
    const { data: property } = await supabase
        .from('properties')
        .select('name, address, timezone, phone, tax_id, email')
        .eq('code', 'MAIN')
        .single()

    const hotelName = property?.name || 'Hotel Property'
    const hotelAddress = property?.address || ''
    const hotelPhone = property?.phone || '+66 2 123 4567'
    const hotelTaxId = property?.tax_id || '0105559000001'
    const hotelEmail = property?.email || 'accounts@hotel.com'

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
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center" role="alert">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center" aria-hidden="true">
                        <Printer className="w-8 h-8 text-rose-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-800 mb-2">ไม่พบใบแจ้งหนี้</h2>
                    <p className="text-sm text-slate-600 mb-2">The invoice for this reservation could not be loaded.</p>
                    <p className="text-xs text-slate-600 mb-6">{resvError?.message || 'The reservation may have been deleted or the ID is incorrect.'}</p>
                    <Link href="/dashboard/reservations" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Reservations
                    </Link>
                </div>
            </div>
        )
    }

    // Fetch the Folio associated with this reservation
    const { data: folio } = await supabase
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
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val || 0)
    }

    const totalCharges = transactions.reduce((acc, t) => acc + (t.transaction_type !== 'payment' ? Number(t.amount) : 0), 0)
    const totalPayments = transactions.reduce((acc, t) => acc + (t.transaction_type === 'payment' ? Number(t.amount) : 0), 0)
    const netRevenue = transactions.reduce((acc, t) => acc + (t.transaction_type === 'room_charge' || t.transaction_type === 'service' ? Number(t.net_amount || 0) : 0), 0)
    const totalVAT = transactions.reduce((acc, t) => acc + Number(t.tax_amount || 0), 0)
    const totalServiceCharge = transactions.reduce((acc, t) => acc + Number(t.service_charge || 0), 0)
    const balanceDue = folio?.balance ?? (totalCharges + totalPayments)

    return (
        <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
            {/* Print Action Bar */}
            <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
                <Link href={`/dashboard/reservations/${reservation.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Reservation
                </Link>
                <button
                    onClick={() => window.print()}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-sm hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors"
                >
                    <Printer className="w-4 h-4" />
                    Print Folio
                </button>
            </div>

            {/* A4 Document */}
            <div className="max-w-4xl mx-auto bg-white shadow-xl min-h-[1056px] p-12 print:shadow-none print:p-0">

                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-200 pb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center print:bg-slate-800">
                                <Building2 className="w-6 h-6 text-white" />
                            </div>
                            {hotelName}
                        </h1>
                        <div className="mt-4 text-sm text-slate-600 flex flex-col gap-1">
                            {hotelAddress && (
                                <span className="flex items-center gap-2"><MapPin className="w-4 h-4" />{hotelAddress}</span>
                            )}
                            <span className="flex items-center gap-2"><Phone className="w-4 h-4" />{hotelPhone} | {hotelEmail}</span>
                            <span className="mt-1 font-mono text-xs">TAX ID: {hotelTaxId}</span>
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
                        <div className="text-xs text-slate-600 font-bold uppercase tracking-wide mb-2">Billed To</div>
                        <div className="text-lg font-bold text-slate-900">{reservation.profiles?.full_name}</div>
                        <div className="text-sm text-slate-600 mt-1">{reservation.profiles?.email || '—'}</div>
                        <div className="text-sm text-slate-600">{reservation.profiles?.phone || '—'}</div>
                    </div>

                    <div className="text-sm space-y-2">
                        <div className="flex justify-between gap-8 border-b pb-1">
                            <span className="text-slate-600 font-medium">Reservation No:</span>
                            <span className="font-mono font-bold">{reservation.reservation_number}</span>
                        </div>
                        <div className="flex justify-between gap-8 border-b pb-1">
                            <span className="text-slate-600 font-medium">Room Number:</span>
                            <span className="font-bold">{reservation.room?.room_number || 'Unassigned'}</span>
                        </div>
                        <div className="flex justify-between gap-8 border-b pb-1">
                            <span className="text-slate-600 font-medium">Arrival:</span>
                            <span>{format(new Date(reservation.check_in_date), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex justify-between gap-8">
                            <span className="text-slate-600 font-medium">Departure:</span>
                            <span>{format(new Date(reservation.check_out_date), 'dd/MM/yyyy')}</span>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wide">
                            <tr>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Code</th>
                                <th scope="col" className="px-6 py-3">Description</th>
                                <th scope="col" className="px-6 py-3 text-right">Charges</th>
                                <th scope="col" className="px-6 py-3 text-right">Payments</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="text-slate-700">
                                    <th scope="row" className="px-6 py-3 whitespace-nowrap text-xs font-normal">
                                        {format(new Date(tx.posted_at), 'dd/MM/yy HH:mm')}
                                    </th>
                                    <td className="px-6 py-3 font-mono text-xs text-slate-600 uppercase">
                                        {tx.transaction_type}
                                    </td>
                                    <td className="px-6 py-3 max-w-xs truncate">
                                        {tx.description}
                                        {tx.is_tax && (
                                            <span className="ml-2 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">TAX</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium tabular-nums">
                                        {tx.transaction_type !== 'payment' ? formatCurrency(tx.amount) : ''}
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium text-emerald-700 tabular-nums">
                                        {tx.transaction_type === 'payment' ? formatCurrency(Math.abs(tx.amount)) : ''}
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <p className="text-slate-500">No transactions posted to this folio yet.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div className="mt-8 flex justify-end">
                    <div className="w-80 space-y-3">
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Total Charges:</span>
                            <span className="tabular-nums">{formatCurrency(totalCharges)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Total Payments:</span>
                            <span className="tabular-nums text-emerald-700">{formatCurrency(Math.abs(totalPayments))}</span>
                        </div>
                        <hr className="border-slate-200" />

                        {/* VAT Breakdown */}
                        <div className="flex justify-between text-xs text-slate-600 pt-2">
                            <span>Net Revenue (Exc. Tax):</span>
                            <span className="tabular-nums">{formatCurrency(netRevenue)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600">
                            <span>VAT (7%):</span>
                            <span className="tabular-nums">{formatCurrency(totalVAT)}</span>
                        </div>
                        {totalServiceCharge > 0 && (
                            <div className="flex justify-between text-xs text-slate-600">
                                <span>Service Charge (10%):</span>
                                <span className="tabular-nums">{formatCurrency(totalServiceCharge)}</span>
                            </div>
                        )}
                        <hr className="border-slate-200" />

                        {/* Balance Due */}
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-lg font-bold text-slate-900 flex flex-col">
                                Balance Due
                                <span className="text-[10px] font-normal text-slate-500">All prices include VAT where applicable</span>
                            </span>
                            <span className={`text-2xl font-black tabular-nums ${balanceDue > 0.005 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {formatCurrency(balanceDue)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Signatures */}
                <div className="mt-32 flex justify-between px-12 pb-12">
                    <div className="text-center">
                        <div className="border-b border-slate-400 w-48 mb-2"></div>
                        <div className="text-xs text-slate-600 uppercase tracking-wider">Guest Signature</div>
                    </div>
                    <div className="text-center">
                        <div className="border-b border-slate-400 w-48 mb-2"></div>
                        <div className="text-xs text-slate-600 uppercase tracking-wider">Cashier</div>
                    </div>
                </div>

            </div>
        </div>
    )
}
