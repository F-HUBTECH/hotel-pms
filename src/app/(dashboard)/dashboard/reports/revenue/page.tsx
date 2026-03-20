import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, AreaChart, DollarSign, CalendarRange, Clock } from 'lucide-react'
import { format } from 'date-fns'

export default async function DailyRevenueReportPage() {
    const supabase = await createClient()

    // Query the daily_revenue_summary SQL View
    // Returns 30-day aggregate history
    const { data: revenueData, error } = await supabase
        .from('daily_revenue_summary')
        .select('*')
        .gte('revenue_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('revenue_date', { ascending: false })
        .order('transaction_type', { ascending: true })

    if (error) {
        return <div>Error loading revenue report: {error.message}</div>
    }

    // Grouping by Date for the Table
    const groupedByDate = revenueData?.reduce((acc: any, curr: any) => {
        const d = curr.revenue_date
        if (!acc[d]) {
            acc[d] = {
                date: d,
                room_charge: 0,
                service: 0,
                payments_collected: 0,
                taxes: 0,
                net_revenue: 0, // Debits (Charges)
                gross_revenue: 0 // Debits + Taxes
            }
        }

        if (curr.transaction_type === 'room_charge') {
            acc[d].room_charge += curr.net_amount
            acc[d].taxes += curr.tax_amount
            acc[d].net_revenue += curr.net_amount
            acc[d].gross_revenue += curr.gross_amount
        } else if (curr.transaction_type === 'service') {
            acc[d].service += curr.net_amount
            acc[d].taxes += curr.tax_amount
            acc[d].net_revenue += curr.net_amount
            acc[d].gross_revenue += curr.gross_amount
        } else if (curr.transaction_type === 'payment_collected') {
            acc[d].payments_collected += curr.gross_amount
        }

        return acc
    }, {})

    const reportRows = Object.values(groupedByDate || {}) as any[]

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(val || 0)
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <AreaChart className="w-6 h-6 text-indigo-500" />
                        Daily Revenue & Collections
                    </h1>
                    <p className="text-slate-500 mt-1">Management breakdown of generated revenue vs payments tracked</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-md border shadow-sm">
                    <CalendarRange className="w-4 h-4" />
                    Last 30 Days
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Business Date</th>
                                <th className="px-6 py-4 font-medium text-right text-indigo-600">Room Revenue</th>
                                <th className="px-6 py-4 font-medium text-right text-fuchsia-600">F&B / Services</th>
                                <th className="px-6 py-4 font-medium text-right text-rose-600">Generated Taxes</th>
                                <th className="px-6 py-4 font-medium text-right border-l font-bold">Gross Revenue</th>
                                <th className="px-6 py-4 font-medium text-right text-emerald-600 bg-emerald-50/30">Payments Collected</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {reportRows.map((row, idx) => (
                                <tr key={row.date} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            {format(new Date(row.date), 'EEE, MMM dd, yyyy')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-indigo-600 font-medium">
                                        {formatCurrency(row.room_charge)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-fuchsia-600 font-medium">
                                        {formatCurrency(row.service)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-rose-600 font-medium">
                                        {formatCurrency(row.taxes)}
                                    </td>
                                    <td className="px-6 py-4 text-right border-l font-bold text-slate-900 bg-slate-50/50">
                                        {formatCurrency(row.gross_revenue)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-emerald-600 font-bold bg-emerald-50/30">
                                        {formatCurrency(row.payments_collected)}
                                    </td>
                                </tr>
                            ))}
                            {reportRows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        No revenue data recorded in the last 30 days.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
