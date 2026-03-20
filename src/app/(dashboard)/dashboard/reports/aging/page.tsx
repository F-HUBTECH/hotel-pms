import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Landmark, ArrowRightLeft, MapPin } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import Link from 'next/link'

export default async function AgingReportPage() {
    const supabase = await createClient()

    // Query Aging Report View (City Ledger Overdue Accounts)
    const { data: agingData, error } = await supabase
        .from('aging_report')
        .select('*')
        .order('days_overdue', { ascending: false })

    if (error) {
        return <div>Error loading aging report: {error.message}</div>
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(val || 0)
    }

    let total30 = 0
    let total60 = 0
    let total90 = 0
    let totalOver90 = 0
    let totalOutstanding = 0

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Landmark className="w-6 h-6 text-indigo-500" />
                        City Ledger Aging
                    </h1>
                    <p className="text-slate-500 mt-1">Accounts Receivable tracking: Overdue corporate and direct bill accounts</p>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Account / Guest Name</th>
                                <th className="px-6 py-4 font-medium">Folio #</th>
                                <th className="px-6 py-4 font-medium">Closed Date</th>
                                <th className="px-6 py-4 font-medium text-right text-emerald-600 bg-emerald-50/10">0-30 Days</th>
                                <th className="px-6 py-4 font-medium text-right text-amber-600 bg-amber-50/10">31-60 Days</th>
                                <th className="px-6 py-4 font-medium text-right text-orange-600 bg-orange-50/10">61-90 Days</th>
                                <th className="px-6 py-4 font-medium text-right text-rose-600 bg-rose-50/30">Over 90 Days</th>
                                <th className="px-6 py-4 font-medium text-right border-l font-bold bg-slate-100/50">Total Due</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {agingData?.map((row) => {
                                total30 += Number(row.current_30 || 0)
                                total60 += Number(row.days_31_60 || 0)
                                total90 += Number(row.days_61_90 || 0)
                                totalOver90 += Number(row.days_over_90 || 0)
                                totalOutstanding += Number(row.outstanding_amount || 0)

                                return (
                                    <tr key={row.folio_id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-slate-400" />
                                                {row.account_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-indigo-600">
                                            F: {row.folio_number}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            <div className="flex flex-col">
                                                <span>{row.closed_at ? format(new Date(row.closed_at), 'MMM dd, yyyy') : 'N/A'}</span>
                                                <span className="text-xs text-rose-500 font-bold">{row.days_overdue} days ago</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-600 font-medium whitespace-nowrap bg-emerald-50/5">
                                            {formatCurrency(row.current_30)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-amber-600 font-medium whitespace-nowrap bg-amber-50/5">
                                            {formatCurrency(row.days_31_60)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-orange-600 font-medium whitespace-nowrap bg-orange-50/5">
                                            {formatCurrency(row.days_61_90)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-rose-600 font-medium whitespace-nowrap bg-rose-50/10">
                                            {formatCurrency(row.days_over_90)}
                                        </td>
                                        <td className="px-6 py-4 text-right border-l font-bold text-rose-700 whitespace-nowrap bg-slate-50/50">
                                            {formatCurrency(row.outstanding_amount)}
                                        </td>
                                    </tr>
                                )
                            })}
                            {agingData?.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <ArrowRightLeft className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        No overdue City Ledger accounts found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {agingData && agingData.length > 0 && (
                            <tfoot className="bg-slate-100/50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 font-bold text-right text-slate-900 uppercase">
                                        Grand Totals:
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-emerald-700 whitespace-nowrap text-base bg-emerald-50/20">
                                        {formatCurrency(total30)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-amber-700 whitespace-nowrap text-base bg-amber-50/20">
                                        {formatCurrency(total60)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-orange-700 whitespace-nowrap text-base bg-orange-50/20">
                                        {formatCurrency(total90)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-rose-700 whitespace-nowrap text-base bg-rose-50/40">
                                        {formatCurrency(totalOver90)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold border-l whitespace-nowrap text-base bg-slate-200">
                                        <div className="text-rose-700">
                                            {formatCurrency(totalOutstanding)} AR Balance
                                        </div>
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
