'use client'

/**
 * Hotel PMS - Forecast Grid Page
 * Phase 3: Frontend Implementation
 * Room-by-room forecast grid with full Hotel PMS parity
 */

import React, { useState, useEffect } from 'react'
import { addDays, startOfToday } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ForecastGrid, ForecastRoomData } from '@/components/forecast/ForecastGrid'
import { ForecastFilters } from '@/components/forecast/ForecastFilters'
import { ForecastKPICards, ForecastKPIData } from '@/components/forecast/ForecastKPICards'
import { ForecastCellEditor, ForecastCellData } from '@/components/forecast/ForecastCellEditor'
import { getForecastRoomGrid, getForecastSummary } from '@/lib/actions/forecast-actions'
import { Loader2, RefreshCw, Download, Calendar as CalendarIcon } from 'lucide-react'

export default function ForecastGridPage() {
  // Filter states
  const [startDate, setStartDate] = useState<Date>(() => startOfToday())
  const [endDate, setEndDate] = useState<Date>(() => addDays(startOfToday(), 29))
  const [buildingId, setBuildingId] = useState<string>('')
  const [roomTypeId, setRoomTypeId] = useState<string>('')
  const [showRevenue, setShowRevenue] = useState(true)
  const [showPax, setShowPax] = useState(true)

  // Data states
  const [gridData, setGridData] = useState<ForecastRoomData[]>([])
  const [summaryData, setSummaryData] = useState<ForecastKPIData[]>([])
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([])
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([])

  // Loading states
  const [loading, setLoading] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Selection states
  const [selectedCell, setSelectedCell] = useState<ForecastRoomData | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  // Fetch forecast data
  const fetchForecastData = async () => {
    setLoading(true)
    try {
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const [gridResult, summaryResult] = await Promise.all([
        getForecastRoomGrid({
          startDate: startDateStr,
          endDate: endDateStr,
          buildingId: buildingId || undefined,
          roomTypeId: roomTypeId || undefined,
        }),
        getForecastSummary({
          startDate: startDateStr,
          endDate: endDateStr,
        }),
      ])

      if (gridResult.success && gridResult.data) {
        setGridData(gridResult.data as ForecastRoomData[])
      }

      if (summaryResult.success && summaryResult.data) {
        setSummaryData(summaryResult.data as ForecastKPIData[])
      }
    } catch (error) {
      console.error('Failed to fetch forecast data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    // Mock buildings and room types (replace with API calls)
    setBuildings([
      { id: '1', name: 'Building A' },
      { id: '2', name: 'Building B' },
      { id: '3', name: 'Building C' },
    ])
    setRoomTypes([
      { id: '1', name: 'Standard' },
      { id: '2', name: 'Deluxe' },
      { id: '3', name: 'Suite' },
      { id: '4', name: 'Premium Suite' },
    ])

    fetchForecastData()
  }, [])

  // Handle cell click
  const handleCellClick = (cell: ForecastRoomData) => {
    setSelectedCell(cell)
  }

  // Handle cell double click (open editor)
  const handleCellDoubleClick = (cell: ForecastRoomData) => {
    setSelectedCell(cell)
    setEditorOpen(true)
  }

  // Handle save from editor
  const handleEditorSave = (updatedCell: ForecastCellData) => {
    // Update grid data with the modified cell
    setGridData(prevData =>
      prevData.map((cell: any) =>
        cell.id === (updatedCell as any).id ? { ...cell, ...updatedCell } : cell
      )
    )

    // Refresh summary data
    fetchForecastData()
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchForecastData()
  }

  // Handle apply filters
  const handleApplyFilters = () => {
    fetchForecastData()
  }

  // Handle reset filters
  const handleResetFilters = () => {
    setBuildingId('')
    setRoomTypeId('')
    fetchForecastData()
  }

  // Handle export
  const handleExport = () => {
    // Convert data to CSV
    const headers = ['Date', 'Room', 'Type', 'Status', 'Booking', 'Guest Type', 'Pax', 'Rate', 'Revenue']
    const rows = gridData.map(d => [
      d.forecast_date,
      d.room_number,
      d.room_type_name,
      d.room_status,
      d.booking_status || '-',
      d.guest_type || '-',
      d.pax_adults && d.pax_children ? `${d.pax_adults}/${d.pax_children}` : '-',
      d.rate_amount || '-',
      d.total_revenue || '-',
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

    // Download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forecast-grid-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const formatDateRange = () => {
    return `${startDate.toLocaleDateString('th-TH')} - ${endDate.toLocaleDateString('th-TH')}`
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forecast Grid</h1>
          <p className="text-muted-foreground">
            Room-by-room forecast with Hotel PMS parity
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <ForecastKPICards
        data={summaryData}
        loading={loading || loadingSummary}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <ForecastFilters
            startDate={startDate}
            endDate={endDate}
            buildingId={buildingId}
            roomTypeId={roomTypeId}
            showRevenue={showRevenue}
            showPax={showPax}
            onStartDateChange={(date) => setStartDate(date ?? new Date())}
            onEndDateChange={(date) => setEndDate(date ?? new Date())}
            onBuildingChange={setBuildingId}
            onRoomTypeChange={setRoomTypeId}
            onShowRevenueChange={setShowRevenue}
            onShowPaxChange={setShowPax}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            buildings={buildings}
            roomTypes={roomTypes}
            loading={loading}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Forecast Grid */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Room-by-Room Forecast</CardTitle>
                  <CardDescription>
                    {formatDateRange()}
                  </CardDescription>
                </div>
                {loading && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading && gridData.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>Loading forecast data...</p>
                  </div>
                </div>
              ) : (
                <ForecastGrid
                  data={gridData}
                  showRevenue={showRevenue}
                  showPax={showPax}
                  onCellClick={handleCellClick}
                  onCellDoubleClick={handleCellDoubleClick}
                  selectedCellId={selectedCell ? `${selectedCell.room_number}_${selectedCell.forecast_date}` : undefined}
                />
              )}
            </CardContent>
          </Card>

          {/* Selected Cell Details */}
          {selectedCell && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Room Details</CardTitle>
                <CardDescription>
                  Room {selectedCell.room_number} - {selectedCell.forecast_date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Room Type</p>
                    <p className="font-medium">{selectedCell.room_type_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{selectedCell.room_status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Booking</p>
                    <p className="font-medium">{selectedCell.booking_status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Guest Type</p>
                    <p className="font-medium">{selectedCell.guest_type || '-'}</p>
                  </div>
                  {selectedCell.rate_amount !== null && (
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-medium">
                        ฿{selectedCell.rate_amount.toLocaleString('th-TH')}
                      </p>
                    </div>
                  )}
                  {selectedCell.pax_adults !== null && (
                    <div>
                      <p className="text-muted-foreground">Pax (A/C)</p>
                      <p className="font-medium">
                        {selectedCell.pax_adults} / {selectedCell.pax_children}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={() => setEditorOpen(true)}
                    className="w-full"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Adjust Forecast
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Cell Editor Dialog */}
      <ForecastCellEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        cell={selectedCell as ForecastCellData | null}
        onSave={handleEditorSave}
      />
    </div>
  )
}
