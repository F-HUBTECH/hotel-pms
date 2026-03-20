'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getRooms, updateRoomStatus, moveRoom } from '@/lib/actions/rooms'
import { getReservations } from '@/lib/actions/reservations'
import type { Room, Reservation } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { 
  BedDouble, ArrowRightLeft, Eye, Loader2, Filter, 
  CheckCircle2, Clock, Wrench, Ban, LogIn,
  Calendar, Users, ChevronRight, ChevronLeft
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { format, addDays, isSameDay, parseISO } from 'date-fns'

const STATUS_CONFIG: Record<string, { 
  label: string; 
  color: string; 
  icon: any; 
  bg: string;
  textColor: string;
  borderColor: string;
}> = {
  available: { 
    label: 'VAC', 
    color: 'text-emerald-700', 
    bg: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    icon: CheckCircle2 
  },
  clean: { 
    label: 'CL', 
    color: 'text-cyan-700', 
    bg: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300',
    icon: CheckCircle2 
  },
  occupied: { 
    label: 'OI', 
    color: 'text-blue-700', 
    bg: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    icon: LogIn 
  },
  reserved: { 
    label: 'OO', 
    color: 'text-indigo-700', 
    bg: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-300',
    icon: Clock 
  },
  dirty: { 
    label: 'DI', 
    color: 'text-amber-700', 
    bg: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    icon: Ban 
  },
  maintenance: { 
    label: 'OOO', 
    color: 'text-red-700', 
    bg: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    icon: Wrench 
  },
  out_of_order: { 
    label: 'OOO', 
    color: 'text-red-700', 
    bg: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    icon: Ban 
  },
}

function calculateNights(checkIn: string, checkOut: string): number {
  const start = parseISO(checkIn)
  const end = parseISO(checkOut)
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

function isDayUse(checkIn: string, checkOut: string): boolean {
  return isSameDay(parseISO(checkIn), parseISO(checkOut))
}

// Check if room has shared reservation (multiple guests in same room)
function isSharedRoom(reservation: Reservation | undefined): boolean {
  if (!reservation) return false
  if (!reservation.share_with) return false
  return Array.isArray(reservation.share_with) && reservation.share_with.length > 0
}

// Check if there's a back-to-back booking (guest checks out and another checks in same day)
function isBackToBack(roomId: string, date: Date, reservations: Reservation[]): boolean {
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)
  
  // Find reservations ending on this date
  const checkingOut = reservations.find(r => {
    if (r.room_id !== roomId) return false
    if (['cancelled', 'no_show'].includes(r.status)) return false
    const checkOut = parseISO(r.check_out_date)
    checkOut.setHours(0, 0, 0, 0)
    return checkOut.getTime() === checkDate.getTime()
  })
  
  // Find reservations starting on this date
  const checkingIn = reservations.find(r => {
    if (r.room_id !== roomId) return false
    if (['cancelled', 'no_show'].includes(r.status)) return false
    const checkIn = parseISO(r.check_in_date)
    checkIn.setHours(0, 0, 0, 0)
    return checkIn.getTime() === checkDate.getTime()
  })
  
  return !!checkingOut && !!checkingIn
}

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
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; room: Room | null }>({ x: 0, y: 0, room: null })
  
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

  // Update reservation dates
  const updateReservationDates = async (reservationId: string, newCheckIn: string, newCheckOut: string) => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_in_date: newCheckIn,
          check_out_date: newCheckOut
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update dates')
      }
      
      toast.success('Dates updated successfully')
      fetchData()
    } catch (error) {
      toast.error('Failed to update dates')
    }
  }

  // View mode state (grid or timeline)
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid')

  const dateRange = useMemo(() => {
    const dates = []
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(viewDate, i))
    }
    return dates
  }, [viewDate])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [roomsRes, reservationsRes] = await Promise.all([
        getRooms(1, 500, '', {}),
        getReservations(1, 500, '', 'reserved,checked_in,checked_out')
      ])
      
      console.log('Rooms response:', roomsRes)
      console.log('Reservations response:', reservationsRes)
      
      if (roomsRes?.data) {
        setRooms(roomsRes.data)
      }
      if (reservationsRes?.data) {
        setReservations(reservationsRes.data)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      toast.error('Failed to load room data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { 
    fetchData() 
  }, [fetchData])

  // Global mouse handlers for resize and drag-to-move
  useEffect(() => {
    const cellWidth = 64 // width of each day cell

    const handleMouseMove = (e: MouseEvent) => {
      // Handle resize operation
      if (resizing) {
        const deltaX = e.clientX - resizing.startX
        const deltaDays = Math.round(deltaX / cellWidth)
        
        if (deltaDays !== 0) {
          const originalCheckIn = parseISO(resizing.originalCheckIn)
          const originalCheckOut = parseISO(resizing.originalCheckOut)
          
          let newCheckIn = new Date(originalCheckIn)
          let newCheckOut = new Date(originalCheckOut)
          
          if (resizing.anchor === 'start') {
            // Moving check-in date
            newCheckIn = addDays(originalCheckIn, deltaDays)
            // Ensure check-in is before check-out
            if (newCheckIn >= newCheckOut) {
              newCheckIn = addDays(newCheckOut, -1)
            }
          } else {
            // Moving check-out date (extending/shortening)
            newCheckOut = addDays(originalCheckOut, deltaDays)
            // Ensure check-out is after check-in
            if (newCheckOut <= newCheckIn) {
              newCheckOut = addDays(newCheckIn, 1)
            }
          }
          
          // Update the reservation visually (optimistic update)
          const newCheckInStr = format(newCheckIn, 'yyyy-MM-dd')
          const newCheckOutStr = format(newCheckOut, 'yyyy-MM-dd')
          
          setReservations(prev => prev.map(r => 
            r.id === resizing.reservation.id 
              ? { ...r, check_in_date: newCheckInStr, check_out_date: newCheckOutStr }
              : r
          ))
        }
      }
      
      // Handle drag-to-move operation (shifting entire reservation)
      if (draggingReservation) {
        const deltaX = e.clientX - draggingReservation.startX
        const deltaDays = Math.round(deltaX / cellWidth)
        
        if (deltaDays !== 0) {
          const originalCheckIn = parseISO(draggingReservation.originalCheckIn)
          const originalCheckOut = parseISO(draggingReservation.originalCheckOut)
          
          const newCheckIn = addDays(originalCheckIn, deltaDays)
          const newCheckOut = addDays(originalCheckOut, deltaDays)
          
          const newCheckInStr = format(newCheckIn, 'yyyy-MM-dd')
          const newCheckOutStr = format(newCheckOut, 'yyyy-MM-dd')
          
          // Update visually
          setReservations(prev => prev.map(r => 
            r.id === draggingReservation.reservation.id 
              ? { ...r, check_in_date: newCheckInStr, check_out_date: newCheckOutStr }
              : r
          ))
        }
      }
    }

    const handleMouseUp = () => {
      // Commit resize changes
      if (resizing) {
        const res = reservations.find(r => r.id === resizing.reservation.id)
        if (res) {
          // Check if dates actually changed
          if (res.check_in_date !== resizing.originalCheckIn || 
              res.check_out_date !== resizing.originalCheckOut) {
            // Show confirmation and update
            const nights = calculateNights(res.check_in_date, res.check_out_date)
            const msg = resizing.anchor === 'start' 
              ? `Change check-in to ${format(parseISO(res.check_in_date), 'dd MMM')}?`
              : `Extend stay until ${format(parseISO(res.check_out_date), 'dd MMM')} (${nights} nights)?`
            
            if (confirm(msg)) {
              updateReservationDates(res.id, res.check_in_date, res.check_out_date)
            } else {
              // Revert to original dates
              setReservations(prev => prev.map(r => 
                r.id === resizing.reservation.id 
                  ? { ...r, check_in_date: resizing.originalCheckIn, check_out_date: resizing.originalCheckOut }
                  : r
              ))
            }
          }
        }
        setResizing(null)
      }
      
      // Commit drag-to-move changes
      if (draggingReservation) {
        const res = reservations.find(r => r.id === draggingReservation.reservation.id)
        if (res) {
          if (res.check_in_date !== draggingReservation.originalCheckIn) {
            const msg = `Move reservation to ${format(parseISO(res.check_in_date), 'dd MMM')} - ${format(parseISO(res.check_out_date), 'dd MMM')}?`
            if (confirm(msg)) {
              updateReservationDates(res.id, res.check_in_date, res.check_out_date)
            } else {
              // Revert
              setReservations(prev => prev.map(r => 
                r.id === draggingReservation.reservation.id 
                  ? { ...r, check_in_date: draggingReservation.originalCheckIn, check_out_date: draggingReservation.originalCheckOut }
                  : r
              ))
            }
          }
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
  }, [resizing, draggingReservation, reservations])

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

  const handleContextMenu = (e: React.MouseEvent, room: Room) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, room })
  }

  const closeContextMenu = () => {
    setContextMenu({ x: 0, y: 0, room: null })
  }

  // Drag handlers
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
    
    // Check if target room is available
    if (!['available', 'clean'].includes(targetRoom.status)) {
      toast.error(`Room ${targetRoom.room_number} is not available`)
      setDraggedRoom(null)
      return
    }
    
    // Move room
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Chart</h1>
          <p className="text-sm text-slate-500 mt-1">Visual room status and operations</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
            VAC: {rooms.filter(r => r.status === 'available').length}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            OI: {rooms.filter(r => r.status === 'occupied').length}
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700">
            OOO: {rooms.filter(r => r.status === 'maintenance' || r.status === 'out_of_order').length}
          </Badge>
          <Badge variant="outline">Total: {rooms.length}</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewDate(addDays(viewDate, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">
              {format(viewDate, 'dd MMM')} - {format(addDays(viewDate, 13), 'dd MMM yyyy')}
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
          <div className="w-px h-6 bg-slate-300 mx-2" />
          <Filter className="w-4 h-4 text-slate-400" />
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
              <SelectItem value="occupied">OI</SelectItem>
              <SelectItem value="reserved">OO</SelectItem>
              <SelectItem value="dirty">DI</SelectItem>
              <SelectItem value="maintenance">OOO</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-slate-100 p-2 rounded text-xs text-slate-600">
        Debug: Total rooms: {rooms.length} | Filtered: {filteredRooms.length} | Groups: {Object.keys(groupedRooms).length} | Reservations: {reservations.length}
      </div>

      {/* Empty State */}
      {Object.keys(groupedRooms).length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No rooms found</p>
          <p className="text-xs text-slate-400 mt-1">
            Check console for details or ensure rooms exist in database
          </p>
        </div>
      )}

      {viewMode === 'grid' ? (
        /* Room Grid View */
        <div className="space-y-6">
          {Object.entries(groupedRooms).map(([buildingName, floorsData]) => (
            <Card key={buildingName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-indigo-500" />
                  {buildingName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(floorsData).map(([floorName, floorRooms]) => (
                  <div key={floorName}>
                    <h3 className="text-sm font-medium text-slate-500 mb-2">{floorName}</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                      {floorRooms.map((room) => {
                        const todayRes = getRoomReservationOnDate(room.id, new Date())
                        
                      let displayStatus = room.status
                      if (todayRes) {
                        displayStatus = todayRes.status === 'checked_in' ? 'occupied' : 'reserved'
                      }
                      
                      const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.available
                      const Icon = config.icon
                      
                      return (
                        <div
                          key={room.id}
                          onDragOver={(e) => handleDragOver(e, room.id)}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDropTarget(null)
                            
                            const draggedRes = dragReservationRef.current
                            if (!draggedRes || draggedRes.room_id === room.id) {
                              dragReservationRef.current = null
                              return
                            }
                            
                            // Only allow drop on available/clean rooms
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
                          className={`relative p-2 rounded border-2 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${config.bg} ${config.borderColor} ${dropTarget === room.id ? 'ring-4 ring-indigo-500 ring-offset-2 bg-indigo-50 border-indigo-500 scale-105' : ''}`}
                          onClick={() => {
                            setSelectedRoom(room)
                            setNewStatus(room.status)
                            setStatusDialogOpen(true)
                          }}
                          title={`Room ${room.room_number}${todayRes ? ` - ${todayRes.guest?.first_name} ${todayRes.guest?.last_name}` : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold ${config.textColor}`}>
                              {room.room_number}
                            </span>
                            <Icon className={`w-3 h-3 ${config.color}`} />
                          </div>
                          
                          <div className={`text-[10px] font-medium ${config.textColor} mb-1`}>
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
                              className="cursor-grab active:cursor-grabbing select-none border border-dashed border-slate-400 rounded px-1 py-0.5 bg-white/50 hover:bg-white hover:border-indigo-400 transition-all"
                              title={`Drag ${todayRes.guest?.first_name} to move room`}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] text-slate-400">⋮⋮</span>
                                <div className="text-[9px] font-medium text-slate-700 truncate flex-1">
                                  {todayRes.reservation_number || 'WALK-IN'}
                                </div>
                                {isSharedRoom(todayRes) && (
                                  <span className="text-[8px] font-bold text-blue-600">+</span>
                                )}
                              </div>
                              <div className="text-[8px] text-slate-600 truncate pl-3">
                                {todayRes.guest?.first_name} {todayRes.guest?.last_name?.charAt(0)}.
                              </div>
                              <div className="flex items-center gap-1 pl-3">
                                {isDayUse(todayRes.check_in_date, todayRes.check_out_date) && (
                                  <div className="text-[8px] bg-amber-200 text-amber-800 px-1 rounded inline-block">@</div>
                                )}
                                {isBackToBack(room.id, new Date(), reservations) && (
                                  <div className="text-[8px] font-bold text-purple-600">&gt;</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {!todayRes && (
                            <div className="text-[9px] text-slate-500 truncate">
                              {room.room_type?.code || room.room_type?.name}
                            </div>
                          )}
                        </div>
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
        /* Enhanced Timeline View with Multi-Day Reservation Bars */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Timeline View - 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {/* Date Headers */}
                <div className="flex border-b pb-2 mb-2">
                  <div className="w-28 flex-shrink-0 font-semibold text-sm">Room</div>
                  {dateRange.map((date, i) => (
                    <div key={i} className={`w-16 flex-shrink-0 text-center text-xs py-1 ${isSameDay(date, new Date()) ? 'bg-indigo-100 rounded' : ''}`}>
                      <div className="font-semibold">{format(date, 'dd')}</div>
                      <div className="text-slate-500">{format(date, 'EEE')}</div>
                    </div>
                  ))}
                </div>
                
                {/* Room Rows */}
                <div className="space-y-0">
                  {filteredRooms.map((room) => {
                    // Get all reservations for this room in the date range
                    const roomReservations = reservations.filter(r => {
                      if (r.room_id !== room.id) return false
                      if (['cancelled', 'no_show'].includes(r.status)) return false
                      
                      const checkIn = parseISO(r.check_in_date)
                      const checkOut = parseISO(r.check_out_date)
                      const rangeStart = dateRange[0]
                      const rangeEnd = dateRange[dateRange.length - 1]
                      
                      // Check if reservation overlaps with date range
                      return checkIn < addDays(rangeEnd, 1) && checkOut > rangeStart
                    }).sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime())

                    return (
                      <div key={room.id} data-room-id={room.id} className="flex items-stretch border-b border-slate-100">
                        {/* Room Column */}
                        <div className="w-28 flex-shrink-0 py-2 px-2 bg-slate-50 border-r">
                          <div className="text-sm font-medium">{room.room_number}</div>
                          <div className="text-[10px] text-slate-500">{room.room_type?.name}</div>
                          <Badge variant="outline" className="text-[9px] mt-1">
                            {STATUS_CONFIG[room.status]?.label || room.status}
                          </Badge>
                        </div>
                        
                        {/* Days Grid with Reservation Bars */}
                        <div className="flex relative">
                          {/* Background day cells - neutral colors */}
                          {dateRange.map((date, i) => {
                            const hasReservation = getRoomReservationOnDate(room.id, date)
                            const isToday = isSameDay(date, new Date())
                            
                            return (
                              <div
                                key={i}
                                className={`w-16 h-14 flex-shrink-0 border-r border-slate-100 flex items-center justify-center cursor-pointer hover:bg-slate-50 ${
                                  isToday ? 'bg-indigo-50' : 'bg-white'
                                } ${dropTarget === room.id ? 'bg-indigo-100 ring-2 ring-indigo-400' : ''}`}
                                onDragOver={(e) => handleDragOver(e, room.id)}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  setDropTarget(null)
                                  
                                  const draggedRes = dragReservationRef.current
                                  if (!draggedRes || draggedRes.room_id === room.id) {
                                    dragReservationRef.current = null
                                    return
                                  }
                                  
                                  // Check for date conflicts with existing reservations in target room
                                  const hasConflict = roomReservations.some(r => 
                                    r.id !== draggedRes.id &&
                                    !(parseISO(r.check_out_date) <= parseISO(draggedRes.check_in_date) || 
                                      parseISO(r.check_in_date) >= parseISO(draggedRes.check_out_date))
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
                                title={hasReservation ? `${hasReservation.guest?.first_name} ${hasReservation.guest?.last_name}` : `Room ${room.room_number} - Available`}
                              />
                            )
                          })}
                          
                          {/* Reservation Bars Layer */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {dateRange.map((date, i) => (
                              <div key={i} className="w-16 h-14 flex-shrink-0" />
                            ))}
                          </div>
                          
                          {/* Render reservation bars */}
                          {roomReservations.map((res) => {
                            const checkIn = parseISO(res.check_in_date)
                            const checkOut = parseISO(res.check_out_date)
                            const rangeStart = dateRange[0]
                            
                            // Calculate position
                            const startOffset = Math.max(0, Math.floor((checkIn.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)))
                            const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
                            const visibleDuration = Math.min(duration, 14 - startOffset)
                            
                            if (startOffset >= 14 || visibleDuration <= 0) return null
                            
                            const isFirstDayVisible = startOffset >= 0
                            const isCheckedIn = res.status === 'checked_in'
                            
                            return (
                              <div
                                key={res.id}
                                draggable
                                onDragStart={(e) => {
                                  console.log('🚀 DRAG START:', res.guest?.first_name, 'from room', room.room_number)
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
                                  // Check if clicking on resize handles (left/right 6px)
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                  const x = e.clientX - rect.left
                                  const isEdge = x <= 6 || x >= rect.width - 6
                                  
                                  if (isEdge) {
                                    // Let the resize handle take over
                                    return
                                  }
                                  
                                  // Start manual drag tracking (like reference project)
                                  e.preventDefault()
                                  console.log('🚀 Mouse down on reservation, starting drag tracking')
                                  
                                  let isDragging = false
                                  const startX = e.clientX
                                  const startY = e.clientY
                                  
                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaX = Math.abs(moveEvent.clientX - startX)
                                    const deltaY = Math.abs(moveEvent.clientY - startY)
                                    
                                    // Start drag after moving 5px
                                    if (!isDragging && (deltaX > 5 || deltaY > 5)) {
                                      isDragging = true
                                      console.log('🚀 Drag started for:', res.guest?.first_name)
                                      dragReservationRef.current = res
                                      ;(e.target as HTMLElement).style.opacity = '0.5'
                                      ;(e.target as HTMLElement).style.cursor = 'grabbing'
                                    }
                                    
                                    if (isDragging) {
                                      // Find room under cursor
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
                                      console.log('🏁 Drag ended')
                                      ;(e.target as HTMLElement).style.opacity = '1'
                                      ;(e.target as HTMLElement).style.cursor = 'grab'
                                      
                                      // Find drop target
                                      const elementBelow = document.elementFromPoint(upEvent.clientX, upEvent.clientY)
                                      const roomRow = elementBelow?.closest('[data-room-id]')
                                      
                                      if (roomRow) {
                                        const targetRoomId = roomRow.getAttribute('data-room-id')
                                        if (targetRoomId && targetRoomId !== room.id && dragReservationRef.current) {
                                          console.log('📍 DROP on room:', targetRoomId)
                                          const draggedRes = dragReservationRef.current
                                          
                                          // Check conflicts
                                          const targetRoom = rooms.find(r => r.id === targetRoomId)
                                          if (targetRoom) {
                                            const roomReservations = reservations.filter(r => 
                                              r.room_id === targetRoomId && 
                                              r.id !== draggedRes.id &&
                                              !['cancelled', 'no_show'].includes(r.status)
                                            )
                                            
                                            const hasConflict = roomReservations.some(r => 
                                              !(parseISO(r.check_out_date) <= parseISO(draggedRes.check_in_date) || 
                                                parseISO(r.check_in_date) >= parseISO(draggedRes.check_out_date))
                                            )
                                            
                                            if (!hasConflict) {
                                              if (confirm(`Move ${draggedRes.guest?.first_name} from room ${room.room_number} to room ${targetRoom.room_number}?`)) {
                                                handleRoomMoveDirect(draggedRes.room_id!, targetRoomId, draggedRes.check_in_date, draggedRes.check_out_date)
                                              }
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
                                  backgroundColor: isCheckedIn ? '#4caf50' : '#1976d2',
                                  zIndex: resizing?.reservation.id === res.id || draggingReservation?.reservation.id === res.id ? 20 : 10,
                                  opacity: resizing?.reservation.id === res.id || draggingReservation?.reservation.id === res.id ? 0.8 : 1,
                                }}
                                title={`${res.guest?.first_name} ${res.guest?.last_name} - ${format(checkIn, 'dd MMM')} → ${format(checkOut, 'dd MMM')} (Drag bar to move dates, drag edges to resize)`}
                              >
                                {/* Left edge resize handle - drag to change check-in date */}
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
                                      originalCheckOut: res.check_out_date
                                    })
                                  }}
                                  title="Drag to change check-in date"
                                />
                                
                                {/* Content */}
                                <div className="px-2 py-1 h-full flex flex-col justify-center">
                                  {isFirstDayVisible && (
                                    <>
                                      <div className="text-[10px] font-medium text-white truncate">
                                        {res.reservation_number || 'WALK-IN'}
                                      </div>
                                      <div className="text-[9px] text-white/90 truncate">
                                        {res.guest?.first_name} {res.guest?.last_name?.charAt(0)}.
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        {isSharedRoom(res) && (
                                          <span className="text-[8px] font-bold text-white">+</span>
                                        )}
                                        {isDayUse(res.check_in_date, res.check_out_date) && (
                                          <span className="text-[8px] text-white">@</span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                                
                                {/* Right edge resize handle - drag to extend/shorten stay */}
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
                                      originalCheckOut: res.check_out_date
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

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Room {selectedRoom?.room_number}</DialogTitle>
            <DialogDescription>
              {selectedRoom?.room_type?.name} • Status: <Badge>{selectedRoom?.status}</Badge>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {selectedRoom && getRoomReservationOnDate(selectedRoom.id, new Date()) && (
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-medium text-indigo-800">Active Guest</p>
                </div>
                {(() => {
                  const res = getRoomReservationOnDate(selectedRoom.id, new Date())!
                  return (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-indigo-900">
                        {res.guest?.first_name} {res.guest?.last_name}
                      </p>
                      <p className="text-xs text-indigo-600">
                        {format(parseISO(res.check_in_date), 'dd MMM')} - {format(parseISO(res.check_out_date), 'dd MMM')}
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
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm font-medium text-emerald-800">Room is Available</p>
                <Link href={`/dashboard/reservations/new?room_id=${selectedRoom.id}`} className="block mt-2">
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <LogIn className="w-4 h-4 mr-2" />Walk-in / Check-in
                  </Button>
                </Link>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Update Room Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${config.bg} ${config.borderColor} border`} />
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
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
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

      {/* Move Dialog */}
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
              <label className="text-sm font-medium">Select Target Room</label>
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
                          <span className="text-slate-500">({r.room_type?.name})</span>
                          <Badge variant="outline" className="text-xs">
                            {STATUS_CONFIG[r.status]?.label}
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
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
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
      {/* Context Menu */}
      {contextMenu.room && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border p-2 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={closeContextMenu}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-700 px-2 py-1 border-b">
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
          </div>
        </div>
      )}
    </div>
  )
}
