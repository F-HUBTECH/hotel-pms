'use client'

/**
 * Hotel PMS - Forecast KPICards Component
 * Phase 3: Frontend Implementation
 * KPI cards displaying forecast metrics
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, Users, Bed, LogIn, LogOut, Hotel, UserCheck, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ForecastKPIData {
  forecast_date: string
  total_rooms: number
  available_rooms: number
  occupied_rooms: number
  occupancy_percentage: number
  // KFO Fields - Room Status
  stayover_rooms: number
  arrival_rooms: number
  departure_rooms: number
  comp_rooms: number
  hu_rooms: number
  oo_rooms: number
  oi_rooms: number
  // Tentative/Booking Status
  tentative_fit: number
  tentative_grp: number
  // Pax
  adult_pax: number
  child_pax: number
  total_pax: number
  occupied_pax: number
  // Day Use
  day_use_rooms: number
  // Revenue
  total_revenue: number
  room_revenue: number
  extra_revenue: number
  fit_revenue: number
  grp_revenue: number
  adr: number
  revpar: number
}

export interface ForecastKPICardsProps {
  data: ForecastKPIData[]
  comparisonData?: ForecastKPIData[]
  loading?: boolean
}

export function ForecastKPICards({
  data,
  comparisonData,
  loading = false,
}: ForecastKPICardsProps) {
  // Calculate aggregate metrics
  const aggregate = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalRevenue: 0,
        avgOccupancy: 0,
        adr: 0,
        revpar: 0,
        totalRooms: 0,
        occupiedRooms: 0,
        stayoverRooms: 0,
        arrivalRooms: 0,
        departureRooms: 0,
        compRooms: 0,
        huRooms: 0,
        ooRooms: 0,
        oiRooms: 0,
        tentativeFit: 0,
        tentativeGrp: 0,
        adultPax: 0,
        childPax: 0,
        totalPax: 0,
        dayUseRooms: 0,
      }
    }

    const totalRevenue = data.reduce((sum, d) => sum + d.total_revenue, 0)
    const avgOccupancy = data.reduce((sum, d) => sum + d.occupancy_percentage, 0) / data.length
    const adr = data.reduce((sum, d) => sum + d.adr, 0) / data.length
    const revpar = data.reduce((sum, d) => sum + d.revpar, 0) / data.length
    const totalRooms = data[0]?.total_rooms || 0
    const occupiedRooms = data.reduce((sum, d) => sum + d.occupied_rooms, 0) / data.length
    
    // KFO Fields
    const stayoverRooms = data.reduce((sum, d) => sum + (d.stayover_rooms || 0), 0)
    const arrivalRooms = data.reduce((sum, d) => sum + (d.arrival_rooms || 0), 0)
    const departureRooms = data.reduce((sum, d) => sum + (d.departure_rooms || 0), 0)
    const compRooms = data.reduce((sum, d) => sum + (d.comp_rooms || 0), 0)
    const huRooms = data.reduce((sum, d) => sum + (d.hu_rooms || 0), 0)
    const ooRooms = data.reduce((sum, d) => sum + (d.oo_rooms || 0), 0)
    const oiRooms = data.reduce((sum, d) => sum + (d.oi_rooms || 0), 0)
    const tentativeFit = data.reduce((sum, d) => sum + (d.tentative_fit || 0), 0)
    const tentativeGrp = data.reduce((sum, d) => sum + (d.tentative_grp || 0), 0)
    const adultPax = data.reduce((sum, d) => sum + (d.adult_pax || 0), 0)
    const childPax = data.reduce((sum, d) => sum + (d.child_pax || 0), 0)
    const totalPax = data.reduce((sum, d) => sum + (d.total_pax || 0), 0)
    const dayUseRooms = data.reduce((sum, d) => sum + (d.day_use_rooms || 0), 0)

    return {
      totalRevenue,
      avgOccupancy,
      adr,
      revpar,
      totalRooms,
      occupiedRooms,
      stayoverRooms,
      arrivalRooms,
      departureRooms,
      compRooms,
      huRooms,
      ooRooms,
      oiRooms,
      tentativeFit,
      tentativeGrp,
      adultPax,
      childPax,
      totalPax,
      dayUseRooms,
    }
  }, [data])

  // Calculate comparison metrics (if comparison data provided)
  const comparison = React.useMemo(() => {
    if (!comparisonData || comparisonData.length === 0) {
      return {
        revenueChange: 0,
        occupancyChange: 0,
        adrChange: 0,
        revparChange: 0,
      }
    }

    const comparisonAggregate = {
      totalRevenue: comparisonData.reduce((sum, d) => sum + d.total_revenue, 0),
      avgOccupancy: comparisonData.reduce((sum, d) => sum + d.occupancy_percentage, 0) / comparisonData.length,
      adr: comparisonData.reduce((sum, d) => sum + d.adr, 0) / comparisonData.length,
      revpar: comparisonData.reduce((sum, d) => sum + d.revpar, 0) / comparisonData.length,
    }

    return {
      revenueChange: aggregate.totalRevenue - comparisonAggregate.totalRevenue,
      occupancyChange: aggregate.avgOccupancy - comparisonAggregate.avgOccupancy,
      adrChange: aggregate.adr - comparisonAggregate.adr,
      revparChange: aggregate.revpar - comparisonAggregate.revpar,
    }
  }, [comparisonData, aggregate])

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

  const TrendIndicator = ({ value, format }: { value: number; format: 'currency' | 'percent' }) => {
    if (comparisonData && comparisonData.length > 0) {
      const isPositive = value > 0
      const formatted = format === 'currency'
        ? formatCurrency(Math.abs(value))
        : formatPercent(Math.abs(value))

      return (
        <div className={cn(
          'flex items-center text-xs',
          isPositive ? 'text-green-600' : 'text-red-600'
        )}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3 mr-1" />
          ) : (
            <TrendingDown className="h-3 w-3 mr-1" />
          )}
          {formatted}
        </div>
      )
    }
    return null
  }

  const KPICard = ({
    title,
    value,
    icon: Icon,
    change,
    format,
    description,
  }: {
    title: string
    value: string | number
    icon: React.ElementType
    change?: number
    format?: 'currency' | 'percent'
    description?: string
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold">{value}</div>
          {change !== undefined && (
            <TrendIndicator value={change} format={format || 'currency'} />
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KFO Core Metrics - Stayover, Arrivals, Departures */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Stayover */}
        <KPICard
          title="Stay Over"
          value={aggregate.stayoverRooms}
          icon={Hotel}
          description="Rooms staying from previous day"
        />

        {/* Arrivals */}
        <KPICard
          title="Arrivals"
          value={aggregate.arrivalRooms}
          icon={LogIn}
          description="Expected arrivals today"
        />

        {/* Departures */}
        <KPICard
          title="Departures"
          value={aggregate.departureRooms}
          icon={LogOut}
          description="Expected departures today"
        />
      </div>

      {/* Revenue & Occupancy Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Total Revenue */}
        <KPICard
          title="Total Revenue"
          value={formatCurrency(aggregate.totalRevenue)}
          icon={DollarSign}
          change={comparisonData ? comparison.revenueChange : undefined}
          description="Projected total for period"
        />

        {/* Average Occupancy */}
        <KPICard
          title="Occupancy"
          value={formatPercent(aggregate.avgOccupancy)}
          icon={UserCheck}
          change={comparisonData ? comparison.occupancyChange : undefined}
          format="percent"
          description={`${aggregate.occupiedRooms.toFixed(0)} / ${aggregate.totalRooms} rooms`}
        />

        {/* ADR (Average Daily Rate) */}
        <KPICard
          title="ADR"
          value={formatCurrency(aggregate.adr)}
          icon={Bed}
          change={comparisonData ? comparison.adrChange : undefined}
          description="Average Daily Rate"
        />

        {/* RevPAR */}
        <KPICard
          title="RevPAR"
          value={formatCurrency(aggregate.revpar)}
          icon={TrendingUp}
          change={comparisonData ? comparison.revparChange : undefined}
          description="Revenue Per Available Room"
        />
      </div>

      {/* Room Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-6">
        <KPICard
          title="Total Rooms"
          value={aggregate.totalRooms}
          icon={Hotel}
          description="Total inventory"
        />
        <KPICard
          title="Comp."
          value={aggregate.compRooms}
          icon={Users}
          description="Complimentary"
        />
        <KPICard
          title="H/U"
          value={aggregate.huRooms}
          icon={Hotel}
          description="House Use"
        />
        <KPICard
          title="O/O"
          value={aggregate.ooRooms}
          icon={Bed}
          description="Out of Order"
        />
        <KPICard
          title="O/I"
          value={aggregate.oiRooms}
          icon={Bed}
          description="Out of Inventory"
        />
        <KPICard
          title="Day Use"
          value={aggregate.dayUseRooms}
          icon={Calendar}
          description="Day use rooms"
        />
      </div>
    </div>
  )
}

// Summary version for dashboard
export interface ForecastSummaryProps {
  data: ForecastKPIData[]
  loading?: boolean
}

export function ForecastSummary({ data, loading = false }: ForecastSummaryProps) {
  const aggregate = React.useMemo(() => {
    if (!data || data.length === 0) return null

    const summary = data.reduce((acc, d) => ({
      totalRevenue: acc.totalRevenue + d.total_revenue,
      roomRevenue: acc.roomRevenue + d.room_revenue,
      extraRevenue: acc.extraRevenue + d.extra_revenue,
      fitRevenue: acc.fitRevenue + d.fit_revenue,
      grpRevenue: acc.grpRevenue + d.grp_revenue,
      avgOccupancy: acc.avgOccupancy + d.occupancy_percentage,
      adr: acc.adr + d.adr,
      revpar: acc.revpar + d.revpar,
    }), {
      totalRevenue: 0,
      roomRevenue: 0,
      extraRevenue: 0,
      fitRevenue: 0,
      grpRevenue: 0,
      avgOccupancy: 0,
      adr: 0,
      revpar: 0,
    })

    const count = data.length
    return {
      ...summary,
      avgOccupancy: summary.avgOccupancy / count,
      adr: summary.adr / count,
      revpar: summary.revpar / count,
    }
  }, [data])

  if (!aggregate || loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">{formatCurrency(aggregate.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Occupancy</p>
            <p className="text-2xl font-bold">{aggregate.avgOccupancy.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">ADR</p>
            <p className="text-lg font-semibold">{formatCurrency(aggregate.adr)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">RevPAR</p>
            <p className="text-lg font-semibold">{formatCurrency(aggregate.revpar)}</p>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Revenue Breakdown</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Room Revenue</span>
              <span className="font-medium">{formatCurrency(aggregate.roomRevenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Extra Revenue</span>
              <span className="font-medium">{formatCurrency(aggregate.extraRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Segment Breakdown */}
        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Guest Segments</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded p-2">
              <p className="text-xs text-blue-600 font-medium">FIT</p>
              <p className="text-sm font-semibold">{formatCurrency(aggregate.fitRevenue)}</p>
            </div>
            <div className="bg-purple-50 rounded p-2">
              <p className="text-xs text-purple-600 font-medium">GRP</p>
              <p className="text-sm font-semibold">{formatCurrency(aggregate.grpRevenue)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
