'use client'

/**
 * Hotel PMS - Forecast Report Page (Enhanced)
 * KFO Parity - Room-by-Room Forecast Grid
 * Phase 3: Frontend Implementation
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Calendar, TrendingUp, Hotel, DollarSign } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ForecastGridEnhanced,
  ForecastFilters,
  ForecastCellEditor,
  ForecastKPICards,
  ForecastComparisonChart,
  type ForecastCellData,
} from '@/components/forecast'
import type { ForecastRoomData } from '@/components/forecast/ForecastGridEnhanced'
import { getForecastAction } from '@/lib/actions/forecast'
import {
  generateForecast,
  getForecastRoomGrid,
  getForecastSummary,
  adjustForecastItemDirect,
} from '@/lib/actions/forecast-actions'
import { createClient } from '@/lib/supabase/client'
import { addDays, startOfToday, format } from 'date-fns'
import { th } from 'date-fns/locale'

// Forecast summary types
interface ForecastSummary {
  forecast_date: string
  total_rooms: number
  expected_occupancy: number
  expected_revenue: number
  occupancy_percentage: number
  adr: number
  revpar: number
}

export default function ForecastReportPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [gridData, setGridData] = useState<ForecastRoomData[]>([])
  const [summaryData, setSummaryData] = useState<ForecastSummary[]>([])
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Filter states
  const [startDate, setStartDate] = useState<Date>(startOfToday())
  const [endDate, setEndDate] = useState<Date>(addDays(startOfToday(), 30))
  const [buildingId, setBuildingId] = useState<string>('')
  const [roomTypeId, setRoomTypeId] = useState<string>('')
  const [showRevenue, setShowRevenue] = useState(true)
  const [showPax, setShowPax] = useState(true)

  // Cell editor states
  const [selectedCell, setSelectedCell] = useState<ForecastRoomData | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  // Buildings and room types for filters
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([])
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([])

  // Fetch initial data
  const fetchData = useCallback(async (propId: string) => {
    setLoading(true)
    try {
      // Get summary using the existing action
      const res = await getForecastAction(propId, 30)
      if (res.success && res.data) {
        setSummaryData(res.data)
      }

      // Get grid data using new RPC function
      const gridRes = await getForecastRoomGrid({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        buildingId: buildingId || undefined,
        roomTypeId: roomTypeId || undefined,
      })

      if (gridRes.success && gridRes.data) {
        setGridData(gridRes.data)
      }
    } catch (error) {
      console.error('Fetch forecast error:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, buildingId, roomTypeId])

  // Generate forecast data
  const handleGenerateForecast = async () => {
    if (!propertyId) return

    setGenerating(true)
    try {
      const result = await generateForecast({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        userId: userId || undefined,
      })

      if (result.success) {
        // Refresh data
        await fetchData(propertyId)
      }
    } catch (error) {
      console.error('Generate forecast error:', error)
    } finally {
      setGenerating(false)
    }
  }

  // Handle cell click for editing
  const handleCellClick = (cell: ForecastRoomData) => {
    setSelectedCell(cell)
    setEditorOpen(true)
  }

  // Handle cell save
  const handleCellSave = async (updatedCell: ForecastCellData) => {
    // Refresh grid data
    if (propertyId) {
      await fetchData(propertyId)
    }
  }

  // Initialize
  useEffect(() => {
    async function init() {
      const supabase = createClient()

      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }

      // Get property
      const { data: prop } = await supabase.from('properties').select('id').eq('code', 'MAIN').single()
      if (prop) {
        setPropertyId(prop.id)
        await fetchData(prop.id)
      }

      // Get buildings
      const { data: bldgs } = await supabase.from('buildings').select('id, name')
      if (bldgs) {
        setBuildings(bldgs)
      }

      // Get room types
      const { data: types } = await supabase.from('room_types').select('id, name')
      if (types) {
        setRoomTypes(types)
      }
    }
    init()
  }, [])

  // Refresh when filters change
  useEffect(() => {
    if (propertyId) {
      fetchData(propertyId)
    }
  }, [propertyId, startDate, endDate, buildingId, roomTypeId])

  if (loading && gridData.length === 0) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  // Calculate KPIs
  const avgOcc = summaryData.length > 0
    ? Math.round(summaryData.reduce((sum, f) => sum + f.occupancy_percentage, 0) / summaryData.length)
    : 0
  const avgAdr = summaryData.length > 0
    ? Math.round(summaryData.reduce((sum, f) => sum + f.adr, 0) / (summaryData.filter(f => f.adr > 0).length || 1))
    : 0
  const avgRevpar = summaryData.length > 0
    ? Math.round(summaryData.reduce((sum, f) => sum + f.revpar, 0) / summaryData.length)
    : 0
  const totalRev = summaryData.reduce((sum, f) => sum + Number(f.expected_revenue), 0)

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forecast Report</h1>
          <p className="text-slate-500">Room-by-room forecast with KFO parity</p>
        </div>
        <Button
          onClick={handleGenerateForecast}
          disabled={generating}
          className="gap-2"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Generate Forecast
        </Button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="grid" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        {/* Grid View Tab */}
        <TabsContent value="grid" className="space-y-6">
          {/* Filters */}
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
            buildings={buildings}
            roomTypes={roomTypes}
            onApply={() => propertyId && fetchData(propertyId)}
          />

          {/* Grid */}
          {gridData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hotel className="h-5 w-5" />
                  Room-by-Room Forecast Grid
                </CardTitle>
                <CardDescription>
                  {format(startDate, 'PPP', { locale: th })} - {format(endDate, 'PPP', { locale: th })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ForecastGridEnhanced
                  data={gridData}
                  showRevenue={showRevenue}
                  showPax={showPax}
                  showSegmentBreakdown={true}
                  onCellClick={handleCellClick}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Forecast Data</h3>
                <p className="text-slate-500 mb-4">
                  Click "Generate Forecast" to create forecast data for the selected period.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          {/* KPI Cards */}
          <ForecastKPICards
            data={summaryData.map((item) => ({
              forecast_date: item.forecast_date,
              total_rooms: item.total_rooms,
              available_rooms: item.total_rooms - item.expected_occupancy,
              occupied_rooms: item.expected_occupancy,
              occupancy_percentage: item.occupancy_percentage,
              // KFO Fields - Room Status
              stayover_rooms: Math.floor(item.expected_occupancy * 0.6), // Estimate: 60% stayover
              arrival_rooms: Math.floor(item.expected_occupancy * 0.25), // Estimate: 25% arrivals
              departure_rooms: Math.floor(item.expected_occupancy * 0.15), // Estimate: 15% departures
              comp_rooms: 0,
              hu_rooms: 0,
              oo_rooms: 0,
              oi_rooms: 0,
              // Tentative/Booking Status
              tentative_fit: 0,
              tentative_grp: 0,
              // Pax
              adult_pax: Math.floor(item.expected_occupancy * 1.5),
              child_pax: Math.floor(item.expected_occupancy * 0.3),
              total_pax: Math.floor(item.expected_occupancy * 1.8),
              occupied_pax: Math.floor(item.expected_occupancy * 1.8),
              // Day Use
              day_use_rooms: 0,
              // Revenue
              total_revenue: Number(item.expected_revenue),
              room_revenue: Number(item.expected_revenue),
              extra_revenue: 0,
              fit_revenue: 0,
              grp_revenue: 0,
              adr: item.adr,
              revpar: item.revpar,
            }))}
          />

          {/* Detailed Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Forecast Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50/50">
                      <th className="text-left py-3 px-4 font-medium text-slate-500 rounded-tl-lg">Date</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Occ. Rooms / Total</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Occupancy %</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Expected Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">ADR</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500 rounded-tr-lg">RevPAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaryData.map(f => (
                      <tr key={f.forecast_date} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {new Date(f.forecast_date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {f.expected_occupancy} / {f.total_rooms}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium
                              ${f.occupancy_percentage >= 80
                                ? 'bg-emerald-100 text-emerald-700'
                                : f.occupancy_percentage >= 50
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-600'}
                            `}
                          >
                            {f.occupancy_percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900">
                          ฿{Number(f.expected_revenue).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          ฿{f.adr.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          ฿{f.revpar.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Forecast vs Actual Comparison
              </CardTitle>
              <CardDescription>
                Compare forecasted values with actual results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ForecastComparisonChart
                data={summaryData.map((item) => ({
                  forecast_date: item.forecast_date,
                  forecast_revenue: Number(item.expected_revenue),
                  actual_revenue: Number(item.expected_revenue),
                  forecast_adr: item.adr,
                  actual_adr: item.adr,
                  forecast_revpar: item.revpar,
                  actual_revpar: item.revpar,
                  forecast_occupancy: item.occupancy_percentage,
                  actual_occupancy: item.occupancy_percentage,
                  variance_percentage: 0,
                  accuracy_classification: 'forecast' as const,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cell Editor Dialog */}
      {selectedCell && (
        <ForecastCellEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          cell={{
            id: selectedCell.room_id,
            forecast_date: selectedCell.forecast_date,
            room_number: selectedCell.room_number,
            room_type_name: selectedCell.room_type_name,
            room_status: selectedCell.room_status,
            booking_status: selectedCell.booking_status,
            guest_type: selectedCell.guest_type,
            pax_adults: selectedCell.pax_adults,
            pax_children: selectedCell.pax_children,
            rate_amount: selectedCell.rate_amount,
            total_revenue: selectedCell.total_revenue,
            is_override: selectedCell.is_override,
            original_rate_amount: selectedCell.rate_amount,
            original_revenue: selectedCell.total_revenue,
          }}
          onSave={handleCellSave}
          userId={userId || undefined}
        />
      )}
    </div>
  )
}
