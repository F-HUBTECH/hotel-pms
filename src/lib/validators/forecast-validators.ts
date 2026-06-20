/**
 * Hotel PMS - Forecast Validators
 * Phase 7: Implement Features
 * Validation rules for forecast adjustments and operations
 */

import { z } from 'zod'

// =============================================
// 1. FORECAST ADJUSTMENT VALIDATORS
// =============================================

// Rate validation with business rules
export const forecastAdjustmentSchema = z.object({
  itemId: z.string().uuid('Invalid forecast item ID'),
  newRate: z.number({ message: 'Rate must be a number' })
    .min(0, 'Rate cannot be negative')
    .max(999999.99, 'Rate cannot exceed 999,999.99')
    .refine(val => val >= 100, 'Rate must be at least 100 THB'),
  overrideReason: z.string({ message: 'Reason is required' })
    .min(3, 'Reason must be at least 3 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  userId: z.string().uuid().optional(),
})

// Quick rate adjustment (simplified)
export const quickRateAdjustmentSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  forecastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  newRate: z.number()
    .min(0, 'Rate cannot be negative')
    .refine(val => val >= 100, 'Rate must be at least 100 THB'),
  reason: z.string()
    .min(3, 'Reason must be at least 3 characters')
    .max(200, 'Reason cannot exceed 200 characters'),
})

// =============================================
// 2. ROOM STATUS DATE VALIDATORS
// =============================================

// Status type validation
export const roomStatusSchema = z.object({
  id: z.string().uuid().optional(),
  roomId: z.string().uuid('Invalid room ID'),
  statusType: z.enum(['OO', 'OI', 'HU'], { message: 'Status type must be OO, OI, or HU' }),
  fromDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(val => {
      const date = new Date(val)
      return !isNaN(date.getTime())
    }, 'Invalid from date'),
  toDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(val => {
      const date = new Date(val)
      return !isNaN(date.getTime())
    }, 'Invalid to date'),
  reason: z.string()
    .max(255, 'Reason cannot exceed 255 characters')
    .optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  createdBy: z.string().uuid().optional(),
  action: z.enum(['upsert', 'delete', 'end']).default('upsert'),
}).refine(
  (data) => {
    if (!data.toDate || !data.fromDate) return true
    return new Date(data.toDate) >= new Date(data.fromDate)
  },
  {
    message: 'End date must be on or after start date',
    path: ['toDate'],
  }
)

// =============================================
// 3. FORECAST GENERATION VALIDATORS
// =============================================

// Forecast generation parameters
export const forecastGenerationSchema = z.object({
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  propertyId: z.string().uuid().optional(),
  configId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff <= 365
  },
  {
    message: 'Date range cannot exceed 365 days',
    path: ['endDate'],
  }
).refine(
  (data) => {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    return end >= start
  },
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
)

// =============================================
// 4. FORECAST FILTER VALIDATORS
// =============================================

// Grid filter parameters
export const forecastGridFilterSchema = z.object({
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  buildingId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid().optional(),
  showRevenue: z.boolean().default(true),
  showPax: z.boolean().default(true),
  showSegmentBreakdown: z.boolean().default(false),
})

// =============================================
// 5. BUSINESS RULE VALIDATION
// =============================================

// Check if rate change is within acceptable limits
export const validateRateChange = (originalRate: number, newRate: number): {
  valid: boolean
  changePercent: number
  warning?: string
} => {
  const change = newRate - originalRate
  const changePercent = (change / originalRate) * 100

  // Business rule: Changes over 50% require manager approval
  if (Math.abs(changePercent) > 50) {
    return {
      valid: false,
      changePercent,
      warning: 'Rate change exceeds 50%. Manager approval required.',
    }
  }

  // Changes over 20% show warning
  if (Math.abs(changePercent) > 20) {
    return {
      valid: true,
      changePercent,
      warning: 'Large rate change detected. Please verify.',
    }
  }

  return { valid: true, changePercent }
}

// Check if room status dates overlap
export const checkRoomStatusOverlap = (
  roomId: string,
  statusType: 'OO' | 'OI' | 'HU',
  fromDate: Date,
  toDate: Date,
  existingStatuses: Array<{
    id: string
    roomId: string
    statusType: string
    fromDate: string
    toDate: string
  }>,
  excludeId?: string,
): { overlaps: boolean; conflictingId?: string } => {
  for (const status of existingStatuses) {
    if (status.roomId !== roomId) continue
    if (status.statusType !== statusType) continue

    // Skip the record being updated
    if (excludeId && status.id === excludeId) continue

    const existingFrom = new Date(status.fromDate)
    const existingTo = new Date(status.toDate)

    // Check for overlap
    if (fromDate <= existingTo && toDate >= existingFrom) {
      return {
        overlaps: true,
        conflictingId: status.id,
      }
    }
  }

  return { overlaps: false }
}

// Validate forecast date range for business rules
export const validateForecastDateRange = (
  startDate: Date,
  endDate: Date,
  existingForecasts: Array<{ forecast_date: string }>
): { valid: boolean; warning?: string } => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Forecast for past dates not allowed
  if (startDate < today && endDate < today) {
    return {
      valid: false,
      warning: 'Cannot generate forecast for past dates',
    }
  }

  // Cannot forecast more than 1 year ahead
  const maxFutureDate = new Date(today)
  maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1)

  if (startDate > maxFutureDate) {
    return {
      valid: false,
      warning: 'Cannot forecast more than 1 year ahead',
    }
  }

  // Check if forecasts already exist for the range
  const forecastDates = existingForecasts.map(f => new Date(f.forecast_date))
  const hasExistingForecasts = forecastDates.some(d => d >= startDate && d <= endDate)

  if (hasExistingForecasts) {
    return {
      valid: true,
      warning: 'Forecasts already exist for this date range. They will be regenerated.',
    }
  }

  return { valid: true }
}

// =============================================
// 6. EXPORT VALIDATION
// =============================================

// Validate export parameters
export const forecastExportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  buildingId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid().optional(),
  format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  includeDetails: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  includeComparison: z.boolean().default(false),
})

// =============================================
// 7. HELPERS
// =============================================

// Format Zod errors for UI display
export const formatZodError = (error: z.ZodError): string => {
  return String(error)
}

// Export types
export type ForecastAdjustmentInput = z.infer<typeof forecastAdjustmentSchema>
export type QuickRateAdjustmentInput = z.infer<typeof quickRateAdjustmentSchema>
export type RoomStatusInput = z.infer<typeof roomStatusSchema>
export type ForecastGenerationInput = z.infer<typeof forecastGenerationSchema>
export type ForecastGridFilterInput = z.infer<typeof forecastGridFilterSchema>
export type ForecastExportInput = z.infer<typeof forecastExportSchema>
