import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Scale, FileText, ArrowRightLeft } from 'lucide-react'

export default async function TrialBalanceReportPage() {
    const supabase = await createClient()

    // Query Trial Balance View
    const { data: tbData, error } = await supabase
        .from('trial_balance_report')
        .select('*')

    if (error) {
        return <div>Error loading trial balance: {error.message}</div>
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(val || 0)
    }

    let totalDebits = 0
    let totalCredits = 0

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Scale className="w-6 h-6 text-indigo-500" />
                        Trial Balance
                    </h1>
                    <p className="text-slate-500 mt-1">General Ledger summary comparing Debits against Credits to ensure balance parity</p>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Account Code</th>
                                <th className="px-6 py-4 font-medium">Account Name</th>
                                <th className="px-6 py-4 font-medium text-right text-rose-600">Debit (Charges)</th>
                                <th className="px-6 py-4 font-medium text-right text-emerald-600">Credit (Payments)</th>
                                <th className="px-6 py-4 font-medium text-right border-l">Net Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {tbData?.map((row) => {
                                totalDebits += Number(row.total_debit || 0)
                                totalCredits += Number(row.total_credit || 0)

                                return (
                                    <tr key={row.account_code} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 font-medium text-slate-500 uppercase text-xs">
                                            {row.account_type}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-indigo-600">
                                            {row.account_code}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {row.account_name}
                                        </td>
                                        <td className="px-6 py-4 text-right text-rose-600 font-medium whitespace-nowrap">
                                            {formatCurrency(row.total_debit)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-600 font-medium whitespace-nowrap">
                                            {formatCurrency(row.total_credit)}
                                        </td>
                                        <td className={`px-6 py-4 text-right border-l font-bold whitespace-nowrap ${Number(row.net_balance) === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
                                            {formatCurrency(row.net_balance)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="bg-slate-100/50 border-t-2 border-slate-200">
                            <tr>
                                <td colSpan={3} className="px-6 py-4 font-bold text-right text-slate-900 uppercase">
                                    Accounting Period Totals:
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-rose-700 whitespace-nowrap text-base">
                                    {formatCurrency(totalDebits)}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-emerald-700 whitespace-nowrap text-base">
                                    {formatCurrency(totalCredits)}
                                </td>
                                <td className="px-6 py-4 text-right font-bold border-l whitespace-nowrap text-base">
                                    <div className="flex items-center justify-end gap-2">
                                        <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                                        <span className={totalDebits === totalCredits ? 'text-emerald-600' : 'text-rose-600'}>
                                            {formatCurrency(totalDebits - totalCredits)} Balance
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Card>
        </div>
    )
}
