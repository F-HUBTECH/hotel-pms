'use client'

/**
 * Hotel PMS - Forecast Filters Component
 * Phase 3: Frontend Implementation
 * Filter controls for forecast grid and reports
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarIcon, Building2, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

export interface ForecastFiltersProps {
  startDate?: Date
  endDate?: Date
  buildingId?: string
  roomTypeId?: string
  showRevenue?: boolean
  showPax?: boolean
  onStartDateChange?: (date: Date | undefined) => void
  onEndDateChange?: (date: Date | undefined) => void
  onBuildingChange?: (buildingId: string) => void
  onRoomTypeChange?: (roomTypeId: string) => void
  onShowRevenueChange?: (show: boolean) => void
  onShowPaxChange?: (show: boolean) => void
  onApply?: () => void
  onReset?: () => void
  buildings?: Array<{ id: string; name: string }>
  roomTypes?: Array<{ id: string; name: string }>
  loading?: boolean
}

export function ForecastFilters({
  startDate,
  endDate,
  buildingId,
  roomTypeId,
  showRevenue = true,
  showPax = true,
  onStartDateChange,
  onEndDateChange,
  onBuildingChange,
  onRoomTypeChange,
  onShowRevenueChange,
  onShowPaxChange,
  onApply,
  onReset,
  buildings = [],
  roomTypes = [],
  loading = false,
}: ForecastFiltersProps) {
  const handleReset = () => {
    onStartDateChange?.(undefined)
    onEndDateChange?.(undefined)
    onBuildingChange?.('')
    onRoomTypeChange?.('')
    onShowRevenueChange?.(true)
    onShowPaxChange?.(true)
    onReset?.()
  }

  const isFilterActive = startDate || endDate || buildingId || roomTypeId

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Forecast Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="start-date"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? (
                    format(startDate, 'PPP', { locale: th })
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={onStartDateChange}
                  locale={th}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="end-date"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? (
                    format(endDate, 'PPP', { locale: th })
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={onEndDateChange}
                  locale={th}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Building Filter */}
        <div className="space-y-2">
          <Label htmlFor="building-select">Building</Label>
          <Select
            value={buildingId || 'all'}
            onValueChange={(v) => onBuildingChange?.(v === 'all' ? '' : v)}
          >
            <SelectTrigger id="building-select">
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Buildings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings.map((building) => (
                <SelectItem key={building.id} value={building.id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Room Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="room-type-select">Room Type</Label>
          <Select
            value={roomTypeId || 'all'}
            onValueChange={(v) => onRoomTypeChange?.(v === 'all' ? '' : v)}
          >
            <SelectTrigger id="room-type-select">
              <SelectValue placeholder="All Room Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Room Types</SelectItem>
              {roomTypes.map((roomType) => (
                <SelectItem key={roomType.id} value={roomType.id}>
                  {roomType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Display Options */}
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-medium">Display Options</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-revenue"
                checked={showRevenue}
                onCheckedChange={(checked) => onShowRevenueChange?.(checked as boolean)}
              />
              <Label
                htmlFor="show-revenue"
                className="text-sm font-normal cursor-pointer"
              >
                Show Revenue
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-pax"
                checked={showPax}
                onCheckedChange={(checked) => onShowPaxChange?.(checked as boolean)}
              />
              <Label
                htmlFor="show-pax"
                className="text-sm font-normal cursor-pointer"
              >
                Show Pax
              </Label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onApply}
            className="flex-1"
            disabled={loading}
          >
            {loading ? 'Applying...' : 'Apply Filters'}
          </Button>
          {isFilterActive && (
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={loading}
            >
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Simplified toolbar version for inline use
export interface ForecastFiltersToolbarProps {
  showRevenue: boolean
  showPax: boolean
  onShowRevenueChange: (show: boolean) => void
  onShowPaxChange: (show: boolean) => void
  onRefresh?: () => void
  loading?: boolean
}

export function ForecastFiltersToolbar({
  showRevenue,
  showPax,
  onShowRevenueChange,
  onShowPaxChange,
  onRefresh,
  loading = false,
}: ForecastFiltersToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-muted rounded-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="toolbar-show-revenue"
            checked={showRevenue}
            onCheckedChange={(checked) => onShowRevenueChange(checked as boolean)}
          />
          <Label
            htmlFor="toolbar-show-revenue"
            className="text-sm cursor-pointer"
          >
            Revenue
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="toolbar-show-pax"
            checked={showPax}
            onCheckedChange={(checked) => onShowPaxChange(checked as boolean)}
          />
          <Label
            htmlFor="toolbar-show-pax"
            className="text-sm cursor-pointer"
          >
            Pax
          </Label>
        </div>
      </div>
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      )}
    </div>
  )
}
