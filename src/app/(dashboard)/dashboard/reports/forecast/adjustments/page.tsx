'use client'

/**
 * Hotel PMS - Forecast Adjustments Page
 * Phase 5: Frontend Pages
 * View adjustment history and audit trail
 */

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TrendingUp, TrendingDown, Search, Filter, RefreshCw, User, Calendar } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface AdjustmentData {
  id: string
  forecast_date: string
  room_number: string
  room_label: string
  building_name: string
  room_type_name: string
  original_rate_amount: number | null
  original_revenue: number | null
  new_rate_amount: number | null
  new_revenue: number | null
  revenue_change: number | null
  revenue_change_percentage: number | null
  rate_change: number | null
  rate_change_percentage: number | null
  override_reason: string
  override_by: string | null
  overridden_by_name: string | null
  overridden_by_email: string | null
  override_at: string | null
  hours_since_override: number | null
}

export default function ForecastAdjustmentsPage() {
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [buildingFilter, setBuildingFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'change-desc' | 'change-asc'>('newest')

  // Data states
  const [adjustments, setAdjustments] = useState<AdjustmentData[]>([])
  const [filteredAdjustments, setFilteredAdjustments] = useState<AdjustmentData[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch adjustments
  const fetchAdjustments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('v_forecast_adjustment_history')
        .select('*')
        .order('override_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setAdjustments(data as AdjustmentData[])
    } catch (error) {
      console.error('Failed to fetch adjustments:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchAdjustments()
  }, [])

  // Filter adjustments
  useEffect(() => {
    let filtered = [...adjustments]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(a =>
        a.room_number.toLowerCase().includes(query) ||
        a.room_type_name.toLowerCase().includes(query) ||
        a.building_name.toLowerCase().includes(query) ||
        a.override_reason.toLowerCase().includes(query) ||
        a.overridden_by_name?.toLowerCase().includes(query)
      )
    }

    // Building filter
    if (buildingFilter !== 'all') {
      filtered = filtered.filter(a => a.building_name === buildingFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      filtered = filtered.filter(a => {
        const overrideDate = new Date(a.override_at || '')
        const hoursSince = (now.getTime() - overrideDate.getTime()) / (1000 * 60 * 60)

        switch (dateFilter) {
          case 'today':
            return hoursSince < 24
          case 'week':
            return hoursSince < 168
          case 'month':
            return hoursSince < 720
          default:
            return true
        }
      })
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.override_at || '').getTime() - new Date(a.override_at || '').getTime()
        case 'oldest':
          return new Date(a.override_at || '').getTime() - new Date(b.override_at || '').getTime()
        case 'change-desc':
          return Math.abs(b.revenue_change || 0) - Math.abs(a.revenue_change || 0)
        case 'change-asc':
          return Math.abs(a.revenue_change || 0) - Math.abs(b.revenue_change || 0)
        default:
          return 0
      }
    })

    setFilteredAdjustments(filtered)
  }, [adjustments, searchQuery, buildingFilter, dateFilter, sortOrder])

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${value.toFixed(1)}%`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return format(new Date(dateStr), 'PPP HH:mm')
  }

  const getChangeColor = (change: number | null) => {
    if (change === null) return 'text-gray-500'
    if (Math.abs(change) < 1) return 'text-gray-500'
    return change > 0 ? 'text-green-600' : 'text-red-600'
  }

  const getChangeIcon = (change: number | null) => {
    if (change === null || Math.abs(change) < 1) return null
    return change > 0 ? (
      <TrendingUp className="h-4 w-4" />
    ) : (
      <TrendingDown className="h-4 w-4" />
    )
  }

  // Calculate summary stats
  const summaryStats = React.useMemo(() => {
    if (filteredAdjustments.length === 0) {
      return {
        totalAdjustments: 0,
        totalChange: 0,
        totalAdjustmentsThisWeek: 0,
        avgChange: 0,
      }
    }

    const totalAdjustments = filteredAdjustments.length
    const totalChange = filteredAdjustments.reduce((sum, a) => sum + (a.revenue_change || 0), 0)
    const now = new Date()
    const totalAdjustmentsThisWeek = filteredAdjustments.filter(a => {
      const overrideDate = new Date(a.override_at || '')
      const hoursSince = (now.getTime() - overrideDate.getTime()) / (1000 * 60 * 60)
      return hoursSince < 168
    }).length
    const avgChange = totalChange / totalAdjustments

    return {
      totalAdjustments,
      totalChange,
      totalAdjustmentsThisWeek,
      avgChange,
    }
  }, [filteredAdjustments])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forecast Adjustments</h1>
          <p className="text-muted-foreground">
            View history of manual forecast adjustments with audit trail
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchAdjustments}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Adjustments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalAdjustments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalAdjustmentsThisWeek}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Change</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getChangeColor(summaryStats.totalChange)}`}>
              {formatCurrency(summaryStats.totalChange)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Change</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getChangeColor(summaryStats.avgChange)}`}>
              {formatCurrency(summaryStats.avgChange)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Room, type, reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="building">Building</Label>
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger id="building">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All Buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  <SelectItem value="Building A">Building A</SelectItem>
                  <SelectItem value="Building B">Building B</SelectItem>
                  <SelectItem value="Building C">Building C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger id="date">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort">Sort By</Label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                <SelectTrigger id="sort">
                  <SelectValue placeholder="Newest First" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="change-desc">Highest Change</SelectItem>
                  <SelectItem value="change-asc">Lowest Change</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments List */}
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
          <CardDescription>
            Showing {filteredAdjustments.length} of {adjustments.length} adjustments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAdjustments.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No adjustments found</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredAdjustments.map((adj) => (
                  <div key={adj.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono">
                            {adj.room_number}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {adj.room_type_name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            • {adj.building_name}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Date: </span>
                          {format(new Date(adj.forecast_date), 'PPP')}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">
                          {formatDate(adj.override_at)}
                        </div>
                        {adj.hours_since_override && (
                          <div className="text-xs text-muted-foreground">
                            {Math.floor(adj.hours_since_override)}h ago
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Change Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm py-2 border-t border-b">
                      <div>
                        <p className="text-muted-foreground text-xs">Rate Change</p>
                        <div className={`flex items-center gap-1 font-medium ${getChangeColor(adj.rate_change_percentage)}`}>
                          {getChangeIcon(adj.rate_change_percentage)}
                          {formatCurrency(adj.rate_change)}
                          {adj.rate_change_percentage && (
                            <span className="text-xs">({formatPercent(adj.rate_change_percentage)})</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Revenue Change</p>
                        <div className={`flex items-center gap-1 font-medium ${getChangeColor(adj.revenue_change_percentage)}`}>
                          {getChangeIcon(adj.revenue_change_percentage)}
                          {formatCurrency(adj.revenue_change)}
                          {adj.revenue_change_percentage && (
                            <span className="text-xs">({formatPercent(adj.revenue_change_percentage)})</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">New Rate</p>
                        <p className="font-medium">{formatCurrency(adj.new_rate_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">New Revenue</p>
                        <p className="font-medium">{formatCurrency(adj.new_revenue)}</p>
                      </div>
                    </div>

                    {/* Override Info */}
                    <div className="pt-2 flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Reason:</span> {adj.override_reason}
                        </p>
                        {adj.overridden_by_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <User className="h-3 w-3" />
                            <span>{adj.overridden_by_name}</span>
                            {adj.overridden_by_email && (
                              <span className="text-xs">({adj.overridden_by_email})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
