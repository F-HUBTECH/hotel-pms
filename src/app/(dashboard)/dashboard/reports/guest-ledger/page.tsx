import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { BookUser, BedDouble, Calendar, Banknote } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function GuestLedgerReportPage() {
    const supabase = await createClient()

    // Query Guest Ledger View (In-house Folio Balances)
    const { data: glData, error } = await supabase
        .from('guest_ledger_report')
        .select('*')
        .order('room_number', { ascending: true })

    if (error) {
        return <div>Error loading guest ledger: {error.message}</div>
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(val || 0)
    }

    let totalCharges = 0
    let totalPayments = 0
    let totalOutstanding = 0

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BookUser className="w-6 h-6 text-indigo-500" />
                        Guest Ledger
                    </h1>
                    <p className="text-slate-500 mt-1">Live tracking of active in-house reservations and their outstanding folio balances</p>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Room</th>
                                <th className="px-6 py-4 font-medium">Guest Name</th>
                                <th className="px-6 py-4 font-medium">Folio / Resv #</th>
                                <th className="px-6 py-4 font-medium">Check-In - Out</th>
                                <th className="px-6 py-4 font-medium text-right text-rose-600">Total Charges</th>
                                <th className="px-6 py-4 font-medium text-right text-emerald-600">Payments</th>
                                <th className="px-6 py-4 font-medium text-right border-l font-bold">Outstanding Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {glData?.map((row) => {
                                totalCharges += Number(row.total_charges || 0)
                                totalPayments += Number(row.payments || 0)
                                totalOutstanding += Number(row.current_balance || 0)

                                return (
                                    <tr key={row.folio_id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <BedDouble className="w-4 h-4 text-slate-400" />
                                                {row.room_number || 'Unassigned'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {row.guest_name}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                            <Link href={`/dashboard/reservations/${row.reservation_number}`} className="hover:text-indigo-600 hover:underline">
                                                <div className="flex flex-col gap-1">
                                                    <span>F: {row.folio_number}</span>
                                                    <span>R: {row.reservation_number}</span>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />IN: {format(new Date(row.check_in_date), 'dd/MM/yy')}</div>
                                                <div className="flex items-center gap-1 text-slate-400"><Calendar className="w-3 h-3" />OUT: {format(new Date(row.check_out_date), 'dd/MM/yy')}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-rose-600 font-medium whitespace-nowrap">
                                            {formatCurrency(row.total_charges)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-600 font-medium whitespace-nowrap">
                                            {formatCurrency(row.payments)}
                                        </td>
                                        <td className="px-6 py-4 text-right border-l font-bold text-slate-900 whitespace-nowrap bg-amber-50/10">
                                            {formatCurrency(row.current_balance)}
                                        </td>
                                    </tr>
                                )
                            })}
                            {glData?.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        <Banknote className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        No active folios with outstanding balances.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {glData && glData.length > 0 && (
                            <tfoot className="bg-slate-100/50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 font-bold text-right text-slate-900 uppercase">
                                        Total Guest Ledger:
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-rose-700 whitespace-nowrap text-base">
                                        {formatCurrency(totalCharges)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-emerald-700 whitespace-nowrap text-base">
                                        {formatCurrency(totalPayments)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold border-l whitespace-nowrap text-base bg-amber-50/30 text-amber-700">
                                        {formatCurrency(totalOutstanding)} Balance
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>
        </div>
    )
}
