'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { Room, Reservation } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'

function addDays(date: Date, days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days); return d
}

function formatDate(d: Date) {
    return d.toISOString().split('T')[0]
}

function getDaysArray(start: Date, count: number) {
    return Array.from({ length: count }, (_, i) => addDays(start, i))
}

const STATUS_COLORS: Record<string, string> = {
    reserved: 'bg-blue-400',
    checked_in: 'bg-emerald-500',
    checked_out: 'bg-slate-300',
    cancelled: 'bg-red-300',
    no_show: 'bg-amber-400',
}

export default function CalendarPage() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [startDate, setStartDate] = useState(new Date())
    const [buildingFilter, setBuildingFilter] = useState('')
    const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const daysToShow = 14

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchData = useCallback(async () => {
        setLoading(true)
        const endDate = addDays(startDate, daysToShow)

        let roomQuery = supabase.from('rooms').select('*, room_type:room_types(id,code,name), building:buildings(id,name)').order('room_number')
        if (buildingFilter) roomQuery = roomQuery.eq('building_id', buildingFilter)

        const [roomsRes, resvRes, bldRes] = await Promise.all([
            roomQuery,
            supabase.from('reservations')
                .select('*, guest:guests(id,first_name,last_name)')
                .in('status', ['reserved', 'checked_in'])
                .lt('check_in_date', formatDate(endDate))
                .gt('check_out_date', formatDate(startDate)),
            supabase.from('buildings').select('id,name').order('name'),
        ])

        setRooms((roomsRes.data || []) as Room[])
        setReservations((resvRes.data || []) as Reservation[])
        setBuildings((bldRes.data || []) as { id: string; name: string }[])
        setLoading(false)
    }, [startDate, buildingFilter])

    useEffect(() => { fetchData() }, [fetchData])

    const days = getDaysArray(startDate, daysToShow)
    const today = formatDate(new Date())

    const getReservationForCell = (roomId: string, date: string) => {
        return reservations.find(r =>
            r.room_id === roomId &&
            r.check_in_date <= date &&
            r.check_out_date > date
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Room Calendar</h1>
                    <p className="text-sm text-slate-500 mt-1">Visual room availability grid</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Buildings" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Buildings</SelectItem>
                            {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -7))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" onClick={() => setStartDate(new Date())}><CalendarDays className="mr-2 h-4 w-4" />Today</Button>
                <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
                <span className="text-sm text-slate-500 font-medium">
                    {days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {days[days.length - 1].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-400" />Reserved</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" />Checked In</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-100 border" />Available</div>
            </div>

            {/* Calendar Grid */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">Loading calendar...</div>
                    ) : (
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="sticky left-0 z-10 bg-slate-50 p-2 text-left font-semibold text-slate-600 border-b border-r min-w-[120px]">Room</th>
                                    {days.map(d => {
                                        const ds = formatDate(d)
                                        const isToday = ds === today
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6
                                        return (
                                            <th key={ds} className={`p-1.5 text-center border-b min-w-[44px] ${isToday ? 'bg-indigo-100 font-bold text-indigo-700' : isWeekend ? 'bg-slate-100' : ''}`}>
                                                <div>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                                                <div className="text-sm">{d.getDate()}</div>
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map(room => {
                                    const rt = room.room_type as { code: string } | undefined
                                    return (
                                        <tr key={room.id} className="hover:bg-slate-50/50">
                                            <td className="sticky left-0 z-10 bg-white p-2 border-b border-r">
                                                <div className="font-semibold text-slate-700">{room.room_number}</div>
                                                <div className="text-slate-400">{rt?.code}</div>
                                            </td>
                                            {days.map(d => {
                                                const ds = formatDate(d)
                                                const isToday = ds === today
                                                const resv = getReservationForCell(room.id, ds)
                                                const guest = resv?.guest as { first_name: string; last_name: string } | undefined

                                                return (
                                                    <td key={ds} className={`border-b p-0.5 ${isToday ? 'bg-indigo-50/50' : ''}`}>
                                                        {resv ? (
                                                            <Link href={`/dashboard/reservations/${resv.id}`}>
                                                                <div className={`${STATUS_COLORS[resv.status]} rounded px-1 py-1.5 text-white text-center truncate cursor-pointer hover:opacity-90 transition-opacity`}
                                                                    title={`${guest?.first_name} ${guest?.last_name} — ${resv.reservation_number}`}>
                                                                    <div className="truncate text-[10px]">{guest?.last_name}</div>
                                                                </div>
                                                            </Link>
                                                        ) : (
                                                            <div className="h-8 rounded bg-slate-50 border border-dashed border-slate-200" />
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
