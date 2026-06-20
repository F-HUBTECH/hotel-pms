'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getRooms, updateRoomStatus, moveRoom } from '@/lib/actions/rooms'
import { getReservations } from '@/lib/actions/reservations'
import { createHousekeepingTask } from '@/lib/actions/housekeeping'
import type { Room, Reservation } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BedDouble, ArrowRightLeft, Eye, Loader2, Filter,
  CheckCircle2, Clock, Wrench, Ban, LogIn,
  Calendar, Users, ChevronRight, ChevronLeft, Sparkles, Search, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { format, addDays, isSameDay, parseISO } from 'date-fns'

// ─── Status Configuration ──────────────────────────────────────────────
// Mapped to DESIGN.md semantic palette:
//   Primary (Deep Indigo) → occupied / reserved
//   Success (Emerald Moss) → available / clean
//   Warning (Amber Grain)  → dirty
//   Destructive (Red Clay) → maintenance / out_of_order

type RoomStatusKey = 'available' | 'clean' | 'occupied' | 'reserved' | 'dirty' | 'maintenance' | 'out_of_order'

interface StatusConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Tailwind classes using design-system tokens for bg + text + border */
  pill: string
  /** Icon color class */
  iconColor: string
}

const STATUS_CONFIG: Record<RoomStatusKey, StatusConfig> = {
  available: {
    label: 'VAC',
    pill: 'bg-success/10 text-success border-success/20',
    iconColor: 'text-success',
    icon: CheckCircle2,
  },
  clean: {
    label: 'CL',
    pill: 'bg-success/15 text-success border-success/30',
    iconColor: 'text-success',
    icon: CheckCircle2,
  },
  occupied: {
    label: 'OCC',
    pill: 'bg-primary/10 text-primary border-primary/20',
    iconColor: 'text-primary',
    icon: LogIn,
  },
  reserved: {
    label: 'RES',
    pill: 'bg-primary/15 text-primary border-primary/30',
    iconColor: 'text-primary',
    icon: Clock,
  },
  dirty: {
    label: 'DIR',
    pill: 'bg-warning/10 text-warning border-warning/20',
    iconColor: 'text-warning',
    icon: Sparkles,
  },
  maintenance: {
    label: 'MNT',
    pill: 'bg-destructive/10 text-destructive border-destructive/20',
    iconColor: 'text-destructive',
    icon: Wrench,
  },
  out_of_order: {
    label: 'OOO',
    pill: 'bg-destructive/15 text-destructive border-destructive/30',
    iconColor: 'text-destructive',
    icon: Ban,
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────

function calculateNights(checkIn: string, checkOut: string): number {
  const start = parseISO(checkIn)
  const end = parseISO(checkOut)
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

function isDayUse(checkIn: string, checkOut: string): boolean {
  return isSameDay(parseISO(checkIn), parseISO(checkOut))
}

function isSharedRoom(reservation: Reservation | undefined): boolean {
  if (!reservation?.share_with) return false
  return Array.isArray(reservation.share_with) && reservation.share_with.length > 0
}

function isBackToBack(roomId: string, date: Date, reservations: Reservation[]): boolean {
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)

  const checkingOut = reservations.find(r => {
    if (r.room_id !== roomId) return false
    if (['cancelled', 'no_show'].includes(r.status)) return false
    const checkOut = parseISO(r.check_out_date)
    checkOut.setHours(0, 0, 0, 0)
    return checkOut.getTime() === checkDate.getTime()
  })

  const checkingIn = reservations.find(r => {
    if (r.room_id !== roomId) return false
    if (['cancelled', 'no_show'].includes(r.status)) return false
    const checkIn = parseISO(r.check_in_date)
    checkIn.setHours(0, 0, 0, 0)
    return checkIn.getTime() === checkDate.getTime()
  })

  return !!checkingOut && !!checkingIn
}

// ─── Confirmation payload ──────────────────────────────────────────────

interface ConfirmAction {
  title: string
  message: string
  onConfirm: () => void
}

// ─── Main Component ────────────────────────────────────────────────────

export default function RoomChartPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all')
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [viewDate, setViewDate] = useState<Date>(new Date())

  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [sourceRoom, setSourceRoom] = useState<Room | null>(null)
  const [targetRoom, setTargetRoom] = useState<string>('')
  const [moveLoading, setMoveLoading] = useState(false)

  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [newStatus, setNewStatus] = useState<string>('')
  const [statusLoading, setStatusLoading] = useState(false)

  // Confirmation dialog (replaces native confirm())
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; room: Room | null }>({ x: 0, y: 0, room: null })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Quick action loading
  const [quickActionLoading, setQuickActionLoading] = useState(false)

  // Drag and drop state
  const [draggedRoom, setDraggedRoom] = useState<Room | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const dragReservationRef = useRef<Reservation | null>(null)

  // Timeline resize state
  const [resizing, setResizing] = useState<{
    reservation: Reservation
    anchor: 'start' | 'end'
    startX: number
    originalCheckIn: string
    originalCheckOut: string
  } | null>(null)

  // Timeline drag-move state
  const [draggingReservation, setDraggingReservation] = useState<{
    reservation: Reservation
    startX: number
    originalCheckIn: string
    originalCheckOut: string
  } | null>(null)

  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid')

  const dateRange = useMemo(() => {
    const dates: Date[] = []
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(viewDate, i))
    }
    return dates
  }, [viewDate])

  // ─── Data Fetching ─────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [roomsRes, reservationsRes] = await Promise.all([
        getRooms(1, 500, '', {}),
        getReservations(1, 500, '', 'reserved,checked_in,checked_out'),
      ])

      if (roomsRes?.data) setRooms(roomsRes.data)
      if (reservationsRes?.data) setReservations(reservationsRes.data)
    } catch (err) {
      toast.error('Failed to load room data')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Reservation Date Updates ──────────────────────────────────────

  const updateReservationDates = async (reservationId: string, newCheckIn: string, newCheckOut: string) => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_in_date: newCheckIn, check_out_date: newCheckOut }),
      })

      if (!response.ok) throw new Error('Failed to update dates')

      toast.success('Dates updated successfully')
      fetchData()
    } catch {
      toast.error('Failed to update dates')
    }
  }

  // ─── Confirmation flow (replaces native confirm) ───────────────────

  const requestConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmAction({ title, message, onConfirm })
  }, [])

  const handleConfirmApprove = useCallback(() => {
    confirmAction?.onConfirm()
    setConfirmAction(null)
  }, [confirmAction])

  // ─── Global mouse handlers for timeline resize / drag-move ─────────

  useEffect(() => {
    const cellWidth = 64

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const deltaX = e.clientX - resizing.startX
        const deltaDays = Math.round(deltaX / cellWidth)

        if (deltaDays !== 0) {
          const originalCheckIn = parseISO(resizing.originalCheckIn)
          const originalCheckOut = parseISO(resizing.originalCheckOut)

          let newCheckIn = new Date(originalCheckIn)
          let newCheckOut = new Date(originalCheckOut)

          if (resizing.anchor === 'start') {
            newCheckIn = addDays(originalCheckIn, deltaDays)
            if (newCheckIn >= newCheckOut) newCheckIn = addDays(newCheckOut, -1)
          } else {
            newCheckOut = addDays(originalCheckOut, deltaDays)
            if (newCheckOut <= newCheckIn) newCheckOut = addDays(newCheckIn, 1)
          }

          const newCheckInStr = format(newCheckIn, 'yyyy-MM-dd')
          const newCheckOutStr = format(newCheckOut, 'yyyy-MM-dd')

          setReservations(prev => prev.map(r =>
            r.id === resizing.reservation.id
              ? { ...r, check_in_date: newCheckInStr, check_out_date: newCheckOutStr }
              : r,
          ))
        }
      }

      if (draggingReservation) {
        const deltaX = e.clientX - draggingReservation.startX
        const deltaDays = Math.round(deltaX / cellWidth)

        if (deltaDays !== 0) {
          const originalCheckIn = parseISO(draggingReservation.originalCheckIn)
          const originalCheckOut = parseISO(draggingReservation.originalCheckOut)

          const newCheckIn = addDays(originalCheckIn, deltaDays)
          const newCheckOut = addDays(originalCheckOut, deltaDays)

          setReservations(prev => prev.map(r =>
            r.id === draggingReservation.reservation.id
              ? { ...r, check_in_date: format(newCheckIn, 'yyyy-MM-dd'), check_out_date: format(newCheckOut, 'yyyy-MM-dd') }
              : r,
          ))
        }
      }
    }

    const handleMouseUp = () => {
      if (resizing) {
        const res = reservations.find(r => r.id === resizing.reservation.id)
        if (res && (res.check_in_date !== resizing.originalCheckIn || res.check_out_date !== resizing.originalCheckOut)) {
          const nights = calculateNights(res.check_in_date, res.check_out_date)
          const msg = resizing.anchor === 'start'
            ? `Change check-in to ${format(parseISO(res.check_in_date), 'dd MMM')}?`
            : `Extend stay until ${format(parseISO(res.check_out_date), 'dd MMM')} (${nights} nights)?`

          requestConfirm('Update Dates', msg, () => {
            updateReservationDates(res.id, res.check_in_date, res.check_out_date)
          })
        } else if (res) {
          // Revert
          setReservations(prev => prev.map(r =>
            r.id === resizing.reservation.id
              ? { ...r, check_in_date: resizing.originalCheckIn, check_out_date: resizing.originalCheckOut }
              : r,
          ))
        }
        setResizing(null)
      }

      if (draggingReservation) {
        const res = reservations.find(r => r.id === draggingReservation.reservation.id)
        if (res && res.check_in_date !== draggingReservation.originalCheckIn) {
          const msg = `Move reservation to ${format(parseISO(res.check_in_date), 'dd MMM')} — ${format(parseISO(res.check_out_date), 'dd MMM')}?`

          requestConfirm('Move Reservation', msg, () => {
            updateReservationDates(res.id, res.check_in_date, res.check_out_date)
          })
        } else if (res) {
          setReservations(prev => prev.map(r =>
            r.id === draggingReservation.reservation.id
              ? { ...r, check_in_date: draggingReservation.originalCheckIn, check_out_date: draggingReservation.originalCheckOut }
              : r,
          ))
        }
        setDraggingReservation(null)
      }
    }

    if (resizing || draggingReservation) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, draggingReservation, reservations, requestConfirm, updateReservationDates])

  // Close context menu on outside click / ESC
  useEffect(() => {
    if (!contextMenu.room) return

    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ x: 0, y: 0, room: null })
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu({ x: 0, y: 0, room: null })
    }

    // Delay listener so the right-click event itself doesn't close it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu.room])

  // ─── Room Reservation Lookup ───────────────────────────────────────

  const getRoomReservationOnDate = (roomId: string, date: Date): Reservation | undefined => {
    return reservations.find(r => {
      if (r.room_id !== roomId) return false
      if (r.status === 'cancelled' || r.status === 'no_show') return false

      const checkIn = parseISO(r.check_in_date)
      const checkOut = parseISO(r.check_out_date)
      const checkDate = new Date(date)
      checkDate.setHours(0, 0, 0, 0)

      return checkDate >= checkIn && checkDate < checkOut
    })
  }

  // ─── Context Menu ──────────────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent, room: Room) => {
    e.preventDefault()
    // Clamp position to viewport edges
    const menuWidth = 180
    const menuHeight = 280
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
    setContextMenu({ x, y, room })
  }

  // ─── Drag Handlers (grid view) ─────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, room: Room) => {
    e.dataTransfer.setData('roomId', room.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedRoom(room)
  }

  const handleDragEnd = () => {
    setDraggedRoom(null)
    setDropTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, roomId: string) => {
    e.preventDefault()
    setDropTarget(roomId)
  }

  const handleDrop = async (e: React.DragEvent, targetRoom: Room) => {
    e.preventDefault()
    setDropTarget(null)

    if (!draggedRoom || draggedRoom.id === targetRoom.id) {
      setDraggedRoom(null)
      return
    }

    if (!['available', 'clean'].includes(targetRoom.status)) {
      toast.error(`Room ${targetRoom.room_number} is not available`)
      setDraggedRoom(null)
      return
    }

    setSourceRoom(draggedRoom)
    setTargetRoom(targetRoom.id)
    await handleRoomMoveDirect(draggedRoom.id, targetRoom.id)
    setDraggedRoom(null)
  }

  const handleRoomMoveDirect = async (sourceId: string, targetId: string, checkInDate?: string, checkOutDate?: string) => {
    const result = await moveRoom(sourceId, targetId, checkInDate, checkOutDate)

    if (result.success) {
      toast.success('Room moved successfully')
      fetchData()
    } else {
      toast.error(result.error || 'Failed to move room')
    }
  }

  // ─── Filtering & Grouping ──────────────────────────────────────────

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (selectedBuilding !== 'all' && room.building?.id !== selectedBuilding) return false
      if (selectedFloor !== 'all' && room.floor_plan?.id !== selectedFloor) return false
      if (selectedStatus !== 'all' && room.status !== selectedStatus) return false
      return true
    })
  }, [rooms, selectedBuilding, selectedFloor, selectedStatus])

  const groupedRooms = useMemo(() => {
    return filteredRooms.reduce((acc, room) => {
      const building = room.building?.name || 'Unknown Building'
      const floor = room.floor_plan?.name || 'Unknown Floor'

      if (!acc[building]) acc[building] = {}
      if (!acc[building][floor]) acc[building][floor] = []

      acc[building][floor].push(room)
      return acc
    }, {} as Record<string, Record<string, Room[]>>)
  }, [filteredRooms])

  const buildings = useMemo(() =>
    Array.from(new Set(rooms.map(r => r.building?.id).filter(Boolean)))
      .map(id => ({ id, name: rooms.find(r => r.building?.id === id)?.building?.name || '' })),
  [rooms])

  const floors = useMemo(() =>
    Array.from(new Set(rooms.map(r => r.floor_plan?.id).filter(Boolean)))
      .map(id => ({ id, name: rooms.find(r => r.floor_plan?.id === id)?.floor_plan?.name || '' })),
  [rooms])

  // ─── Actions ───────────────────────────────────────────────────────

  const handleStatusUpdate = async () => {
    if (!selectedRoom || !newStatus) return

    setStatusLoading(true)
    const result = await updateRoomStatus(selectedRoom.id, newStatus)
    setStatusLoading(false)

    if (result.success) {
      toast.success(`Room ${selectedRoom.room_number} status updated`)
      setStatusDialogOpen(false)
      fetchData()
    } else {
      toast.error(result.error || 'Failed to update status')
    }
  }

  const handleRoomMove = async () => {
    if (!sourceRoom || !targetRoom) return

    setMoveLoading(true)
    const result = await moveRoom(sourceRoom.id, targetRoom)
    setMoveLoading(false)

    if (result.success) {
      toast.success('Room moved successfully')
      setMoveDialogOpen(false)
      fetchData()
    } else {
      toast.error(result.error || 'Failed to move room')
    }
  }

  const handleQuickClean = async (roomId: string) => {
    setQuickActionLoading(true)
    const result = await updateRoomStatus(roomId, 'clean')
    setQuickActionLoading(false)
    if (result.success) {
      toast.success('Room marked as clean')
      fetchData()
    } else {
      toast.error(result.error || 'Failed to update room')
    }
  }

  const handleQuickInspect = async (roomId: string) => {
    setQuickActionLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const result = await createHousekeepingTask({
      room_id: roomId,
      task_type: 'inspection',
      status: 'pending',
      priority: 'normal',
      scheduled_date: today,
      notes: 'Quick inspection requested from room chart',
    })
    if (result.success) {
      toast.success('Inspection task created')
      fetchData()
    } else {
      toast.error(result.error || 'Failed to create inspection task')
    }
    setQuickActionLoading(false)
  }

  const handleQuickDisturb = async (roomId: string) => {
    setQuickActionLoading(true)
    const result = await updateRoomStatus(roomId, 'dirty')
    if (result.success) {
      toast.success('Room marked as do not disturb (dirty)')
      fetchData()
    } else {
      toast.error(result.error || 'Failed to update room')
    }
    setQuickActionLoading(false)
  }

  // ─── Loading State ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="space-y-6">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24 mb-3" />
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                  {Array.from({ length: 12 }).map((_, j) => (
                    <Skeleton key={j} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ─── Counts for summary badges ─────────────────────────────────────

  const availableCount = rooms.filter(r => r.status === 'available' || r.status === 'clean').length
  const occupiedCount = rooms.filter(r => r.status === 'occupied').length
  const dirtyCount = rooms.filter(r => r.status === 'dirty').length
  const oooCount = rooms.filter(r => r.status === 'maintenance' || r.status === 'out_of_order').length

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Room Chart</h1>
          <p className="text-sm text-muted-foreground mt-1">Visual room status and operations</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            {availableCount} Available
          </Badge>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {occupiedCount} Occupied
          </Badge>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            {dirtyCount} Dirty
          </Badge>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            {oooCount} OOO/MNT
          </Badge>
          <Badge variant="outline">Total: {rooms.length}</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewDate(addDays(viewDate, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {format(viewDate, 'dd MMM')} — {format(addDays(viewDate, 13), 'dd MMM yyyy')}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setViewDate(addDays(viewDate, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewDate(new Date())}>
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 text-xs"
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('timeline')}
            className="h-8 text-xs"
          >
            Timeline
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Building" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings.map(b => <SelectItem key={b.id} value={b.id!}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {floors.map(f => <SelectItem key={f.id} value={f.id!}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">VAC</SelectItem>
              <SelectItem value="clean">CL</SelectItem>
              <SelectItem value="occupied">OCC</SelectItem>
              <SelectItem value="reserved">RES</SelectItem>
              <SelectItem value="dirty">DIR</SelectItem>
              <SelectItem value="maintenance">MNT</SelectItem>
              <SelectItem value="out_of_order">OOO</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty State */}
      {Object.keys(groupedRooms).length === 0 && (
        <div className="text-center py-16 bg-card rounded-lg border border-border">
          <BedDouble className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-foreground font-medium">No rooms match the current filters</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your building, floor, or status filters
          </p>
        </div>
      )}

      {viewMode === 'grid' ? (
        /* ── Grid View ─────────────────────────────────────────────── */
        <div className="space-y-6">
          {Object.entries(groupedRooms).map(([buildingName, floorsData]) => (
            <Card key={buildingName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <BedDouble className="w-5 h-5 text-primary" />
                  {buildingName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(floorsData).map(([floorName, floorRooms]) => (
                  <div key={floorName}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{floorName}</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                      {floorRooms.map((room) => {
                        const todayRes = getRoomReservationOnDate(room.id, new Date())

                        let displayStatus: RoomStatusKey = room.status as RoomStatusKey
                        if (todayRes) {
                          displayStatus = todayRes.status === 'checked_in' ? 'occupied' : 'reserved'
                        }

                        const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.available
                        const Icon = config.icon
                        const isDropTarget = dropTarget === room.id

                        return (
                          <button
                            key={room.id}
                            type="button"
                            onDragOver={(e) => handleDragOver(e, room.id)}
                            onDrop={(e) => {
                              e.preventDefault()
                              setDropTarget(null)

                              const draggedRes = dragReservationRef.current
                              if (!draggedRes || draggedRes.room_id === room.id) {
                                dragReservationRef.current = null
                                return
                              }

                              if (!['available', 'clean'].includes(room.status)) {
                                toast.error(`Room ${room.room_number} is not available`)
                                dragReservationRef.current = null
                                return
                              }

                              setSourceRoom(rooms.find(r => r.id === draggedRes.room_id) || null)
                              setTargetRoom(room.id)
                              if (draggedRes.room_id) {
                                handleRoomMoveDirect(draggedRes.room_id, room.id)
                              }
                              dragReservationRef.current = null
                            }}
                            onContextMenu={(e) => handleContextMenu(e, room)}
                            onClick={() => {
                              setSelectedRoom(room)
                              setNewStatus(room.status)
                              setStatusDialogOpen(true)
                            }}
                            aria-label={`Room ${room.room_number}, ${config.label}${todayRes ? `, ${todayRes.guest?.first_name} ${todayRes.guest?.last_name}` : ''}`}
                            className={`relative p-2 rounded border-2 cursor-pointer transition-all hover:shadow-md hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${config.pill} ${isDropTarget ? 'ring-4 ring-ring ring-offset-2 bg-primary/10 border-primary scale-105' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold">
                                {room.room_number}
                              </span>
                              <Icon className="w-3.5 h-3.5" />
                            </div>

                            <div className="text-[11px] font-medium mb-1">
                              {config.label}
                            </div>

                            {/* Draggable Guest Name */}
                            {todayRes && (
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation()
                                  dragReservationRef.current = todayRes
                                  e.dataTransfer.setData('text/plain', `${todayRes.guest?.first_name} ${todayRes.guest?.last_name}`)
                                  e.dataTransfer.effectAllowed = 'move'
                                  ;(e.target as HTMLElement).style.opacity = '0.6'
                                }}
                                onDragEnd={(e) => {
                                  ;(e.target as HTMLElement).style.opacity = '1'
                                  dragReservationRef.current = null
                                  setDropTarget(null)
                                }}
                                className="cursor-grab active:cursor-grabbing select-none border border-dashed border-border rounded px-1.5 py-0.5 bg-background/60 hover:bg-background hover:border-primary/50 transition-all"
                                title={`Drag ${todayRes.guest?.first_name} to move room`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground leading-none">⋮⋮</span>
                                  <div className="text-[10px] font-medium text-foreground truncate flex-1">
                                    {todayRes.reservation_number || 'WALK-IN'}
                                  </div>
                                  {isSharedRoom(todayRes) && (
                                    <span className="text-[10px] font-bold text-primary">+</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-secondary-foreground truncate pl-3.5 leading-tight">
                                  {todayRes.guest?.first_name} {todayRes.guest?.last_name?.charAt(0)}.
                                </div>
                                <div className="flex items-center gap-1 pl-3.5">
                                  {isDayUse(todayRes.check_in_date, todayRes.check_out_date) && (
                                    <div className="text-[10px] bg-warning/20 text-warning px-1 rounded inline-block leading-tight">@</div>
                                  )}
                                  {isBackToBack(room.id, new Date(), reservations) && (
                                    <div className="text-[10px] font-bold text-primary leading-tight">&gt;</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {!todayRes && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {room.room_type?.code || room.room_type?.name}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

      ) : (
        /* ── Timeline View ─────────────────────────────────────────── */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Calendar className="w-5 h-5 text-primary" />
              Timeline View — 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {/* Date Headers */}
                <div className="flex border-b border-border pb-2 mb-2">
                  <div className="w-28 flex-shrink-0 font-semibold text-sm text-foreground">Room</div>
                  {dateRange.map((date, i) => (
                    <div key={i} className={`w-16 flex-shrink-0 text-center text-xs py-1 ${isSameDay(date, new Date()) ? 'bg-primary/10 rounded' : ''}`}>
                      <div className="font-semibold text-foreground">{format(date, 'dd')}</div>
                      <div className="text-muted-foreground">{format(date, 'EEE')}</div>
                    </div>
                  ))}
                </div>

                {/* Room Rows */}
                <div className="space-y-0">
                  {filteredRooms.map((room) => {
                    const roomReservations = reservations.filter(r => {
                      if (r.room_id !== room.id) return false
                      if (['cancelled', 'no_show'].includes(r.status)) return false

                      const checkIn = parseISO(r.check_in_date)
                      const checkOut = parseISO(r.check_out_date)
                      const rangeStart = dateRange[0]
                      const rangeEnd = dateRange[dateRange.length - 1]

                      return checkIn < addDays(rangeEnd, 1) && checkOut > rangeStart
                    }).sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime())

                    return (
                      <div key={room.id} data-room-id={room.id} className="flex items-stretch border-b border-border">
                        {/* Room Column */}
                        <div className="w-28 flex-shrink-0 py-2 px-2 bg-muted/50 border-r border-border">
                          <div className="text-sm font-medium text-foreground">{room.room_number}</div>
                          <div className="text-[11px] text-muted-foreground">{room.room_type?.name}</div>
                          <Badge variant="outline" className="text-[11px] mt-1">
                            {STATUS_CONFIG[room.status as RoomStatusKey]?.label || room.status}
                          </Badge>
                        </div>

                        {/* Days Grid */}
                        <div className="flex relative">
                          {dateRange.map((date, i) => {
                            const hasReservation = getRoomReservationOnDate(room.id, date)
                            const isToday = isSameDay(date, new Date())

                            return (
                              <div
                                key={i}
                                className={`w-16 h-14 flex-shrink-0 border-r border-border flex items-center justify-center cursor-pointer hover:bg-muted/50 ${
                                  isToday ? 'bg-primary/5' : 'bg-card'
                                } ${dropTarget === room.id ? 'bg-primary/10 ring-2 ring-ring' : ''}`}
                                onDragOver={(e) => handleDragOver(e, room.id)}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  setDropTarget(null)

                                  const draggedRes = dragReservationRef.current
                                  if (!draggedRes || draggedRes.room_id === room.id) {
                                    dragReservationRef.current = null
                                    return
                                  }

                                  const hasConflict = roomReservations.some(r =>
                                    r.id !== draggedRes.id &&
                                    !(parseISO(r.check_out_date) <= parseISO(draggedRes.check_in_date) ||
                                      parseISO(r.check_in_date) >= parseISO(draggedRes.check_out_date)),
                                  )

                                  if (hasConflict) {
                                    toast.error(`Room ${room.room_number} has conflicting reservations for these dates`)
                                    dragReservationRef.current = null
                                    return
                                  }

                                  setSourceRoom(rooms.find(r => r.id === draggedRes.room_id) || null)
                                  setTargetRoom(room.id)
                                  if (draggedRes.room_id) {
                                    handleRoomMoveDirect(draggedRes.room_id, room.id, draggedRes.check_in_date, draggedRes.check_out_date)
                                  }
                                  dragReservationRef.current = null
                                }}
                                onClick={() => {
                                  setSelectedRoom(room)
                                  setNewStatus(room.status)
                                  setStatusDialogOpen(true)
                                }}
                                title={hasReservation ? `${hasReservation.guest?.first_name} ${hasReservation.guest?.last_name}` : `Room ${room.room_number} — Available`}
                              />
                            )
                          })}

                          {/* Reservation Bars */}
                          {roomReservations.map((res) => {
                            const checkIn = parseISO(res.check_in_date)
                            const checkOut = parseISO(res.check_out_date)
                            const rangeStart = dateRange[0]

                            const startOffset = Math.max(0, Math.floor((checkIn.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)))
                            const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
                            const visibleDuration = Math.min(duration, 14 - startOffset)

                            if (startOffset >= 14 || visibleDuration <= 0) return null

                            const isFirstDayVisible = startOffset >= 0
                            const isCheckedIn = res.status === 'checked_in'
                            const isActive = resizing?.reservation.id === res.id || draggingReservation?.reservation.id === res.id

                            return (
                              <div
                                key={res.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation()
                                  dragReservationRef.current = res
                                  e.dataTransfer.setData('text/plain', `${res.guest?.first_name} ${res.guest?.last_name}`)
                                  e.dataTransfer.effectAllowed = 'move'
                                  ;(e.target as HTMLElement).style.opacity = '0.7'
                                }}
                                onDragEnd={(e) => {
                                  ;(e.target as HTMLElement).style.opacity = '1'
                                  dragReservationRef.current = null
                                  setDropTarget(null)
                                }}
                                onMouseDown={(e) => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                  const x = e.clientX - rect.left
                                  const isEdge = x <= 6 || x >= rect.width - 6
                                  if (isEdge) return

                                  e.preventDefault()

                                  let isDragging = false
                                  const startX = e.clientX
                                  const startY = e.clientY

                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaX = Math.abs(moveEvent.clientX - startX)
                                    const deltaY = Math.abs(moveEvent.clientY - startY)

                                    if (!isDragging && (deltaX > 5 || deltaY > 5)) {
                                      isDragging = true
                                      dragReservationRef.current = res
                                      ;(e.target as HTMLElement).style.opacity = '0.5'
                                      ;(e.target as HTMLElement).style.cursor = 'grabbing'
                                    }

                                    if (isDragging) {
                                      const elementBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
                                      const roomRow = elementBelow?.closest('[data-room-id]')
                                      if (roomRow) {
                                        const roomId = roomRow.getAttribute('data-room-id')
                                        if (roomId && roomId !== room.id) {
                                          setDropTarget(roomId)
                                        }
                                      }
                                    }
                                  }

                                  const handleMouseUp = (upEvent: MouseEvent) => {
                                    document.removeEventListener('mousemove', handleMouseMove)
                                    document.removeEventListener('mouseup', handleMouseUp)

                                    if (isDragging) {
                                      ;(e.target as HTMLElement).style.opacity = '1'
                                      ;(e.target as HTMLElement).style.cursor = 'grab'

                                      const elementBelow = document.elementFromPoint(upEvent.clientX, upEvent.clientY)
                                      const roomRow = elementBelow?.closest('[data-room-id]')

                                      if (roomRow) {
                                        const targetRoomId = roomRow.getAttribute('data-room-id')
                                        if (targetRoomId && targetRoomId !== room.id && dragReservationRef.current) {
                                          const draggedRes = dragReservationRef.current
                                          const targetRoom = rooms.find(r => r.id === targetRoomId)

                                          if (targetRoom) {
                                            const targetReservations = reservations.filter(r =>
                                              r.room_id === targetRoomId &&
                                              r.id !== draggedRes.id &&
                                              !['cancelled', 'no_show'].includes(r.status),
                                            )

                                            const hasConflict = targetReservations.some(r =>
                                              !(parseISO(r.check_out_date) <= parseISO(draggedRes.check_in_date) ||
                                                parseISO(r.check_in_date) >= parseISO(draggedRes.check_out_date)),
                                            )

                                            if (!hasConflict) {
                                              requestConfirm(
                                                'Move Reservation',
                                                `Move ${draggedRes.guest?.first_name} from room ${room.room_number} to room ${targetRoom.room_number}?`,
                                                () => {
                                                  handleRoomMoveDirect(draggedRes.room_id!, targetRoomId, draggedRes.check_in_date, draggedRes.check_out_date)
                                                },
                                              )
                                            } else {
                                              toast.error(`Room ${targetRoom.room_number} has conflicting reservations`)
                                            }
                                          }
                                        }
                                      }

                                      dragReservationRef.current = null
                                      setDropTarget(null)
                                    }
                                  }

                                  document.addEventListener('mousemove', handleMouseMove)
                                  document.addEventListener('mouseup', handleMouseUp)
                                }}
                                className="absolute h-10 top-2 rounded-md shadow-sm cursor-grab active:cursor-grabbing pointer-events-auto overflow-hidden hover:ring-2 hover:ring-white/50"
                                style={{
                                  left: `${(startOffset * 64) + 2}px`,
                                  width: `${(visibleDuration * 64) - 4}px`,
                                  backgroundColor: isCheckedIn ? 'var(--success)' : 'var(--primary)',
                                  zIndex: isActive ? 20 : 10,
                                  opacity: isActive ? 0.8 : 1,
                                }}
                                title={`${res.guest?.first_name} ${res.guest?.last_name} — ${format(checkIn, 'dd MMM')} → ${format(checkOut, 'dd MMM')} (Drag bar to move dates, drag edges to resize)`}
                              >
                                {/* Left resize handle */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/40 active:bg-white/60 z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setResizing({
                                      reservation: res,
                                      anchor: 'start',
                                      startX: e.clientX,
                                      originalCheckIn: res.check_in_date,
                                      originalCheckOut: res.check_out_date,
                                    })
                                  }}
                                  title="Drag to change check-in date"
                                />

                                {/* Content */}
                                <div className="px-2 py-1 h-full flex flex-col justify-center">
                                  {isFirstDayVisible && (
                                    <>
                                      <div className="text-[10px] font-medium text-primary-foreground truncate">
                                        {res.reservation_number || 'WALK-IN'}
                                      </div>
                                      <div className="text-[10px] text-primary-foreground/90 truncate">
                                        {res.guest?.first_name} {res.guest?.last_name?.charAt(0)}.
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        {isSharedRoom(res) && (
                                          <span className="text-[10px] font-bold text-primary-foreground">+</span>
                                        )}
                                        {isDayUse(res.check_in_date, res.check_out_date) && (
                                          <span className="text-[10px] text-primary-foreground">@</span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Right resize handle */}
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/40 active:bg-white/60 z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setResizing({
                                      reservation: res,
                                      anchor: 'end',
                                      startX: e.clientX,
                                      originalCheckIn: res.check_in_date,
                                      originalCheckOut: res.check_out_date,
                                    })
                                  }}
                                  title="Drag to extend or shorten stay"
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Status Dialog ───────────────────────────────────────────── */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Room {selectedRoom?.room_number}</DialogTitle>
            <DialogDescription>
              {selectedRoom?.room_type?.name} · Status: <Badge>{selectedRoom?.status}</Badge>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {selectedRoom && getRoomReservationOnDate(selectedRoom.id, new Date()) && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Active Guest</p>
                </div>
                {(() => {
                  const res = getRoomReservationOnDate(selectedRoom.id, new Date())!
                  return (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {res.guest?.first_name} {res.guest?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(res.check_in_date), 'dd MMM')} — {format(parseISO(res.check_out_date), 'dd MMM')}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Link href={`/dashboard/reservations/${res.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye className="w-3 h-3 mr-1" />View
                          </Button>
                        </Link>
                        <Link href={`/dashboard/cashier?reservation_id=${res.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            ฿ Folio
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {selectedRoom && !getRoomReservationOnDate(selectedRoom.id, new Date()) && (
              <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                <p className="text-sm font-medium text-success">Room is Available</p>
                <Link href={`/dashboard/reservations/new?room_id=${selectedRoom.id}`} className="block mt-2">
                  <Button size="sm" className="w-full" variant="default">
                    <LogIn className="w-4 h-4 mr-2" />Walk-in / Check-in
                  </Button>
                </Link>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Update Room Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded border ${config.pill}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSourceRoom(selectedRoom)
                  setMoveDialogOpen(true)
                  setStatusDialogOpen(false)
                }}
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />Move Room
              </Button>
              <Button
                className="flex-1"
                onClick={handleStatusUpdate}
                disabled={statusLoading || newStatus === selectedRoom?.status}
              >
                {statusLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Move Dialog ─────────────────────────────────────────────── */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Move Room
            </DialogTitle>
            <DialogDescription>
              Move guest from <Badge>{sourceRoom?.room_number}</Badge> to another room
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Target Room</label>
              <Select value={targetRoom} onValueChange={setTargetRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose vacant room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms
                    .filter(r => r.id !== sourceRoom?.id && ['available', 'clean'].includes(r.status))
                    .sort((a, b) => a.room_number.localeCompare(b.room_number))
                    .map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.room_number}</span>
                          <span className="text-muted-foreground">({r.room_type?.name})</span>
                          <Badge variant="outline" className="text-xs">
                            {STATUS_CONFIG[r.status as RoomStatusKey]?.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMoveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleRoomMove}
                disabled={moveLoading || !targetRoom}
              >
                {moveLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Move
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Dialog (replaces native confirm) ───────────── */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
            <DialogDescription>{confirmAction?.message}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button onClick={handleConfirmApprove}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Context Menu ────────────────────────────────────────────── */}
      {contextMenu.room && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-card rounded-lg shadow-lg border border-border p-2 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground px-2 py-1 border-b border-border">
              Room {contextMenu.room.room_number}
            </p>
            {(() => {
              const res = getRoomReservationOnDate(contextMenu.room!.id, new Date())
              if (res) {
                return (
                  <>
                    <Link href={`/dashboard/reservations/${res.id}`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                        <Eye className="w-3 h-3 mr-2" />View Reservation
                      </Button>
                    </Link>
                    <Link href={`/dashboard/cashier?reservation_id=${res.id}`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                        ฿ View Folio
                      </Button>
                    </Link>
                  </>
                )
              }
              return (
                <Link href={`/dashboard/reservations/new?room_id=${contextMenu.room!.id}`}>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    <LogIn className="w-3 h-3 mr-2" />New Reservation
                  </Button>
                </Link>
              )
            })()}

            {/* Quick Room Actions */}
            <div className="border-t border-border pt-1 mt-1">
              <p className="text-[11px] text-muted-foreground px-2 py-1 uppercase tracking-wide">Quick Actions</p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-success"
                onClick={() => handleQuickClean(contextMenu.room!.id)}
                disabled={quickActionLoading}
              >
                <Sparkles className="w-3 h-3 mr-2" />Quick Clean
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-primary"
                onClick={() => handleQuickInspect(contextMenu.room!.id)}
                disabled={quickActionLoading}
              >
                <Search className="w-3 h-3 mr-2" />Request Inspect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-warning"
                onClick={() => handleQuickDisturb(contextMenu.room!.id)}
                disabled={quickActionLoading}
              >
                <AlertCircle className="w-3 h-3 mr-2" />Do Not Disturb
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
