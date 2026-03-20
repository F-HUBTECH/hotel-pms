import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { DoorOpen, ArrowRightLeft, User, Activity } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function OccupancyReportPage() {
    const supabase = await createClient()

    // 1. Fetch Today's Room Inventory Status
    const today = new Date().toISOString().split('T')[0]

    // Manual Left Join Query to get all Rooms and their current reservation if occupied today
    const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
            id,
            room_number,
            floor_plan:floor_plans(
                id,
                name
            ),
            status,
            room_types (
                id,
                name
            )
        `)
        .order('room_number', { ascending: true })

    const { data: resvData, error: resvError } = await supabase
        .from('reservations')
        .select(`
            id,
            room_id,
            reservation_number,
            status,
            check_in_date,
            check_out_date,
            profiles:guest_id (
                first_name,
                last_name
            )
        `)
        .in('status', ['reserved', 'checked_in'])
        .lte('check_in_date', today)
        .gte('check_out_date', today)

    if (roomsError || resvError) {
        return <div>Error loading occupancy report: {roomsError?.message || resvError?.message}</div>
    }

    // Merge Room Master with Active Reservations
    const occupancyList = roomsData?.map((room: any) => {
        // Find if an active reservation occupies this room today
        const activeResv = resvData?.find(r => r.room_id === room.id)

        // Determine effective status (e.g. is it meant to be arriving today, or in-house, or vacant)
        let effectiveStatus = room.status
        if (activeResv) {
            if (activeResv.status === 'checked_in') effectiveStatus = 'occupied'
            if (activeResv.status === 'reserved' && activeResv.check_in_date === today) effectiveStatus = 'reserved_arrival'
        } else if (room.status === 'occupied') {
            // Edge case: Room is physically marked occupied but no PMS reservation matches today (early checkin/late checkout system mismatch)
            effectiveStatus = 'occupied_no_resv'
        }

        return {
            ...room,
            effectiveStatus,
            reservation: activeResv || null
        }
    })

    // KPI Counts
    const totalRooms = occupancyList?.length || 0
    const occupiedCount = occupancyList?.filter((r: any) => r.effectiveStatus === 'occupied' || r.effectiveStatus === 'occupied_no_resv').length || 0
    const reservedArrivals = occupancyList?.filter((r: any) => r.effectiveStatus === 'reserved_arrival').length || 0
    const outOfOrderCount = occupancyList?.filter((r: any) => r.effectiveStatus === 'out_of_order').length || 0
    const vacantAvailable = totalRooms - occupiedCount - outOfOrderCount

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'occupied': return 'bg-indigo-100 text-indigo-700'
            case 'occupied_no_resv': return 'bg-rose-100 text-rose-700'
            case 'reserved_arrival': return 'bg-amber-100 text-amber-700'
            case 'vacant':
            case 'available':
            case 'clean': return 'bg-emerald-100 text-emerald-700'
            case 'dirty': return 'bg-orange-100 text-orange-700'
            case 'out_of_order':
            case 'maintenance': return 'bg-slate-200 text-slate-700'
            default: return 'bg-slate-100 text-slate-700'
        }
    }

    const formatStatus = (status: string) => {
        switch (status) {
            case 'occupied': return 'Occupied (In-House)'
            case 'occupied_no_resv': return 'Occupied (System Mismatch)'
            case 'reserved_arrival': return 'Expected Arrival'
            case 'vacant':
            case 'available': return 'Vacant / Available'
            case 'clean': return 'Vacant (Clean)'
            case 'dirty': return 'Vacant (Dirty)'
            case 'out_of_order': return 'Out of Order'
            case 'maintenance': return 'Under Maintenance'
            default: return status.replace('_', ' ').toUpperCase()
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-indigo-500" />
                        Daily Occupancy Status
                    </h1>
                    <p className="text-slate-500 mt-1">Real-time breakdown of physical room conditions vs reservation system states</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-slate-900 text-white">
                    <CardContent className="p-6">
                        <div className="text-sm font-medium text-slate-400">Total Rooms</div>
                        <div className="text-3xl font-bold mt-2">{totalRooms}</div>
                    </CardContent>
                </Card>
                <Card className="bg-indigo-600 text-white">
                    <CardContent className="p-6">
                        <div className="text-sm font-medium text-indigo-200">Occupied</div>
                        <div className="text-3xl font-bold mt-2">{occupiedCount} <span className="text-sm font-normal text-indigo-200">/ {((occupiedCount / totalRooms) * 100).toFixed(1)}%</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-600 text-white">
                    <CardContent className="p-6">
                        <div className="text-sm font-medium text-emerald-200">Vacant & Ready</div>
                        <div className="text-3xl font-bold mt-2">{vacantAvailable}</div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-500 text-white">
                    <CardContent className="p-6">
                        <div className="text-sm font-medium text-amber-100">Expected Arrivals</div>
                        <div className="text-3xl font-bold mt-2">{reservedArrivals}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Room #</th>
                                <th className="px-6 py-4 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Real-time Status</th>
                                <th className="px-6 py-4 font-medium">Guest Name</th>
                                <th className="px-6 py-4 font-medium">Resv #</th>
                                <th className="px-6 py-4 font-medium">Stay Dates</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {occupancyList?.map((room: any) => (
                                <tr key={room.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-bold text-slate-900">
                                        <div className="flex items-center gap-2">
                                            <DoorOpen className="w-4 h-4 text-slate-400" />
                                            {room.room_number} <span className="text-xs text-slate-400 font-normal ml-1">{room.floor_plan?.name || ''}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-600">
                                        {room.room_types?.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(room.effectiveStatus)}`}>
                                            {formatStatus(room.effectiveStatus)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">
                                        {room.reservation ? (
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-slate-400" />
                                                {room.reservation.profiles ? `${room.reservation.profiles.first_name} ${room.reservation.profiles.last_name}` : 'Walk-in'}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-indigo-600 hover:underline">
                                        {room.reservation ? (
                                            <Link href={`/dashboard/reservations/${room.reservation.reservation_number}`}>
                                                {room.reservation.reservation_number}
                                            </Link>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                                        {room.reservation ? (
                                            <div>
                                                {format(new Date(room.reservation.check_in_date), 'dd/MM/yy')} <ArrowRightLeft className="w-3 h-3 inline mx-1 text-slate-300" /> {format(new Date(room.reservation.check_out_date), 'dd/MM/yy')}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
