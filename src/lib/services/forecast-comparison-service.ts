/**
 * Hotel PMS - Forecast Comparison Service
 * Phase 7: Implement Features
 * Service for forecast vs actual comparison and variance analysis
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// =============================================
// 1. TYPES
// =============================================

export interface ForecastComparison {
  forecast_date: string
  property_name: string
  forecast_revenue: number
  actual_revenue: number
  forecast_adr: number
  actual_adr: number
  forecast_revpar: number
  actual_revpar: number
  forecast_occupancy: number
  actual_occupancy: number
  variance_revenue: number
  variance_percentage: number
  variance_adr: number
  variance_revpar: number
  accuracy_percentage: number
  accuracy_classification: 'forecast' | 'both_zero' | 'excellent' | 'good' | 'fair' | 'poor'
  fit_percentage: number
  grp_percentage: number
}

export interface ComparisonSummary {
  total_forecast_revenue: number
  total_actual_revenue: number
  total_variance: number
  total_variance_percentage: number
  avg_accuracy: number
  excellent_days: number
  good_days: number
  fair_days: number
  poor_days: number
  forecast_days: number
}

export interface VarianceAnalysis {
  period: string
  forecast_revenue: number
  actual_revenue: number
  variance: number
  variance_percentage: number
  trend: 'up' | 'down' | 'stable'
}

// =============================================
// 2. GET FORECAST VS ACTUAL COMPARISON
// =============================================

export async function getForecastComparison(
  startDate: string,
  endDate: string,
  propertyId?: string
): Promise<{
  success: boolean
  data?: ForecastComparison[]
  error?: string
}> {
  try {
    let query = supabase
      .from('v_forecast_summary_comparison')
      .select('*')
      .gte('forecast_date', startDate)
      .lte('forecast_date', endDate)

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    query = query.order('forecast_date', { ascending: true })

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data as ForecastComparison[] }
  } catch (error) {
    console.error('Get forecast comparison error:', error)
    return { success: false, error: 'Failed to fetch comparison data' }
  }
}

// =============================================
// 3. GET COMPARISON SUMMARY
// =============================================

export async function getComparisonSummary(
  startDate: string,
  endDate: string,
  propertyId?: string
): Promise<{
  success: boolean
  data?: ComparisonSummary
  error?: string
}> {
  try {
    const result = await getForecastComparison(startDate, endDate, propertyId)

    if (!result.success || !result.data) {
      return { success: false, error: result.error }
    }

    const data = result.data

    const summary = data.reduce(
      (acc, day) => {
        return {
          total_forecast_revenue: acc.total_forecast_revenue + day.forecast_revenue,
          total_actual_revenue: acc.total_actual_revenue + day.actual_revenue,
          total_variance: acc.total_variance + day.variance_revenue,
          accuracy_sum: acc.accuracy_sum + day.accuracy_percentage,
          excellent_days: acc.excellent_days + (day.accuracy_classification === 'excellent' ? 1 : 0),
          good_days: acc.good_days + (day.accuracy_classification === 'good' ? 1 : 0),
          fair_days: acc.fair_days + (day.accuracy_classification === 'fair' ? 1 : 0),
          poor_days: acc.poor_days + (day.accuracy_classification === 'poor' ? 1 : 0),
          forecast_days: acc.forecast_days + (day.accuracy_classification === 'forecast' ? 1 : 0),
        }
      },
      {
        total_forecast_revenue: 0,
        total_actual_revenue: 0,
        total_variance: 0,
        accuracy_sum: 0,
        excellent_days: 0,
        good_days: 0,
        fair_days: 0,
        poor_days: 0,
        forecast_days: 0,
      }
    )

    const totalDays = data.length
    const nonForecastDays = totalDays - summary.forecast_days
    const avgAccuracy = nonForecastDays > 0 ? summary.accuracy_sum / nonForecastDays : 0
    const totalVariancePercentage = summary.total_forecast_revenue > 0
      ? (summary.total_variance / summary.total_forecast_revenue) * 100
      : 0

    return {
      success: true,
      data: {
        total_forecast_revenue: summary.total_forecast_revenue,
        total_actual_revenue: summary.total_actual_revenue,
        total_variance: summary.total_variance,
        total_variance_percentage: totalVariancePercentage,
        avg_accuracy: avgAccuracy,
        excellent_days: summary.excellent_days,
        good_days: summary.good_days,
        fair_days: summary.fair_days,
        poor_days: summary.poor_days,
        forecast_days: summary.forecast_days,
      },
    }
  } catch (error) {
    console.error('Get comparison summary error:', error)
    return { success: false, error: 'Failed to calculate summary' }
  }
}

// =============================================
// 4. GET VARIANCE ANALYSIS BY PERIOD
// =============================================

export async function getVarianceAnalysis(
  startDate: string,
  endDate: string,
  period: 'day' | 'week' | 'month',
  propertyId?: string
): Promise<{
  success: boolean
  data?: VarianceAnalysis[]
  error?: string
}> {
  try {
    const result = await getForecastComparison(startDate, endDate, propertyId)

    if (!result.success || !result.data) {
      return { success: false, error: result.error }
    }

    const data = result.data

    // Group by period
    const grouped: Record<string, ForecastComparison[]> = {}

    data.forEach(day => {
      const date = new Date(day.forecast_date)
      let key: string

      switch (period) {
        case 'day':
          key = day.forecast_date
          break
        case 'week':
          const weekNum = getWeekNumber(date)
          const yearWeek = date.getFullYear()
          key = `${yearWeek}-W${weekNum}`
          break
        case 'month':
          const month = date.getMonth() + 1
          const yearMonth = date.getFullYear()
          key = `${yearMonth}-${month.toString().padStart(2, '0')}`
          break
      }

      if (!grouped[key]) grouped[key] = []
      grouped[key].push(day)
    })

    // Calculate variance for each period
    const analysis = Object.entries(grouped).map(([periodKey, days]) => {
      const totalForecast = days.reduce((sum, d) => sum + d.forecast_revenue, 0)
      const totalActual = days.reduce((sum, d) => sum + d.actual_revenue, 0)
      const variance = totalActual - totalForecast
      const variancePercent = totalForecast > 0 ? (variance / totalForecast) * 100 : 0

      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (variancePercent > 5) trend = 'up'
      else if (variancePercent < -5) trend = 'down'

      return {
        period: periodKey,
        forecast_revenue: totalForecast,
        actual_revenue: totalActual,
        variance,
        variance_percentage: variancePercent,
        trend,
      }
    })

    return { success: true, data: analysis }
  } catch (error) {
    console.error('Get variance analysis error:', error)
    return { success: false, error: 'Failed to analyze variance' }
  }
}

// =============================================
// 5. HELPER FUNCTIONS
// =============================================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function getAccuracyColor(classification: string): string {
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

export function getVarianceColor(variance: number): string {
  const absVariance = Math.abs(variance)
  if (absVariance < 5) return 'text-green-600'
  if (absVariance < 10) return 'text-blue-600'
  if (absVariance < 20) return 'text-yellow-600'
  return 'text-red-600'
}
