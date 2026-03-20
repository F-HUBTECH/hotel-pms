'use client'

/**
 * Hotel PMS - Forecast Summary Page
 * Phase 5: Frontend Pages
 * Forecast summary with KPIs and breakdown analysis
 */

import React, { useState, useEffect } from 'react'
import { addDays, startOfToday, subDays, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ForecastKPICards, ForecastSummary, ForecastKPIData } from '@/components/forecast/ForecastKPICards'
import { ForecastComparisonChart, ForecastComparisonData } from '@/components/forecast/ForecastComparisonChart'
import { ForecastFilters } from '@/components/forecast/ForecastFilters'
import { getForecastSummary } from '@/lib/actions/forecast-actions'
import { Loader2, RefreshCw, Download, Calendar, TrendingUp, BarChart3 } from 'lucide-react'

export default function ForecastSummaryPage() {
  // Filter states
  const [startDate, setStartDate] = useState<Date>(() => startOfToday())
  const [endDate, setEndDate] = useState<Date>(() => addDays(startOfToday(), 29))
  const [buildingId, setBuildingId] = useState<string>('')

  // Data states
  const [summaryData, setSummaryData] = useState<ForecastKPIData[]>([])
  const [comparisonData, setComparisonData] = useState<ForecastComparisonData[]>([])

  // Loading states
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch forecast data
  const fetchForecastData = async () => {
    setLoading(true)
    try {
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const result = await getForecastSummary({
        startDate: startDateStr,
        endDate: endDateStr,
        propertyId: undefined,
      })

      if (result.success && result.data) {
        setSummaryData(result.data as ForecastKPIData[])

        // Transform to comparison data (with mock actuals)
        const comparison = (result.data as ForecastKPIData[]).map(d => ({
          forecast_date: d.forecast_date,
          forecast_revenue: d.total_revenue,
          actual_revenue: d.total_revenue, // Use forecast as actual for demo
          forecast_adr: d.adr,
          actual_adr: d.adr,
          forecast_revpar: d.revpar,
          actual_revpar: d.revpar,
          forecast_occupancy: d.occupancy_percentage,
          variance_percentage: 0,
          accuracy_classification: 'forecast' as const,
        }))
        setComparisonData(comparison)
      }
    } catch (error) {
      console.error('Failed to fetch forecast data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchForecastData()
  }, [])

  // Handle date presets
  const setDateRange = (preset: 'today' | 'week' | 'month' | 'quarter') => {
    const today = startOfToday()
    switch (preset) {
      case 'today':
        setStartDate(today)
        setEndDate(today)
        break
      case 'week':
        setStartDate(subDays(today, 6))
        setEndDate(today)
        break
      case 'month':
        setStartDate(subDays(today, 29))
        setEndDate(today)
        break
      case 'quarter':
        setStartDate(subDays(today, 89))
        setEndDate(today)
        break
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchForecastData()
  }

  // Handle apply filters
  const handleApplyFilters = () => {
    fetchForecastData()
  }

  // Handle export
  const handleExport = () => {
    // Convert data to CSV
    const headers = ['Date', 'Total Revenue', 'Room Revenue', 'Extra Revenue', 'Occupancy %', 'ADR', 'RevPAR']
    const rows = summaryData.map(d => [
      d.forecast_date,
      d.total_revenue.toFixed(2),
      d.room_revenue.toFixed(2),
      d.extra_revenue.toFixed(2),
      d.occupancy_percentage.toFixed(2),
      d.adr.toFixed(2),
      d.revpar.toFixed(2),
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forecast-summary-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const formatDateRange = () => {
    return `${format(startDate, 'PPP')} - ${format(endDate, 'PPP')}`
  }

  // Calculate weekly breakdown
  const weeklyBreakdown = React.useMemo(() => {
    if (summaryData.length === 0) return []

    const weeks: any[] = []
    let currentWeek: any[] = []

    summaryData.forEach((day, index) => {
      const date = new Date(day.forecast_date)
      const dayOfWeek = date.getDay()

      currentWeek.push(day)

      // End of week (Sunday) or last day
      if (dayOfWeek === 0 || index === summaryData.length - 1) {
        const weekTotal = currentWeek.reduce((sum, d) => sum + d.total_revenue, 0)
        const weekAvgOccupancy = currentWeek.reduce((sum, d) => sum + d.occupancy_percentage, 0) / currentWeek.length

        weeks.push({
          week: weeks.length + 1,
          startDate: currentWeek[0].forecast_date,
          endDate: currentWeek[currentWeek.length - 1].forecast_date,
          totalRevenue: weekTotal,
          avgOccupancy: weekAvgOccupancy,
          days: currentWeek.length,
        })
        currentWeek = []
      }
    })

    return weeks
  }, [summaryData])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forecast Summary</h1>
          <p className="text-muted-foreground">
            Comprehensive forecast analysis with KPIs and breakdown
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
            Export
          </Button>
        </div>
      </div>

      {/* Date Presets */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange('today')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange('week')}
        >
          Last 7 Days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange('month')}
        >
          Last 30 Days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange('quarter')}
        >
          Last 90 Days
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <ForecastFilters
            startDate={startDate}
            endDate={endDate}
            buildingId={buildingId}
            onStartDateChange={(date) => setStartDate(date ?? new Date())}
            onEndDateChange={(date) => setEndDate(date ?? new Date())}
            onBuildingChange={setBuildingId}
            onApply={handleApplyFilters}
            buildings={[
              { id: '1', name: 'Building A' },
              { id: '2', name: 'Building B' },
              { id: '3', name: 'Building C' },
            ]}
            loading={loading}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPI Cards */}
          <ForecastKPICards
            data={summaryData}
            loading={loading}
          />

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">
                <BarChart3 className="mr-2 h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="detailed">
                <Calendar className="mr-2 h-4 w-4" />
                Detailed
              </TabsTrigger>
              <TabsTrigger value="comparison">
                <TrendingUp className="mr-2 h-4 w-4" />
                Comparison
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Forecast Overview</CardTitle>
                  <CardDescription>{formatDateRange()}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ForecastSummary data={summaryData} loading={loading} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Detailed Tab */}
            <TabsContent value="detailed" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Forecast Details</CardTitle>
                  <CardDescription>Day-by-day breakdown of forecast data</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {summaryData.map((day, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-medium">
                              {format(new Date(day.forecast_date), 'PPP')}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(day.forecast_date), 'EEEE')}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Revenue</p>
                              <p className="font-medium">
                                ฿{day.total_revenue.toLocaleString('th-TH')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Occupancy</p>
                              <p className="font-medium">{day.occupancy_percentage.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">ADR</p>
                              <p className="font-medium">
                                ฿{day.adr.toLocaleString('th-TH')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">RevPAR</p>
                              <p className="font-medium">
                                ฿{day.revpar.toLocaleString('th-TH')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Comparison Tab */}
            <TabsContent value="comparison" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Forecast vs Actual Comparison</CardTitle>
                  <CardDescription>Compare forecasted values with actual results</CardDescription>
                </CardHeader>
                <CardContent>
                  <ForecastComparisonChart data={comparisonData} loading={loading} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
