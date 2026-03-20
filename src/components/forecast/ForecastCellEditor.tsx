'use client'

/**
 * Hotel PMS - Forecast Cell Editor Component
 * Phase 3: Frontend Implementation
 * Inline editor for adjusting forecast values
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { adjustForecastItemDirect } from '@/lib/actions/forecast-actions'

export interface ForecastCellData {
  id: string
  forecast_date: string
  room_number: string
  room_type_name: string
  room_status: string
  booking_status: string | null
  guest_type: string | null
  pax_adults: number | null
  pax_children: number | null
  rate_amount: number | null
  total_revenue: number | null
  is_override: boolean
  original_rate_amount: number | null
  original_revenue: number | null
}

export interface ForecastCellEditorProps {
  open: boolean
  onClose: () => void
  cell: ForecastCellData | null
  onSave?: (updatedCell: ForecastCellData) => void
  userId?: string
}

export function ForecastCellEditor({
  open,
  onClose,
  cell,
  onSave,
  userId,
}: ForecastCellEditorProps) {
  const [newRate, setNewRate] = useState<string>('')
  const [overrideReason, setOverrideReason] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')

  // Reset form when cell changes
  useEffect(() => {
    if (cell) {
      setNewRate(cell.rate_amount?.toString() || '0')
      setOverrideReason(cell.is_override ? 'Updated rate' : '')
      setError('')
    }
  }, [cell, open])

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getBookingStatusLabel = (status: string | null) => {
    if (!status) return 'No Booking'
    const labels: Record<string, string> = {
      B: 'Booked',
      I: 'In House',
      C: 'Cancelled',
      O: 'Checked Out',
      X: 'No-Show',
    }
    return labels[status] || status
  }

  const handleSave = async () => {
    if (!cell) return

    // Validation
    const rate = parseFloat(newRate)
    if (isNaN(rate) || rate < 0) {
      setError('Please enter a valid rate amount')
      return
    }

    if (!overrideReason.trim()) {
      setError('Please provide a reason for this adjustment')
      return
    }

    setSaving(true)
    setError('')

    try {
      const result = await adjustForecastItemDirect({
        itemId: cell.id,
        rateAmount: rate,
        overrideReason: overrideReason.trim(),
        userId,
      })

      if (result.success) {
        onSave?.(result.data as ForecastCellData)
        onClose()
      } else {
        setError(result.error || 'Failed to adjust forecast')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Adjust forecast error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!cell || !cell.is_override) return
    setNewRate(cell.original_rate_amount?.toString() || '0')
    setOverrideReason('Reset to original')
  }

  if (!cell) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Forecast - Room {cell.room_number}</DialogTitle>
          <DialogDescription>
            {formatDate(cell.forecast_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Values Display */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Room Type:</span>
                <span className="ml-2 font-medium">{cell.room_type_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className="ml-2">
                  {cell.room_status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Booking:</span>
                <Badge variant="secondary" className="ml-2">
                  {getBookingStatusLabel(cell.booking_status)}
                </Badge>
              </div>
              {cell.guest_type && (
                <div>
                  <span className="text-muted-foreground">Guest Type:</span>
                  <Badge variant="outline" className="ml-2">
                    {cell.guest_type}
                  </Badge>
                </div>
              )}
            </div>

            {cell.pax_adults !== null && cell.pax_children !== null && (
              <div className="text-sm">
                <span className="text-muted-foreground">Pax:</span>
                <span className="ml-2">
                  Adults: {cell.pax_adults}, Children: {cell.pax_children}
                </span>
              </div>
            )}

            {cell.is_override && (
              <div className="pt-2 border-t border-yellow-200 bg-yellow-50 rounded p-2">
                <div className="text-sm text-yellow-800">
                  <span className="font-medium">★ Override Active</span>
                  {' '}Original Rate: {formatCurrency(cell.original_rate_amount)}
                </div>
              </div>
            )}
          </div>

          {/* Rate Adjustment */}
          <div className="space-y-2">
            <Label htmlFor="rate-amount">Rate Amount (THB)</Label>
            <Input
              id="rate-amount"
              type="number"
              step="0.01"
              min="0"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              disabled={saving}
              className="text-lg font-medium"
            />
            {cell.rate_amount && cell.rate_amount !== parseFloat(newRate) && (
              <div className="text-sm text-muted-foreground">
                Original: {formatCurrency(cell.rate_amount)} → New:{' '}
                {formatCurrency(parseFloat(newRate))}
              </div>
            )}
          </div>

          {/* Override Reason */}
          <div className="space-y-2">
            <Label htmlFor="override-reason">
              Reason for Adjustment <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="override-reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              disabled={saving}
              placeholder="e.g., Weekend premium, Special discount, Seasonal adjustment..."
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={saving || !cell.is_override}
          >
            Reset to Original
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-w-[100px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Quick edit variant for inline use
export interface QuickRateAdjustProps {
  currentRate: number | null
  onSave: (newRate: number, reason: string) => void
  onCancel: () => void
  loading?: boolean
}

export function QuickRateAdjust({
  currentRate,
  onSave,
  onCancel,
  loading = false,
}: QuickRateAdjustProps) {
  const [rate, setRate] = useState<string>(currentRate?.toString() || '0')
  const [reason, setReason] = useState<string>('')

  const handleSave = () => {
    const newRate = parseFloat(rate)
    if (isNaN(newRate) || newRate < 0) return
    if (!reason.trim()) return
    onSave(newRate, reason.trim())
  }

  return (
    <div className="space-y-3 p-4 bg-muted rounded-lg border">
      <div className="space-y-2">
        <Label htmlFor="quick-rate">New Rate (THB)</Label>
        <Input
          id="quick-rate"
          type="number"
          step="0.01"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="quick-reason">Reason *</Label>
        <Input
          id="quick-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Weekend premium..."
          disabled={loading}
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={loading || !reason.trim()}
          className="flex-1"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
