'use client'

/**
 * Hotel PMS - Forecast Comparison Chart Component
 * Phase 5: Frontend Components
 * Visualizes forecast vs actual comparison with interactive charts
 */

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Types
export interface ForecastComparisonData {
  forecast_date: string
  forecast_revenue: number
  actual_revenue: number
  forecast_adr: number
  actual_adr: number
  forecast_revpar: number
  actual_revpar: number
  forecast_occupancy: number
  actual_occupancy?: number
  variance_percentage: number
  accuracy_classification: 'forecast' | 'both_zero' | 'excellent' | 'good' | 'fair' | 'poor'
}

export interface ForecastComparisonChartProps {
  data: ForecastComparisonData[]
  loading?: boolean
}

export function ForecastComparisonChart({
  data,
  loading = false,
}: ForecastComparisonChartProps) {
  // Calculate aggregate statistics
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalForecastRevenue: 0,
        totalActualRevenue: 0,
        totalVariance: 0,
        avgAccuracy: 0,
        excellentDays: 0,
        goodDays: 0,
        fairDays: 0,
        poorDays: 0,
      }
    }

    const totalForecastRevenue = data.reduce((sum, d) => sum + d.forecast_revenue, 0)
    const totalActualRevenue = data.reduce((sum, d) => sum + d.actual_revenue, 0)
    const totalVariance = data.reduce((sum, d) => sum + Math.abs(d.variance_percentage), 0)
    const avgAccuracy = data.length > 0 ? (100 - (totalVariance / data.length)) : 0

    const classificationCounts = data.reduce(
      (acc, d) => {
        if (d.accuracy_classification !== 'forecast' && d.accuracy_classification !== 'both_zero') {
          acc[d.accuracy_classification]++
        }
        return acc
      },
      { excellent: 0, good: 0, fair: 0, poor: 0 }
    )

    return {
      totalForecastRevenue,
      totalActualRevenue,
      totalVariance,
      avgAccuracy,
      ...classificationCounts,
    }
  }, [data])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
  }

  const getAccuracyColor = (classification: string) => {
    const colors = {
      forecast: 'bg-gray-100 text-gray-700',
      both_zero: 'bg-gray-100 text-gray-700',
      excellent: 'bg-green-100 text-green-700',
      good: 'bg-blue-100 text-blue-700',
      fair: 'bg-yellow-100 text-yellow-700',
      poor: 'bg-red-100 text-red-700',
    }
    return colors[classification as keyof typeof colors] || colors.forecast
  }

  const getVarianceIcon = (variance: number) => {
    if (Math.abs(variance) < 1) return <Minus className="h-4 w-4" />
    return variance > 0 ? (
      <TrendingUp className="h-4 w-4" />
    ) : (
      <TrendingDown className="h-4 w-4" />
    )
  }

  const getVarianceColor = (variance: number) => {
    const absVariance = Math.abs(variance)
    if (absVariance < 5) return 'text-green-600'
    if (absVariance < 10) return 'text-blue-600'
    if (absVariance < 20) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Simple bar chart rendering (without external chart library)
  const renderBarChart = (data: ForecastComparisonData[], metric: 'revenue' | 'adr' | 'occupancy') => {
    if (!data || data.length === 0) {
      return <div className="text-center text-muted-foreground p-4">No data available</div>
    }
    
    const maxValue = Math.max(
      ...data.map(d =>
        metric === 'revenue' ? Math.max(d.forecast_revenue ?? 0, d.actual_revenue ?? 0)
          : metric === 'adr' ? Math.max(d.forecast_adr ?? 0, d.actual_adr ?? 0)
            : Math.max(d.forecast_occupancy ?? 0, 100)
      )
    ) || 1 // guard against 0 / NaN to avoid division-by-zero

    return (
      <div className="space-y-3">
        {data.slice(0, 30).map((d, index) => {
          const forecastValue: number =
            metric === 'revenue' ? (d.forecast_revenue ?? 0)
              : metric === 'adr' ? (d.forecast_adr ?? 0)
                : (d.forecast_occupancy ?? 0)
          const actualValue: number =
            metric === 'revenue' ? (d.actual_revenue ?? 0)
              : metric === 'adr' ? (d.actual_adr ?? 0)
                : (d.actual_occupancy ?? d.forecast_occupancy ?? 0)

          const forecastBarWidth = (forecastValue / maxValue) * 100
          const actualBarWidth = (actualValue / maxValue) * 100

          return (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatDate(d.forecast_date)}</span>
                {metric === 'revenue' && d.accuracy_classification !== 'forecast' && (
                  <Badge
                    variant="outline"
                    className={getAccuracyColor(d.accuracy_classification)}
                  >
                    {d.accuracy_classification}
                  </Badge>
                )}
              </div>
              <div className="flex h-8 gap-1">
                {/* Forecast Bar */}
                <div
                  className="bg-blue-200 rounded-l relative group"
                  style={{ width: `${forecastBarWidth}%` }}
                  title={`Forecast: ${metric === 'revenue' ? formatCurrency(forecastValue) : formatPercent(forecastValue)}`}
                >
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-800">
                    {metric === 'revenue'
                      ? (forecastValue ?? 0).toLocaleString('th-TH')
                      : (forecastValue ?? 0).toFixed(0)}
                  </span>
                </div>
                {/* Actual Bar */}
                <div
                  className="bg-green-200 rounded-r relative group"
                  style={{ width: `${actualBarWidth}%` }}
                  title={`Actual: ${metric === 'revenue' ? formatCurrency(actualValue) : formatPercent(actualValue)}`}
                >
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-green-800">
                    {metric === 'revenue'
                      ? (actualValue ?? 0).toLocaleString('th-TH')
                      : (actualValue ?? 0).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>No comparison data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalForecastRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalActualRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-2 ${getVarianceColor(
              ((stats.totalActualRevenue - stats.totalForecastRevenue) / stats.totalForecastRevenue) * 100
            )}`}>
              {getVarianceIcon(
                ((stats.totalActualRevenue - stats.totalForecastRevenue) / stats.totalForecastRevenue) * 100
              )}
              {formatPercent(
                ((stats.totalActualRevenue - stats.totalForecastRevenue) / stats.totalForecastRevenue) * 100
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.avgAccuracy >= 90 ? 'text-green-600' :
                stats.avgAccuracy >= 80 ? 'text-blue-600' :
                  stats.avgAccuracy >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`}>
              {stats.avgAccuracy.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Classification Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Accuracy Classification</CardTitle>
          <CardDescription>Distribution of forecast accuracy by day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700">{stats.excellentDays}</div>
              <div className="text-sm text-green-600">Excellent Days</div>
              <div className="text-xs text-muted-foreground">{'≤'} 5% variance</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{stats.goodDays}</div>
              <div className="text-sm text-blue-600">Good Days</div>
              <div className="text-xs text-muted-foreground">5{'-'}10% variance</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-700">{stats.fairDays}</div>
              <div className="text-sm text-yellow-600">Fair Days</div>
              <div className="text-xs text-muted-foreground">10{'-'}20% variance</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-700">{stats.poorDays}</div>
              <div className="text-sm text-red-600">Poor Days</div>
              <div className="text-xs text-muted-foreground">&gt; 20% variance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Comparison Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast vs Actual Comparison</CardTitle>
          <CardDescription>Visual comparison of forecasted and actual values</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="revenue" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="adr">ADR</TabsTrigger>
              <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="mt-4">
              <h4 className="text-sm font-medium mb-3">Revenue Comparison (฿)</h4>
              {renderBarChart(data, 'revenue')}
            </TabsContent>

            <TabsContent value="adr" className="mt-4">
              <h4 className="text-sm font-medium mb-3">ADR Comparison (฿)</h4>
              {renderBarChart(data, 'adr')}
            </TabsContent>

            <TabsContent value="occupancy" className="mt-4">
              <h4 className="text-sm font-medium mb-3">Occupancy Comparison (%)</h4>
              {renderBarChart(data, 'occupancy')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// Legend component
export function ForecastComparisonLegend() {
  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-blue-200 rounded" />
        <span>Forecast</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-green-200 rounded" />
        <span>Actual</span>
      </div>
    </div>
  )
}
