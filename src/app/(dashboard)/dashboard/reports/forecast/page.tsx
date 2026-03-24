'use client'

/**
 * Hotel PMS - Forecast Report Page (KFO Parity)
 * Full KFO Feature Parity
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw, Calendar, TrendingUp, Hotel, DollarSign, Settings2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  ForecastGridEnhanced,
  ForecastCellEditor,
  ForecastKPICards,
  ForecastComparisonChart,
  type ForecastCellData,
} from '@/components/forecast'
import type { ForecastRoomData } from '@/components/forecast/ForecastGridEnhanced'
import {
  generateForecast,
  getForecastRoomGrid,
  adjustForecastItemDirect,
} from '@/lib/actions/forecast-actions'
import { checkRight } from '@/lib/actions/user-rights'
import { FUNCTION_CODES } from '@/lib/constants/function-codes'
import { createClient } from '@/lib/supabase/client'
import { addDays, startOfToday, format } from 'date-fns'
import { th } from 'date-fns/locale'
import { toast } from 'sonner'

// KFO Forecast Summary type (All fields)
interface KFOCForecastRow {
  forecast_date: string
  total_rooms: number
  stayover_rooms: number
  arrival_rooms: number
  departure_rooms: number
  occ_rooms: number
  occ_percentage: number
  comp_rooms: number
  hu_rooms: number
  oo_rooms: number
  oi_rooms: number
  avl_rooms: number
  f_tent: number
  g_tent: number
  occ_pct_tentative: number
  avl_after_tentative: number
  ad_pax: number
  ch_pax: number
  tot_pax: number
  occ_pax: number
  rm_sold: number
  ocr_pct_sale: number
  day_use: number
  def_room_rev: number
  def_avg_room_rev: number
  ten_tot_room_rev: number
  ten_avg_room_rev: number
  tot_room_rev: number
  avg_room_rate: number
  total_revenue: number
  room_revenue: number
  extra_revenue: number
  fit_revenue: number
  grp_revenue: number
  adr: number
  revpar: number
}

// Room Type Forecast type
interface RoomTypeForecast {
  forecast_date: string
  room_type_id: string
  room_type_code: string
  room_type_name: string
  total_rooms: number
  occupied_rooms: number
  available_rooms: number
  occupancy_percentage: number
  stayover_rooms: number
  arrival_rooms: number
  departure_rooms: number
  oo_rooms: number
  oi_rooms: number
  hu_rooms: number
  comp_rooms: number
  tentative_fit: number
  tentative_grp: number
  adult_pax: number
  child_pax: number
  total_pax: number
  day_use_rooms: number
  def_room_rev: number
  def_avg_room_rev: number
  ten_tot_room_rev: number
  ten_avg_room_rev: number
  tot_room_rev: number
  avg_room_rate: number
}

// Occupied by Room Type
interface OccupiedByRoomType {
  forecast_date: string
  room_type_id: string
  room_type_code: string
  room_type_name: string
  occupied_rooms: number
  stayover_rooms: number
  arrival_rooms: number
  departure_rooms: number
  fit_rooms: number
  grp_rooms: number
  hu_rooms: number
  comp_rooms: number
  adult_pax: number
  child_pax: number
  total_pax: number
  room_revenue: number
  extra_revenue: number
  total_revenue: number
  adr: number
}

export default function ForecastReportPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [hasRight, setHasRight] = useState(true)
  const [gridData, setGridData] = useState<ForecastRoomData[]>([])
  const [kfoData, setKfoData] = useState<KFOCForecastRow[]>([])
  const [roomTypeData, setRoomTypeData] = useState<RoomTypeForecast[]>([])
  const [occupiedByTypeData, setOccupiedByTypeData] = useState<OccupiedByRoomType[]>([])
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Filter states
  const [startDate, setStartDate] = useState<Date>(startOfToday())
  const [endDate, setEndDate] = useState<Date>(addDays(startOfToday(), 20))
  const [buildingId, setBuildingId] = useState<string>('')
  const [roomTypeId, setRoomTypeId] = useState<string>('')
  // KFO Filters
  const [roomOnly, setRoomOnly] = useState(false)
  const [revenueInclTentative, setRevenueInclTentative] = useState(true)
  const [noshowRev, setNoshowRev] = useState(false)

  // Cell editor states
  const [selectedCell, setSelectedCell] = useState<ForecastRoomData | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  // Buildings and room types for filters
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([])
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([])

  // Color thresholds from KFO config
  const occLevel1 = 70
  const occLevel2 = 85
  const occLevel3 = 95

  // Check user rights
  useEffect(() => {
    async function checkRights() {
      const right = await checkRight(FUNCTION_CODES.FORECAST, 'can_view')
      setHasRight(right)
    }
    checkRights()
  }, [])

  // Fetch KFO forecast data
  const fetchKFoData = useCallback(async () => {
    if (!propertyId) return
    
    const supabase = createClient()
    
    // Call the new RPC for full KFO data
    const { data, error } = await supabase.rpc('rpc_get_forecast_all', {
      p_start_date: format(startDate, 'yyyy-MM-dd'),
      p_end_date: format(endDate, 'yyyy-MM-dd'),
      p_property_id: propertyId,
      p_room_only: roomOnly,
      p_revenue_incl_tentative: revenueInclTentative,
      p_include_noshow_rev: noshowRev
    })
    
    if (!error && data) {
      setKfoData(data)
    }
    
    // Call RPC for room type availability
    const { data: rtData, error: rtError } = await supabase.rpc('rpc_get_forecast_by_room_type', {
      p_start_date: format(startDate, 'yyyy-MM-dd'),
      p_end_date: format(endDate, 'yyyy-MM-dd'),
      p_property_id: propertyId
    })
    
    if (!rtError && rtData) {
      setRoomTypeData(rtData)
    }
    
    // Call RPC for occupied by room type
    const { data: occData, error: occError } = await supabase.rpc('rpc_get_forecast_occupied_by_room_type', {
      p_start_date: format(startDate, 'yyyy-MM-dd'),
      p_end_date: format(endDate, 'yyyy-MM-dd'),
      p_property_id: propertyId
    })
    
    if (!occError && occData) {
      setOccupiedByTypeData(occData)
    }
  }, [startDate, endDate, propertyId, roomOnly, revenueInclTentative, noshowRev])

  // Fetch grid data
  const fetchGridData = useCallback(async () => {
    if (!propertyId) return
    
    const gridRes = await getForecastRoomGrid({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      buildingId: buildingId || undefined,
      roomTypeId: roomTypeId || undefined,
    })

    if (gridRes.success && gridRes.data) {
      setGridData(gridRes.data)
    }
  }, [startDate, endDate, buildingId, roomTypeId, propertyId])

  // Combined fetch
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([fetchKFoData(), fetchGridData()])
    } catch (error) {
      console.error('Fetch forecast error:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchKFoData, fetchGridData])

  // Generate forecast
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
        toast.success('Forecast generated successfully')
        await fetchData()
      }
    } catch (error) {
      console.error('Generate forecast error:', error)
      toast.error('Failed to generate forecast')
    } finally {
      setGenerating(false)
    }
  }

  // Handle cell editing
  const handleCellClick = (cell: ForecastRoomData) => {
    setSelectedCell(cell)
    setEditorOpen(true)
  }

  const handleCellSave = async (updatedCell: ForecastCellData) => {
    await fetchData()
  }

  // Initialize
  useEffect(() => {
    async function init() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }

      const { data: prop } = await supabase.from('properties').select('id').eq('code', 'MAIN').single()
      if (prop) {
        setPropertyId(prop.id)
      }

      const { data: bldgs } = await supabase.from('buildings').select('id, name')
      if (bldgs) {
        setBuildings(bldgs)
      }

      const { data: types } = await supabase.from('room_types').select('id, name')
      if (types) {
        setRoomTypes(types)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (propertyId) {
      fetchData()
    }
  }, [propertyId, fetchData])

  // Get occupancy color based on KFO thresholds
  const getOccColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-blue-200 text-blue-900'
    if (percentage >= occLevel3) return 'bg-red-100 text-red-800'
    if (percentage >= occLevel2) return 'bg-orange-100 text-orange-800'
    if (percentage >= occLevel1) return 'bg-yellow-100 text-yellow-800'
    return 'bg-white text-slate-800'
  }

  // Format currency
  const fmt = (n: number) => new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n))

  // No rights message
  if (!hasRight) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500">You don't have permission to access Forecast (KC27)</p>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forecast Report</h1>
          <p className="text-slate-500">KFO Parity - Room Forecast with All Fields</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateForecast}
            disabled={generating}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate
          </Button>
        </div>
      </div>

      {/* Filters - KFO Style */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">From Date</Label>
              <Input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">To Date</Label>
              <Input
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Building</Label>
              <Select value={buildingId || 'all'} onValueChange={(v) => setBuildingId(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Room Type</Label>
              <Select value={roomTypeId || 'all'} onValueChange={(v) => setRoomTypeId(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border rounded bg-slate-50">
              <Checkbox
                id="roomOnly"
                checked={roomOnly}
                onCheckedChange={(v) => setRoomOnly(v as boolean)}
              />
              <Label htmlFor="roomOnly" className="text-sm cursor-pointer">Room Only</Label>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border rounded bg-slate-50">
              <Checkbox
                id="revenueInclTentative"
                checked={revenueInclTentative}
                onCheckedChange={(v) => setRevenueInclTentative(v as boolean)}
              />
              <Label htmlFor="revenueInclTentative" className="text-sm cursor-pointer">Rev. Incl. Tentative</Label>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border rounded bg-slate-50">
              <Checkbox
                id="noshowRev"
                checked={noshowRev}
                onCheckedChange={(v) => setNoshowRev(v as boolean)}
              />
              <Label htmlFor="noshowRev" className="text-sm cursor-pointer">No Show Rev.</Label>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm">
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - 3 Tabs like KFO */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All (Aggregated)</TabsTrigger>
          <TabsTrigger value="availability">Availability by Room Type</TabsTrigger>
          <TabsTrigger value="occupied">Occupied by Room Type</TabsTrigger>
        </TabsList>

        {/* Tab 1: All (Aggregated) - Full KFO Grid */}
        <TabsContent value="all" className="space-y-6">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : kfoData.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Forecast Data</h3>
                <p className="text-slate-500 mb-4">
                  Click "Generate" to create forecast data for the selected period.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* KPI Summary Cards */}
              <ForecastKPICards
                data={kfoData.map(d => ({
                  forecast_date: d.forecast_date,
                  total_rooms: d.total_rooms,
                  available_rooms: d.avl_rooms,
                  occupied_rooms: d.occ_rooms,
                  occupancy_percentage: d.occ_percentage,
                  stayover_rooms: d.stayover_rooms,
                  arrival_rooms: d.arrival_rooms,
                  departure_rooms: d.departure_rooms,
                  comp_rooms: d.comp_rooms,
                  hu_rooms: d.hu_rooms,
                  oo_rooms: d.oo_rooms,
                  oi_rooms: d.oi_rooms,
                  tentative_fit: d.f_tent,
                  tentative_grp: d.g_tent,
                  adult_pax: d.ad_pax,
                  child_pax: d.ch_pax,
                  total_pax: d.tot_pax,
                  occupied_pax: d.occ_pax,
                  day_use_rooms: d.day_use,
                  total_revenue: d.total_revenue,
                  room_revenue: d.room_revenue,
                  extra_revenue: d.extra_revenue,
                  fit_revenue: d.fit_revenue,
                  grp_revenue: d.grp_revenue,
                  adr: d.adr,
                  revpar: d.revpar,
                }))}
              />

              {/* Full KFO Grid - All 28+ columns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hotel className="h-5 w-5" />
                    Forecast - All Rooms
                  </CardTitle>
                  <CardDescription>
                    {format(startDate, 'PPP', { locale: th })} - {format(endDate, 'PPP', { locale: th })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="min-w-[2000px]">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-2 text-left border sticky left-0 bg-slate-100 z-10">Date</th>
                          <th className="p-2 text-right border">Total Rm</th>
                          <th className="p-2 text-right border">Stay Over</th>
                          <th className="p-2 text-right border">Arrive</th>
                          <th className="p-2 text-right border">Depart</th>
                          <th className="p-2 text-right border">Occ.</th>
                          <th className="p-2 text-right border">Occ.%</th>
                          <th className="p-2 text-right border">Comp.</th>
                          <th className="p-2 text-right border">H/U</th>
                          <th className="p-2 text-right border">O/O</th>
                          <th className="p-2 text-right border">O/I</th>
                          <th className="p-2 text-right border">Avl.</th>
                          <th className="p-2 text-right border">F.Tent</th>
                          <th className="p-2 text-right border">G.Tent</th>
                          <th className="p-2 text-right border">Occ.%+Tent</th>
                          <th className="p-2 text-right border">Avl-Tent</th>
                          <th className="p-2 text-right border">Ad.pax</th>
                          <th className="p-2 text-right border">Ch.pax</th>
                          <th className="p-2 text-right border">Tot.pax</th>
                          <th className="p-2 text-right border">Occ.pax</th>
                          <th className="p-2 text-right border">Rm.Sold</th>
                          <th className="p-2 text-right border">OCR%</th>
                          <th className="p-2 text-right border">Day use</th>
                          <th className="p-2 text-right border">Def.RoomRev</th>
                          <th className="p-2 text-right border">Def.Avg</th>
                          <th className="p-2 text-right border">Ten.TotRev</th>
                          <th className="p-2 text-right border">Ten.AvgRev</th>
                          <th className="p-2 text-right border">Tot.RoomRev</th>
                          <th className="p-2 text-right border">Avg.Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kfoData.map((row) => (
                          <tr key={row.forecast_date} className="hover:bg-slate-50">
                            <td className="p-2 border font-medium sticky left-0 bg-white">
                              {new Date(row.forecast_date).toLocaleDateString('en-GB', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                              })}
                            </td>
                            <td className="p-2 text-right border">{row.total_rooms}</td>
                            <td className="p-2 text-right border">{row.stayover_rooms}</td>
                            <td className="p-2 text-right border text-blue-600">{row.arrival_rooms}</td>
                            <td className="p-2 text-right border text-red-600">{row.departure_rooms}</td>
                            <td className="p-2 text-right border font-medium">{row.occ_rooms}</td>
                            <td className={`p-2 text-right border font-bold ${getOccColor(row.occ_percentage)}`}>
                              {row.occ_percentage}%
                            </td>
                            <td className="p-2 text-right border">{row.comp_rooms}</td>
                            <td className="p-2 text-right border">{row.hu_rooms}</td>
                            <td className="p-2 text-right border">{row.oo_rooms}</td>
                            <td className="p-2 text-right border">{row.oi_rooms}</td>
                            <td className="p-2 text-right border">{row.avl_rooms}</td>
                            <td className="p-2 text-right border text-purple-600">{row.f_tent}</td>
                            <td className="p-2 text-right border text-purple-600">{row.g_tent}</td>
                            <td className="p-2 text-right border">{row.occ_pct_tentative}%</td>
                            <td className="p-2 text-right border">{row.avl_after_tentative}</td>
                            <td className="p-2 text-right border">{row.ad_pax}</td>
                            <td className="p-2 text-right border">{row.ch_pax}</td>
                            <td className="p-2 text-right border">{row.tot_pax}</td>
                            <td className="p-2 text-right border">{row.occ_pax}</td>
                            <td className="p-2 text-right border">{row.rm_sold}</td>
                            <td className="p-2 text-right border">{row.ocr_pct_sale}%</td>
                            <td className="p-2 text-right border">{row.day_use}</td>
                            <td className="p-2 text-right border">฿{fmt(row.def_room_rev)}</td>
                            <td className="p-2 text-right border">฿{fmt(row.def_avg_room_rev)}</td>
                            <td className="p-2 text-right border">฿{fmt(row.ten_tot_room_rev)}</td>
                            <td className="p-2 text-right border">฿{fmt(row.ten_avg_room_rev)}</td>
                            <td className="p-2 text-right border font-medium">฿{fmt(row.tot_room_rev)}</td>
                            <td className="p-2 text-right border">฿{fmt(row.avg_room_rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Availability by Room Type */}
        <TabsContent value="availability" className="space-y-6">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : roomTypeData.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Data</h3>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Availability by Room Type</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 text-left border">Date</th>
                      <th className="p-2 text-left border">Room Type</th>
                      <th className="p-2 text-right border">Total</th>
                      <th className="p-2 text-right border">Occupied</th>
                      <th className="p-2 text-right border">Available</th>
                      <th className="p-2 text-right border">Occ.%</th>
                      <th className="p-2 text-right border">Stay</th>
                      <th className="p-2 text-right border">Arr</th>
                      <th className="p-2 text-right border">Dep</th>
                      <th className="p-2 text-right border">O/O</th>
                      <th className="p-2 text-right border">H/U</th>
                      <th className="p-2 text-right border">F.Tent</th>
                      <th className="p-2 text-right border">G.Tent</th>
                      <th className="p-2 text-right border">Tot.RoomRev</th>
                      <th className="p-2 text-right border">Avg.Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomTypeData.map((row, idx) => (
                      <tr key={`${row.forecast_date}-${row.room_type_id}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-2 border">
                          {new Date(row.forecast_date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                        <td className="p-2 border font-medium">{row.room_type_name}</td>
                        <td className="p-2 text-right border">{row.total_rooms}</td>
                        <td className="p-2 text-right border">{row.occupied_rooms}</td>
                        <td className="p-2 text-right border">{row.available_rooms}</td>
                        <td className={`p-2 text-right border font-bold ${getOccColor(row.occupancy_percentage)}`}>
                          {row.occupancy_percentage}%
                        </td>
                        <td className="p-2 text-right border">{row.stayover_rooms}</td>
                        <td className="p-2 text-right border text-blue-600">{row.arrival_rooms}</td>
                        <td className="p-2 text-right border text-red-600">{row.departure_rooms}</td>
                        <td className="p-2 text-right border">{row.oo_rooms}</td>
                        <td className="p-2 text-right border">{row.hu_rooms}</td>
                        <td className="p-2 text-right border text-purple-600">{row.tentative_fit}</td>
                        <td className="p-2 text-right border text-purple-600">{row.tentative_grp}</td>
                        <td className="p-2 text-right border">฿{fmt(row.tot_room_rev)}</td>
                        <td className="p-2 text-right border">฿{fmt(row.avg_room_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: Occupied by Room Type */}
        <TabsContent value="occupied" className="space-y-6">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : occupiedByTypeData.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Data</h3>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Occupied by Room Type</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 text-left border">Date</th>
                      <th className="p-2 text-left border">Room Type</th>
                      <th className="p-2 text-right border">Occ.</th>
                      <th className="p-2 text-right border">Stay</th>
                      <th className="p-2 text-right border">Arr</th>
                      <th className="p-2 text-right border">Dep</th>
                      <th className="p-2 text-right border">FIT</th>
                      <th className="p-2 text-right border">GRP</th>
                      <th className="p-2 text-right border">H/U</th>
                      <th className="p-2 text-right border">Adult</th>
                      <th className="p-2 text-right border">Child</th>
                      <th className="p-2 text-right border">Tot.Pax</th>
                      <th className="p-2 text-right border">Room Rev</th>
                      <th className="p-2 text-right border">Extra Rev</th>
                      <th className="p-2 text-right border">Total Rev</th>
                      <th className="p-2 text-right border">ADR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupiedByTypeData.map((row, idx) => (
                      <tr key={`${row.forecast_date}-${row.room_type_id}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-2 border">
                          {new Date(row.forecast_date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                        <td className="p-2 border font-medium">{row.room_type_name}</td>
                        <td className="p-2 text-right border font-bold">{row.occupied_rooms}</td>
                        <td className="p-2 text-right border">{row.stayover_rooms}</td>
                        <td className="p-2 text-right border text-blue-600">{row.arrival_rooms}</td>
                        <td className="p-2 text-right border text-red-600">{row.departure_rooms}</td>
                        <td className="p-2 text-right border text-blue-600">{row.fit_rooms}</td>
                        <td className="p-2 text-right border text-purple-600">{row.grp_rooms}</td>
                        <td className="p-2 text-right border">{row.hu_rooms}</td>
                        <td className="p-2 text-right border">{row.adult_pax}</td>
                        <td className="p-2 text-right border">{row.child_pax}</td>
                        <td className="p-2 text-right border">{row.total_pax}</td>
                        <td className="p-2 text-right border">฿{fmt(row.room_revenue)}</td>
                        <td className="p-2 text-right border">฿{fmt(row.extra_revenue)}</td>
                        <td className="p-2 text-right border font-medium">฿{fmt(row.total_revenue)}</td>
                        <td className="p-2 text-right border">฿{fmt(row.adr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
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
