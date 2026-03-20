'use client'

/**
 * Hotel PMS - Forecast Grid Component
 * Phase 3: Frontend Implementation
 * Room-by-room forecast grid with KFO parity
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Types
export interface ForecastRoomData {
  forecast_date: string
  room_id: string
  room_number: string
  room_label: string
  building_name: string
  room_type_name: string
  room_status: 'available' | 'occupied' | 'oo' | 'oi' | 'hu'
  booking_status: 'B' | 'I' | 'C' | 'O' | 'X' | null
  guest_type: 'FIT' | 'GRP' | 'HOUSE' | null
  pax_adults: number | null
  pax_children: number | null
  rate_code: string | null
  rate_amount: number | null
  expected_revenue: number | null
  total_revenue: number | null
}

export interface ForecastGridProps {
  data: ForecastRoomData[]
  showRevenue?: boolean
  showPax?: boolean
  onCellClick?: (cell: ForecastRoomData) => void
  onCellDoubleClick?: (cell: ForecastRoomData) => void
  selectedCellId?: string
}

// Status colors
const statusColors = {
  available: 'bg-green-50 text-green-700 border-green-200',
  occupied: 'bg-blue-50 text-blue-700 border-blue-200',
  oo: 'bg-gray-50 text-gray-700 border-gray-200',
  oi: 'bg-gray-50 text-gray-700 border-gray-200',
  hu: 'bg-orange-50 text-orange-700 border-orange-200',
}

const bookingStatusColors = {
  B: 'bg-blue-500',
  I: 'bg-indigo-500',
  C: 'bg-gray-400',
  O: 'bg-green-500',
  X: 'bg-red-400',
}

const guestTypeColors = {
  FIT: 'bg-blue-500',
  GRP: 'bg-purple-500',
  HOUSE: 'bg-orange-500',
}

export function ForecastGrid({
  data,
  showRevenue = true,
  showPax = true,
  onCellClick,
  onCellDoubleClick,
  selectedCellId,
}: ForecastGridProps) {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Group data by room and date
  const gridData = useMemo(() => {
    if (!data || data.length === 0) return {}

    const grouped: Record<string, Record<string, ForecastRoomData>> = {}

    // Get date range
    const dates = [...new Set(data.map(d => d.forecast_date))].sort()
    if (dates.length > 0) {
      setStartDate(dates[0])
      setEndDate(dates[dates.length - 1])
    }

    // Group by room number
    data.forEach(item => {
      if (!grouped[item.room_number]) {
        grouped[item.room_number] = {}
      }
      grouped[item.room_number][item.forecast_date] = item
    })

    return grouped
  }, [data])

  // Get all dates
  const dates = useMemo(() => {
    return [...new Set(data.map(d => d.forecast_date))].sort()
  }, [data])

  // Get all rooms
  const rooms = useMemo(() => {
    return [...new Set(data.map(d => d.room_number))].sort()
  }, [data])

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })
  }

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Get booking status label
  const getBookingStatusLabel = (status: string | null) => {
    if (!status) return '-'
    const labels: Record<string, string> = {
      B: 'Book',
      I: 'In',
      C: 'Can',
      O: 'Out',
      X: 'No-Show',
    }
    return labels[status] || status
  }

  // Check if cell is selected
  const isSelected = (cell: ForecastRoomData) => {
    if (!selectedCellId) return false
    return `${cell.room_number}_${cell.forecast_date}` === selectedCellId
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No forecast data available</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Date range indicator */}
      {startDate && endDate && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-md">
          <div className="text-sm text-muted-foreground">
            Forecast Period: <span className="font-medium text-foreground">{formatDate(startDate)}</span>
            {' '}-{' '}
            <span className="font-medium text-foreground">{formatDate(endDate)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {rooms.length} Rooms × {dates.length} Days
          </div>
        </div>
      )}

      {/* Grid */}
      <ScrollArea className="h-[600px] w-full border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="min-w-[120px] sticky left-0 bg-background z-20">
                Room
              </TableHead>
              <TableHead className="min-w-[100px] sticky left-[120px] bg-background z-20">
                Type
              </TableHead>
              {dates.map(date => (
                <TableHead
                  key={date}
                  className="min-w-[100px] text-center"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground">
                      {new Date(date).toLocaleDateString('th-TH', { weekday: 'short' })}
                    </span>
                    <span className="font-medium">{formatDate(date)}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map(roomNumber => {
              const firstCell = gridData[roomNumber]?.[dates[0]]
              return (
                <TableRow key={roomNumber}>
                  {/* Room number */}
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {roomNumber}
                  </TableCell>

                  {/* Room type */}
                  <TableCell className="sticky left-[120px] bg-background z-10 text-sm">
                    {firstCell?.room_type_name || '-'}
                  </TableCell>

                  {/* Date cells */}
                  {dates.map(date => {
                    const cell = gridData[roomNumber]?.[date]

                    if (!cell) {
                      return (
                        <TableCell
                          key={`${roomNumber}_${date}`}
                          className="text-center p-1"
                        >
                          <div className="h-14 w-full" />
                        </TableCell>
                      )
                    }

                    const isOverridden = cell.expected_revenue !== cell.total_revenue

                    return (
                      <TableCell
                        key={`${roomNumber}_${date}`}
                        className={cn(
                          'text-center p-1 cursor-pointer hover:bg-muted/50 transition-colors',
                          isSelected(cell) && 'ring-2 ring-primary ring-offset-2',
                          isOverridden && 'bg-yellow-50'
                        )}
                        onClick={() => onCellClick?.(cell)}
                        onDoubleClick={() => onCellDoubleClick?.(cell)}
                      >
                        <div
                          className={cn(
                            'h-14 w-full rounded-md border-2 flex flex-col items-center justify-center gap-1 p-1',
                            statusColors[cell.room_status]
                          )}
                        >
                          {/* Booking status badge */}
                          {cell.booking_status && (
                            <div
                              className={cn(
                                'w-3 h-3 rounded-full',
                                bookingStatusColors[cell.booking_status]
                              )}
                              title={getBookingStatusLabel(cell.booking_status)}
                            />
                          )}

                          {/* Guest type indicator */}
                          {cell.guest_type && cell.guest_type !== 'HOUSE' && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] h-4 px-1',
                                guestTypeColors[cell.guest_type]
                              )}
                            >
                              {cell.guest_type}
                            </Badge>
                          )}

                          {/* Revenue */}
                          {showRevenue && cell.rate_amount !== null && (
                            <div className="text-xs font-medium">
                              {formatCurrency(cell.rate_amount)}
                            </div>
                          )}

                          {/* Override indicator */}
                          {isOverridden && (
                            <div className="text-[10px] text-yellow-600 font-medium">
                              ★
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-200" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-50 border-2 border-blue-200" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-50 border-2 border-gray-200" />
          <span>OO/OI</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-50 border-2 border-orange-200" />
          <span>House Use</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-50 border-2 border-yellow-200" />
          <span>Overridden</span>
        </div>
      </div>
    </div>
  )
}
