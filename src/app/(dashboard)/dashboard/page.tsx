import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    BedDouble,
    DoorOpen,
    Users,
    Building2,
    ArrowUpRight,
    TrendingUp,
    CheckCircle2,
    Wrench,
    LogIn,
    LogOut,
    DollarSign,
    CalendarDays,
    ClipboardList,
    PlusCircle,
} from 'lucide-react'
import Link from 'next/link'

interface StatCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ReactNode
    trend?: string
    color: string
}

function StatCard({ title, value, subtitle, icon, trend, color }: StatCardProps) {
    return (
        <Card className="relative overflow-hidden border-slate-200 hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-500">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-slate-900">{value}</p>
                            {trend && (
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-xs">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    {trend}
                                </Badge>
                            )}
                        </div>
                        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

interface QuickNavCardProps {
    title: string
    description: string
    href: string
    icon: React.ReactNode
}

function QuickNavCard({ title, description, href, icon }: QuickNavCardProps) {
    return (
        <Link href={href}>
            <Card className="group cursor-pointer border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                                {icon}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{title}</p>
                                <p className="text-xs text-slate-400">{description}</p>
                            </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

export default async function DashboardPage() {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const [
        roomsResult, availableResult, occupiedResult, maintenanceResult,
        usersResult, buildingsResult,
        arrivalsResult, departuresResult, revenueResult
    ] = await Promise.all([
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).in('status', ['available', 'clean']),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).in('status', ['maintenance', 'out_of_order']),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('buildings').select('*', { count: 'exact', head: true }),
        // Today arrivals: reserved, checking in today
        supabase.from('reservations').select('*', { count: 'exact', head: true })
            .eq('check_in_date', today).eq('status', 'reserved'),
        // Today departures: checked in, leaving today
        supabase.from('reservations').select('*', { count: 'exact', head: true })
            .eq('check_out_date', today).eq('status', 'checked_in'),
        // Revenue today
        supabase.from('folios').select('total_amount')
            .eq('status', 'closed')
            .gte('updated_at', `${today}T00:00:00`)
            .lte('updated_at', `${today}T23:59:59`),
    ])

    const totalRooms = roomsResult.count || 0
    const availableRooms = availableResult.count || 0
    const occupiedRooms = occupiedResult.count || 0
    const maintenanceRooms = maintenanceResult.count || 0
    const totalUsers = usersResult.count || 0
    const totalBuildings = buildingsResult.count || 0
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
    const todayArrivals = arrivalsResult.count || 0
    const todayDepartures = departuresResult.count || 0
    const todayRevenue = (revenueResult.data || []).reduce((sum, f) => sum + Number(f.total_amount), 0)

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Hotel property overview • {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {/* Today's Operations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="Today Arrivals"
                    value={todayArrivals}
                    subtitle="Expected check-ins today"
                    icon={<LogIn className="w-6 h-6 text-blue-600" />}
                    color="bg-blue-50"
                />
                <StatCard
                    title="Today Departures"
                    value={todayDepartures}
                    subtitle="Expected check-outs today"
                    icon={<LogOut className="w-6 h-6 text-orange-600" />}
                    color="bg-orange-50"
                />
                <StatCard
                    title="Revenue Today"
                    value={`฿${todayRevenue.toLocaleString()}`}
                    subtitle="From closed folios"
                    icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
                    color="bg-emerald-50"
                />
            </div>

            {/* Room Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Rooms"
                    value={totalRooms}
                    subtitle={`Across ${totalBuildings} buildings`}
                    icon={<BedDouble className="w-6 h-6 text-indigo-600" />}
                    color="bg-indigo-50"
                />
                <StatCard
                    title="Available"
                    value={availableRooms}
                    subtitle="Ready for check-in"
                    icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                    color="bg-emerald-50"
                    trend={`${100 - occupancyRate}%`}
                />
                <StatCard
                    title="Occupied"
                    value={occupiedRooms}
                    subtitle={`${occupancyRate}% occupancy`}
                    icon={<DoorOpen className="w-6 h-6 text-amber-600" />}
                    color="bg-amber-50"
                />
                <StatCard
                    title="Maintenance"
                    value={maintenanceRooms}
                    subtitle="Under maintenance"
                    icon={<Wrench className="w-6 h-6 text-red-500" />}
                    color="bg-red-50"
                />
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Users" value={totalUsers} subtitle="System users" icon={<Users className="w-6 h-6 text-violet-600" />} color="bg-violet-50" />
                <StatCard title="Buildings" value={totalBuildings} subtitle="Property buildings" icon={<Building2 className="w-6 h-6 text-cyan-600" />} color="bg-cyan-50" />
                <StatCard title="Occupancy Rate" value={`${occupancyRate}%`} subtitle="Current occupancy" icon={<TrendingUp className="w-6 h-6 text-emerald-600" />} color="bg-emerald-50" />
            </div>

            {/* Quick Navigation */}
            <div>
                <CardHeader className="px-0">
                    <CardTitle className="text-lg font-semibold text-slate-800">Quick Actions</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <QuickNavCard title="New Booking" description="Create a reservation" href="/dashboard/reservations/new" icon={<PlusCircle className="w-5 h-5 text-indigo-500" />} />
                    <QuickNavCard title="Reservations" description="View all bookings" href="/dashboard/reservations" icon={<ClipboardList className="w-5 h-5 text-blue-500" />} />
                    <QuickNavCard title="Calendar" description="Room availability grid" href="/dashboard/calendar" icon={<CalendarDays className="w-5 h-5 text-emerald-500" />} />
                    <QuickNavCard title="Rooms" description="Room inventory" href="/dashboard/master/rooms" icon={<DoorOpen className="w-5 h-5 text-amber-500" />} />
                </div>
            </div>
        </div>
    )
}
