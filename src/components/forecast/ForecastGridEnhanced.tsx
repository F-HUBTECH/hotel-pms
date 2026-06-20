'use client'

/**
 * Hotel PMS - Enhanced Forecast Grid Component
 * Phase 7: Implement Features
 * Enhanced with FIT vs GRP breakdown and Hotel PMS parity
 */

import React, { useState, useMemo, useRef, useCallback } from 'react'
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

export interface ForecastRoomData {
  forecast_date: string
  room_id: string
  room_number: string
  room_label: string
  building_name: string
  room_type_name: string
  room_type_code: string
  room_status: 'available' | 'occupied' | 'oo' | 'oi' | 'hu'
  booking_status: 'B' | 'I' | 'C' | 'O' | 'X' | null
  guest_type: 'FIT' | 'GRP' | 'HOUSE' | null
  pax_adults: number | null
  pax_children: number | null
  total_pax: number | null
  rate_code: string | null
  rate_amount: number | null
  expected_revenue: number | null
  total_revenue: number | null
  is_override: boolean
  override_reason?: string | null
  grp_revenue_amount?: number
  fit_revenue_amount?: number
}

export interface ForecastGridEnhancedProps {
  data: ForecastRoomData[]
  showRevenue?: boolean
  showPax?: boolean
  showSegmentBreakdown?: boolean
  onCellClick?: (cell: ForecastRoomData) => void
  onCellDoubleClick?: (cell: ForecastRoomData) => void
  selectedCellId?: string
  virtualScroll?: boolean
  rowHeight?: number
}

// Semantic color palette per DESIGN.md: Emerald Moss (success), Amber Grain (warning), Red Clay (destructive), Deep Indigo (accent)
const statusColors = {
  available: 'bg-white border-2 border-emerald-300 text-emerald-800',
  occupied_fit: 'bg-indigo-50 border-2 border-indigo-200 text-indigo-800',
  occupied_grp: 'bg-indigo-100 border-2 border-indigo-300 text-indigo-900',
  occupied_house: 'bg-amber-50 border-2 border-amber-200 text-amber-800',
  oo: 'bg-rose-50 border-2 border-rose-200 text-rose-800',
  oi: 'bg-rose-100 border-2 border-rose-300 text-rose-800',
  hu: 'bg-amber-50 border-2 border-amber-200 text-amber-800',
}

const bookingStatusColors = {
  B: 'bg-indigo-500', // Booked
  I: 'bg-indigo-700', // In House
  C: 'bg-slate-400', // Cancelled
  O: 'bg-emerald-500', // Checked Out
  X: 'bg-rose-500', // No Show
}

const guestTypeBadges = {
  FIT: 'bg-indigo-500 text-white border-indigo-600',
  GRP: 'bg-indigo-700 text-white border-indigo-800',
  HOUSE: 'bg-amber-500 text-white border-amber-600',
}

export function ForecastGridEnhanced({
  data,
  showRevenue = true,
  showPax = true,
  showSegmentBreakdown = false,
  onCellClick,
  onCellDoubleClick,
  selectedCellId,
  virtualScroll = false,
  rowHeight = 60,
}: ForecastGridEnhancedProps) {
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

  // Get all dates and rooms
  const dates = useMemo(() => {
    return [...new Set(data.map(d => d.forecast_date))].sort()
  }, [data])

  const rooms = useMemo(() => {
    return [...new Set(data.map(d => d.room_number))].sort((a, b) => {
      // Sort rooms numerically if possible
      const numA = parseInt(a.replace(/\D/g, ''), 10)
      const numB = parseInt(b.replace(/\D/g, ''), 10)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
      return a.localeCompare(b)
    })
  }, [data])

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const dayName = date.toLocaleDateString('th-TH', { weekday: 'short' })
    const dayNum = date.getDate()
    const monthNum = date.getMonth() + 1
    return `${dayNum}/${monthNum}`
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
      B: 'BK',
      I: 'IH',
      C: 'CN',
      O: 'CO',
      X: 'NS',
    }
    return labels[status] || status
  }

  // Get cell status class (Hotel PMS parity)
  const getCellStatusClass = (cell: ForecastRoomData) => {
    if (cell.is_override) {
      return 'bg-yellow-50 border-2 border-yellow-400'
    }

    switch (cell.room_status) {
      case 'available':
        return statusColors.available
      case 'occupied':
        // Distinguish by guest type
        if (cell.guest_type === 'GRP') return statusColors.occupied_grp
        if (cell.guest_type === 'HOUSE') return statusColors.occupied_house
        return statusColors.occupied_fit
      case 'oo':
        return statusColors.oo
      case 'oi':
        return statusColors.oi
      case 'hu':
        return statusColors.hu
      default:
        return statusColors.available
    }
  }

  // Check if cell is selected
  const isSelected = (cell: ForecastRoomData) => {
    if (!selectedCellId) return false
    return `${cell.room_number}_${cell.forecast_date}` === selectedCellId
  }

  // Virtual scrolling implementation
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!virtualScroll) return
    const container = e.currentTarget
    const scrollTop = container.scrollTop
    const viewportHeight = container.clientHeight

    const start = Math.floor(scrollTop / rowHeight)
    const end = Math.min(
      start + Math.ceil(viewportHeight / rowHeight) + 10,
      rooms.length
    )

    setVisibleRange({ start, end })
  }, [virtualScroll, rowHeight, rooms.length])

  const visibleRooms = virtualScroll
    ? rooms.slice(visibleRange.start, visibleRange.end)
    : rooms

  // Calculate FIT vs GRP breakdown
  const segmentStats = useMemo(() => {
    if (!data || data.length === 0) {
      return { fit: 0, grp: 0, house: 0, fitPct: 0, grpPct: 0 }
    }

    const fitRooms = data.filter(d => d.guest_type === 'FIT' && d.room_status === 'occupied').length
    const grpRooms = data.filter(d => d.guest_type === 'GRP' && d.room_status === 'occupied').length
    const houseRooms = data.filter(d => d.guest_type === 'HOUSE' && d.room_status === 'occupied').length
    const totalOccupied = fitRooms + grpRooms + houseRooms

    return {
      fit: fitRooms,
      grp: grpRooms,
      house: houseRooms,
      fitPct: totalOccupied > 0 ? (fitRooms / totalOccupied) * 100 : 0,
      grpPct: totalOccupied > 0 ? (grpRooms / totalOccupied) * 100 : 0,
      housePct: totalOccupied > 0 ? (houseRooms / totalOccupied) * 100 : 0,
    }
  }, [data])

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

      {/* FIT vs GRP Breakdown Toggle */}
      {showSegmentBreakdown && (
        <div className="flex items-center gap-4 px-4 py-2 bg-blue-50 rounded-md border border-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-sm">FIT: {segmentStats.fit} ({segmentStats.fitPct?.toFixed(1) ?? '0.0'}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500" />
            <span className="text-sm">GRP: {segmentStats.grp} ({segmentStats.grpPct?.toFixed(1) ?? '0.0'}%)</span>
          </div>
          {segmentStats.house > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span className="text-sm">HOUSE: {segmentStats.house} ({segmentStats.housePct?.toFixed(1) ?? '0.0'}%)</span>
            </div>
          )}
        </div>
      )}

      {/* Grid with Virtual Scrolling */}
      <ScrollArea
        ref={scrollContainerRef}
        className="h-[600px] w-full border rounded-md"
        onScroll={handleScroll}
      >
        <div style={{ height: virtualScroll ? rooms.length * rowHeight : 'auto' }}>
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[80px] sticky left-0 bg-background z-20">
                  Room
                </TableHead>
                <TableHead className="min-w-[80px] sticky left-[80px] bg-background z-20">
                  Type
                </TableHead>
                {dates.map(date => (
                  <TableHead
                    key={date}
                    className="min-w-[90px] text-center"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {new Date(date).toLocaleDateString('th-TH', { weekday: 'short' })}
                      </span>
                      <span className="text-sm font-semibold">{formatDate(date)}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRooms.map((roomNumber, idx) => {
                const firstCell = gridData[roomNumber]?.[dates[0]]
                const actualIndex = virtualScroll ? visibleRange.start + idx : idx
                const cellStyle = virtualScroll
                  ? { position: 'absolute', top: actualIndex * rowHeight, width: '100%' } as React.CSSProperties
                  : {}

                return (
                  <TableRow
                    key={roomNumber}
                    style={cellStyle}
                  >
                    {/* Room number */}
                    <TableCell
                      className="sticky left-0 bg-background z-10 font-medium"
                      style={virtualScroll ? { left: 0, height: rowHeight } : undefined}
                    >
                      {roomNumber}
                    </TableCell>

                    {/* Room type */}
                    <TableCell
                      className="sticky left-[80px] bg-background z-10 text-xs"
                      style={virtualScroll ? { left: '80px', height: rowHeight } : undefined}
                    >
                      <Badge variant="outline" className="text-[10px]">
                        {firstCell?.room_type_code || firstCell?.room_type_name}
                      </Badge>
                    </TableCell>

                    {/* Date cells */}
                    {dates.map(date => {
                      const cell = gridData[roomNumber]?.[date]

                      if (!cell) {
                        return (
                          <TableCell
                            key={`${roomNumber}_${date}`}
                            className="text-center p-0"
                            style={{ height: rowHeight }}
                          >
                            <div className="h-full w-full" />
                          </TableCell>
                        )
                      }

                      const cellClass = getCellStatusClass(cell)

                      return (
                        <TableCell
                          key={`${roomNumber}_${date}`}
                          className={cn(
                            'text-center p-0 cursor-pointer hover:bg-opacity-80 transition-all',
                            cellClass,
                            isSelected(cell) && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                          )}
                          style={{ height: rowHeight }}
                          onClick={() => onCellClick?.(cell)}
                          onDoubleClick={() => onCellDoubleClick?.(cell)}
                        >
                          <div className="h-full w-full flex flex-col items-center justify-center gap-0.5 p-1">
                            {/* Booking status badge (Hotel PMS style - small colored dot) */}
                            {cell.booking_status && cell.booking_status !== 'C' && (
                              <div
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full',
                                  bookingStatusColors[cell.booking_status]
                                )}
                                title={getBookingStatusLabel(cell.booking_status)}
                              />
                            )}

                            {/* Guest type badge (Hotel PMS style) */}
                            {cell.guest_type && cell.guest_type !== 'HOUSE' && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[9px] h-3.5 px-0.5 font-medium',
                                  guestTypeBadges[cell.guest_type]
                                )}
                              >
                                {cell.guest_type}
                              </Badge>
                            )}

                            {/* Pax display (Hotel PMS style) */}
                            {showPax && cell.total_pax && cell.total_pax > 0 && (
                              <div className="text-[10px] font-medium">
                                {cell.total_pax}
                              </div>
                            )}

                            {/* Revenue (Hotel PMS style) */}
                            {showRevenue && cell.rate_amount !== null && cell.rate_amount > 0 && (
                              <div className="text-[10px] font-semibold">
                                {cell.rate_amount.toLocaleString('th-TH')}
                              </div>
                            )}

                            {/* Override indicator */}
                            {cell.is_override && (
                              <div className="text-[9px] text-yellow-600 font-bold">★</div>
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
        </div>
      </ScrollArea>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs bg-muted p-3 rounded-md">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white border-2 border-green-300" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-400" />
          <span>FIT</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-100 border-2 border-purple-400" />
          <span>GRP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-100 border-2 border-orange-400" />
          <span>House</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200 border-2 border-gray-400" />
          <span>OO</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-50 border-2 border-orange-300" />
          <span>HU</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-50 border-2 border-yellow-400" />
          <span>Override</span>
        </div>
      </div>
    </div>
  )
}
