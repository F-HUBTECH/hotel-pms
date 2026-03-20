import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, TrendingUp, Users, DollarSign, CalendarDays, Calculator } from 'lucide-react'
import Link from 'next/link'

const reports = [
    {
        title: '30-Day Forecast',
        description: 'Predicted occupancy and revenue based on historical averages and bookings.',
        icon: TrendingUp,
        href: '/dashboard/reports/forecast',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50'
    },
    {
        title: 'Daily Revenue (Manager Report)',
        description: 'Comprehensive daily breakdown of room, F&B, and miscellaneous revenues.',
        icon: DollarSign,
        href: '/dashboard/reports/revenue',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50'
    },
    {
        title: 'Occupancy Report',
        description: 'Detailed analysis of room status, out of order, and stayovers.',
        icon: CalendarDays,
        href: '/dashboard/reports/occupancy',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
    },
    {
        title: 'Trial Balance',
        description: 'Double-entry accounting summary matching credits and debits.',
        icon: Calculator,
        href: '/dashboard/reports/trial-balance',
        color: 'text-violet-600',
        bgColor: 'bg-violet-50'
    },
    {
        title: 'Guest Ledger (Folio Balances)',
        description: 'Outstanding balances for in-house and departed guests.',
        icon: Users,
        href: '/dashboard/reports/guest-ledger',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50'
    },
    {
        title: 'Aging Report',
        description: 'Overdue City Ledger accounts organized by 30/60/90+ days.',
        icon: FileText,
        href: '/dashboard/reports/aging',
        color: 'text-rose-600',
        bgColor: 'bg-rose-50'
    }
]

export default function ReportsDashboard() {
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Business Reports</h1>
                <p className="text-slate-500">Access Key Performance Indicators and Accounting Ledgers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                    <Link key={report.title} href={report.href}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200 hover:border-indigo-300">
                            <CardHeader>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${report.bgColor}`}>
                                    <report.icon className={`w-6 h-6 ${report.color}`} />
                                </div>
                                <CardTitle className="text-lg">{report.title}</CardTitle>
                                <CardDescription>{report.description}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>

            <Card className="bg-slate-50 border-dashed border-2">
                <CardContent className="p-8 text-center text-slate-500">
                    <p>More reports from the legacy KFO system will be migrated in future updates.</p>
                </CardContent>
            </Card>
        </div>
    )
}
