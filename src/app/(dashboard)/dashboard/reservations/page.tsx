'use client'

import { useState, useEffect, useCallback } from 'react'
import { getReservations, cancelReservation, checkIn, checkOut } from '@/lib/actions/reservations'
import { formatDateShort } from '@/lib/utils/date'
import type { Reservation, ReservationStatus } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
    Plus, Search, LogIn, LogOut, Ban, Eye, Loader2,
    ChevronLeft, ChevronRight, CalendarDays, Users
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const STATUS_TABS: { label: string; value: string; count?: number; color: string }[] = [
    { label: 'All', value: '', color: 'bg-slate-100 text-slate-700' },
    { label: 'Reserved', value: 'reserved', color: 'bg-blue-100 text-blue-700' },
    { label: 'Checked In', value: 'checked_in', color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Checked Out', value: 'checked_out', color: 'bg-slate-100 text-slate-600' },
    { label: 'Cancelled', value: 'cancelled', color: 'bg-red-100 text-red-700' },
    { label: 'No Show', value: 'no_show', color: 'bg-amber-100 text-amber-700' },
]

function getStatusBadge(status: ReservationStatus) {
    const map: Record<ReservationStatus, { class: string; label: string }> = {
        reserved: { class: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Reserved' },
        checked_in: { class: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Checked In' },
        checked_out: { class: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Checked Out' },
        cancelled: { class: 'bg-red-100 text-red-700 border-red-200', label: 'Cancelled' },
        no_show: { class: 'bg-amber-100 text-amber-700 border-amber-200', label: 'No Show' },
    }
    const s = map[status]
    return <Badge variant="outline" className={`${s.class} text-xs font-medium`}>{s.label}</Badge>
}

export default function ReservationsPage() {
    const [data, setData] = useState<Reservation[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(true)
    const [actionDialog, setActionDialog] = useState<{ type: 'checkin' | 'checkout' | 'cancel'; reservation: Reservation } | null>(null)
    const [actionLoading, setActionLoading] = useState(false)
    const pageSize = 10

    const fetchData = useCallback(async () => {
        setLoading(true)
        const r = await getReservations(page, pageSize, search, statusFilter)
        setData(r.data); setTotal(r.count); setLoading(false)
    }, [page, search, statusFilter])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setPage(1) }, [search, statusFilter])

    const totalPages = Math.ceil(total / pageSize)

    const handleAction = async () => {
        if (!actionDialog) return
        setActionLoading(true)
        let result
        switch (actionDialog.type) {
            case 'checkin': result = await checkIn(actionDialog.reservation.id); break
            case 'checkout': result = await checkOut(actionDialog.reservation.id); break
            case 'cancel': result = await cancelReservation(actionDialog.reservation.id); break
        }
        setActionLoading(false)
        if (result.success) {
            const msgs = { checkin: 'Checked in successfully', checkout: 'Checked out successfully', cancel: 'Reservation cancelled' }
            toast.success(msgs[actionDialog.type])
            setActionDialog(null)
            fetchData()
        } else {
            toast.error(result.error || 'Operation failed')
        }
    }

    return (
        <div className="space-y-6">
            {/* Screen reader status announcer */}
            <div role="status" aria-live="polite" className="sr-only">
                {loading ? 'Loading reservations...' : `${total} reservations loaded`}
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Reservations</h1>
                    <p className="text-sm text-slate-600 mt-1">Manage hotel reservations and bookings</p>
                </div>
                <Link href="/dashboard/reservations/new">
                    <Button><Plus className="w-4 h-4 mr-2" />New Booking</Button>
                </Link>
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter reservations by status">
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.value}
                        role="tab"
                        aria-selected={statusFilter === tab.value}
                        aria-label={`${tab.label}${tab.count !== undefined ? ` (${tab.count})` : ''}`}
                        onClick={() => setStatusFilter(tab.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                                e.preventDefault()
                                const currentIndex = STATUS_TABS.findIndex(t => t.value === statusFilter)
                                const direction = e.key === 'ArrowRight' ? 1 : -1
                                const nextIndex = (currentIndex + direction + STATUS_TABS.length) % STATUS_TABS.length
                                setStatusFilter(STATUS_TABS[nextIndex].value)
                            }
                        }}
                        tabIndex={statusFilter === tab.value ? 0 : -1}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === tab.value ? tab.color + ' ring-2 ring-offset-1 ring-indigo-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <label htmlFor="reservation-search" className="sr-only">Search by reservation number</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                <Input
                    id="reservation-search"
                    placeholder="Search reservation number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Table — desktop */}
            <Card className="border-slate-200">
                <CardContent className="p-0">
                    {/* Desktop Table */}
                    <div className="overflow-x-auto hidden md:block">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50/80">
                                    <th scope="col" className="text-left p-4 font-semibold text-slate-600">Reservation</th>
                                    <th scope="col" className="text-left p-4 font-semibold text-slate-600">Guest</th>
                                    <th scope="col" className="text-left p-4 font-semibold text-slate-600">Room</th>
                                    <th scope="col" className="text-left p-4 font-semibold text-slate-600 hidden lg:table-cell">Dates</th>
                                    <th scope="col" className="text-left p-4 font-semibold text-slate-600">Rate</th>
                                    <th scope="col" className="text-left p-4 font-semibold text-slate-600">Status</th>
                                    <th scope="col" className="text-right p-4 font-semibold text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b" aria-hidden="true">
                                            {Array.from({ length: 7 }).map((_, j) => (
                                                <td key={j} className="p-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : data.length === 0 ? (
                                    <tr><td colSpan={7} className="p-12 text-center text-slate-500">
                                        <p className="font-medium">No reservations found</p>
                                        <p className="text-sm mt-1">Create a new booking or adjust your search filters</p>
                                    </td></tr>
                                ) : (
                                    data.map(r => {
                                        const guest = r.guest as { first_name: string; last_name: string } | undefined
                                        const room = r.room as { room_number: string } | undefined
                                        const roomType = r.room_type as { code: string; name: string } | undefined
                                        const nights = Math.max(1, Math.ceil((new Date(r.check_out_date).getTime() - new Date(r.check_in_date).getTime()) / 86400000))
                                        return (
                                            <tr key={r.id} className="border-b hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4">
                                                    <Link href={`/dashboard/reservations/${r.id}`} className="font-mono font-semibold text-primary hover:text-primary/80 text-xs">
                                                        {r.reservation_number}
                                                    </Link>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-slate-800">{guest ? `${guest.first_name} ${guest.last_name}` : '-'}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-slate-700">{room?.room_number || <span className="text-slate-500 italic">Unassigned</span>}</div>
                                                    <div className="text-xs text-slate-500">{roomType?.name}</div>
                                                </td>
                                                <td className="p-4 hidden lg:table-cell">
                                                    <div className="flex items-center gap-1.5 text-slate-600">
                                                        <CalendarDays className="w-3.5 h-3.5" />
                                                        <span className="text-xs">{formatDateShort(r.check_in_date)} — {formatDateShort(r.check_out_date)}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{nights} night{nights > 1 ? 's' : ''}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-slate-800">฿{Number(r.rate).toLocaleString()}</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" />{r.adults}A{r.children > 0 ? ` ${r.children}C` : ''}</div>
                                                </td>
                                                <td className="p-4">{getStatusBadge(r.status)}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Link href={`/dashboard/reservations/${r.id}`}>
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-primary" aria-label={`View reservation ${r.reservation_number}`}>
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        {r.status === 'reserved' && (
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-emerald-600"
                                                                aria-label={`Check in reservation ${r.reservation_number}`}
                                                                onClick={() => setActionDialog({ type: 'checkin', reservation: r })}><LogIn className="h-4 w-4" /></Button>
                                                        )}
                                                        {r.status === 'checked_in' && (
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600"
                                                                aria-label={`Check out reservation ${r.reservation_number}`}
                                                                onClick={() => setActionDialog({ type: 'checkout', reservation: r })}><LogOut className="h-4 w-4" /></Button>
                                                        )}
                                                        {['reserved', 'checked_in'].includes(r.status) && (
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600"
                                                                aria-label={`Cancel reservation ${r.reservation_number}`}
                                                                onClick={() => setActionDialog({ type: 'cancel', reservation: r })}><Ban className="h-4 w-4" /></Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="p-4 space-y-3" aria-hidden="true">
                                    <div className="flex justify-between">
                                        <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
                                    </div>
                                    <div className="h-4 w-36 bg-slate-50 rounded animate-pulse" />
                                    <div className="flex gap-2">
                                        <div className="h-8 w-8 bg-slate-50 rounded animate-pulse" />
                                        <div className="h-8 w-8 bg-slate-50 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))
                        ) : data.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <p className="font-medium">No reservations found</p>
                                <p className="text-sm mt-1">Create a new booking or adjust your search filters</p>
                            </div>
                        ) : (
                            data.map(r => {
                                const guest = r.guest as { first_name: string; last_name: string } | undefined
                                const room = r.room as { room_number: string } | undefined
                                const roomType = r.room_type as { code: string; name: string } | undefined
                                const nights = Math.max(1, Math.ceil((new Date(r.check_out_date).getTime() - new Date(r.check_in_date).getTime()) / 86400000))
                                return (
                                    <div key={r.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <Link href={`/dashboard/reservations/${r.id}`} className="font-mono font-semibold text-primary hover:text-primary/80 text-xs">
                                                    {r.reservation_number}
                                                </Link>
                                                <div className="font-medium text-slate-800 mt-1 truncate">{guest ? `${guest.first_name} ${guest.last_name}` : '—'}</div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                                                    <span>{room?.room_number || 'Unassigned'}{roomType?.name ? ` · ${roomType.name}` : ''}</span>
                                                    <span className="hidden sm:inline">{formatDateShort(r.check_in_date)} — {formatDateShort(r.check_out_date)}</span>
                                                    <span>{nights} night{nights > 1 ? 's' : ''}</span>
                                                    <span className="font-medium text-slate-700">฿{Number(r.rate).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                {getStatusBadge(r.status)}
                                                <div className="flex items-center gap-0.5">
                                                    <Link href={`/dashboard/reservations/${r.id}`}>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-primary" aria-label={`View reservation ${r.reservation_number}`}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    {r.status === 'reserved' && (
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-emerald-600"
                                                            aria-label={`Check in reservation ${r.reservation_number}`}
                                                            onClick={() => setActionDialog({ type: 'checkin', reservation: r })}><LogIn className="h-4 w-4" /></Button>
                                                    )}
                                                    {r.status === 'checked_in' && (
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600"
                                                            aria-label={`Check out reservation ${r.reservation_number}`}
                                                            onClick={() => setActionDialog({ type: 'checkout', reservation: r })}><LogOut className="h-4 w-4" /></Button>
                                                    )}
                                                    {['reserved', 'checked_in'].includes(r.status) && (
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600"
                                                            aria-label={`Cancel reservation ${r.reservation_number}`}
                                                            onClick={() => setActionDialog({ type: 'cancel', reservation: r })}><Ban className="h-4 w-4" /></Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <p className="text-sm text-slate-600">Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total}</p>
                            <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Action confirmation dialog */}
            <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) setActionDialog(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {actionDialog?.type === 'checkin' && 'Confirm Check-In'}
                            {actionDialog?.type === 'checkout' && 'Confirm Check-Out'}
                            {actionDialog?.type === 'cancel' && 'Cancel Reservation'}
                        </DialogTitle>
                        <DialogDescription>
                            {actionDialog?.type === 'checkin' && `Check in guest for reservation ${actionDialog.reservation.reservation_number}? Room will be marked as occupied.`}
                            {actionDialog?.type === 'checkout' && `Check out guest for reservation ${actionDialog.reservation.reservation_number}? Folio will be closed.`}
                            {actionDialog?.type === 'cancel' && `Cancel reservation ${actionDialog?.reservation.reservation_number}? Room will be released.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actionLoading}>Cancel</Button>
                        <Button
                            onClick={handleAction}
                            disabled={actionLoading}
                            variant={actionDialog?.type === 'cancel' ? 'destructive' : 'default'}
                        >
                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {actionDialog?.type === 'checkin' && 'Check In'}
                            {actionDialog?.type === 'checkout' && 'Check Out'}
                            {actionDialog?.type === 'cancel' && 'Cancel Reservation'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
