'use client'

import { useState } from 'react'
import { BedDouble, Users, Calendar, Wrench, Clock } from 'lucide-react'

type RoomStatus = 'available' | 'occupied' | 'reserved' | 'dirty' | 'maintenance' | 'clean' | 'blocked'

interface Room {
  id: string
  room_number: string
  status: RoomStatus
  room_type?: { code: string; name: string }
  building?: { name: string }
  floor_plan?: { name: string }
  reservation?: {
    guest_name?: string
    check_in_date?: string
    check_out_date?: string
  }
}

interface RoomGridProps {
  rooms: Room[]
  selectedRoomId?: string
  onRoomSelect?: (room: Room) => void
  showStatus?: boolean
  selectable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const statusColors: Record<RoomStatus, { bg: string; border: string; text: string; label: string }> = {
  available: { bg: 'bg-emerald-50border-emerald-200 hover', border: ':border-emerald-400', text: 'text-emerald-700', label: 'Available' },
  occupied: { bg: 'bg-blue-50', border: 'border-blue-200 hover:border-blue-400', text: 'text-blue-700', label: 'Occupied' },
  reserved: { bg: 'bg-amber-50', border: 'border-amber-200 hover:border-amber-400', text: 'text-amber-700', label: 'Reserved' },
  dirty: { bg: 'bg-rose-50', border: 'border-rose-200 hover:border-rose-400', text: 'text-rose-700', label: 'Dirty' },
  maintenance: { bg: 'bg-slate-50', border: 'border-slate-300 hover:border-slate-500', text: 'text-slate-600', label: 'Maintenance' },
  clean: { bg: 'bg-cyan-50', border: 'border-cyan-200 hover:border-cyan-400', text: 'text-cyan-700', label: 'Clean' },
  blocked: { bg: 'bg-red-50', border: 'border-red-200 hover:border-red-400', text: 'text-red-700', label: 'Blocked' },
}

const sizeClasses = {
  sm: 'p-1.5 text-xs',
  md: 'p-2 text-sm',
  lg: 'p-3 text-base',
}

export function RoomGrid({ rooms, selectedRoomId, onRoomSelect, showStatus = true, selectable = true, size = 'md' }: RoomGridProps) {
  const [hoveredRoom, setHoveredRoom] = useState<Room | null>(null)

  const groupedRooms = rooms.reduce((acc, room) => {
    const building = room.building?.name || 'Default'
    if (!acc[building]) acc[building] = []
    acc[building].push(room)
    return acc
  }, {} as Record<string, Room[]>)

  const getStatusIcon = (status: RoomStatus) => {
    switch (status) {
      case 'occupied': return <Users className="w-3 h-3" />
      case 'reserved': return <Calendar className="w-3 h-3" />
      case 'maintenance': return <Wrench className="w-3 h-3" />
      case 'dirty': return <Clock className="w-3 h-3" />
      default: return <BedDouble className="w-3 h-3" />
    }
  }

  return (
    <div className="space-y-4">
      {showStatus && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(statusColors).map(([status, { bg, text, label }]) => (
            <div key={status} className={`flex items-center gap-1 px-2 py-1 rounded ${bg} ${text}`}>
              <span className="w-2 h-2 rounded-full bg-current" />
              {label}
            </div>
          ))}
        </div>
      )}

      {Object.entries(groupedRooms).map(([building, buildingRooms]) => (
        <div key={building}>
          <h3 className="font-medium text-slate-700 mb-2">{building}</h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {buildingRooms.map((room) => {
              const colors = statusColors[room.status] || statusColors.available
              const isSelected = selectedRoomId === room.id

              return (
                <button
                  key={room.id}
                  onClick={() => selectable && onRoomSelect?.(room)}
                  onMouseEnter={() => setHoveredRoom(room)}
                  onMouseLeave={() => setHoveredRoom(null)}
                  disabled={!selectable}
                  className={`
                    ${sizeClasses[size]} rounded-lg border-2 transition-all relative
                    ${colors.bg} ${colors.border}
                    ${isSelected ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}
                    ${selectable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
                    ${!selectable && room.status === 'available' ? 'opacity-50' : ''}
                  `}
                >
                  <div className={`font-bold ${colors.text}`}>{room.room_number}</div>
                  <div className={`flex items-center justify-center mt-1 ${colors.text}`}>
                    {getStatusIcon(room.status)}
                  </div>
                  
                  {/* Tooltip */}
                  {hoveredRoom?.id === room.id && (
                    <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-lg">
                      <div className="font-bold">{room.room_number}</div>
                      <div>{room.room_type?.name || 'Standard'}</div>
                      <div className="mt-1 pt-1 border-t border-slate-600">
                        Status: {colors.label}
                      </div>
                      {room.reservation && (
                        <>
                          <div>{room.reservation.guest_name || 'Guest'}</div>
                          <div className="text-slate-400">
                            {room.reservation.check_in_date} - {room.reservation.check_out_date}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default RoomGrid
