'use server'

/**
 * Hotel PMS - Forecast Server Actions (Updated)
 * Full-feature room-by-room forecast grid
 * Matches RPC functions in forecast_functions.sql
 */

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================
// 1. GENERATE FORECAST
// =============================================

export async function generateForecast(data: {
  startDate: string
  endDate: string
  configId?: string
  userId?: string
}) {
  try {
    const { startDate, endDate, configId, userId } = data

    // Validate date range
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      return { success: false, error: 'End date must be after start date' }
    }

    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 365) {
      return { success: false, error: 'Date range cannot exceed 365 days' }
    }

    // Call RPC function - returns SETOF JSONB
    const { data: result, error } = await supabase.rpc('rpc_generate_daily_forecast', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_config_id: configId || null,
      p_user_id: userId || null
    })

    if (error) {
      console.error('Generate forecast error:', error)
      return { success: false, error: error.message }
    }

    // The RPC returns SETOF JSONB, insert results into forecast_room_daily
    if (result && result.length > 0) {
      for (const row of result) {
        await supabase.from('forecast_room_daily').upsert({
          forecast_date: row.forecast_date,
          room_id: row.room_id,
          building_id: row.building_id,
          room_type_id: row.room_type_id,
          room_status: row.room_status,
          booking_status: row.booking_status,
          guest_type: row.guest_type,
          pax_adults: row.pax_adults || 0,
          pax_children: row.pax_children || 0,
          rate_code: row.rate_code,
          rate_amount: row.rate_amount || 0,
          allot_code: row.allot_code,
          expected_revenue: row.expected_revenue || 0,
          expected_room_revenue: row.expected_room_revenue || 0,
          expected_extra_revenue: row.expected_extra_revenue || 0,
          total_revenue: row.expected_revenue || 0,
          is_override: row.is_override || false
        }, {
          onConflict: 'forecast_date,room_id'
        })
      }
    }

    // Revalidate cache
    revalidatePath('/dashboard/reports/forecast')

    return { success: true, data: result, count: result?.length || 0 }
  } catch (error) {
    console.error('Generate forecast error:', error)
    return { success: false, error: 'Failed to generate forecast' }
  }
}

// =============================================
// 2. GET FORECAST ROOM GRID
// =============================================

export async function getForecastRoomGrid(data: {
  startDate: string
  endDate: string
  configId?: string
  buildingId?: string
  roomTypeId?: string
  includeOoRooms?: boolean
  includeOiRooms?: boolean
  includeHuRooms?: boolean
}) {
  try {
    const {
      startDate,
      endDate,
      configId,
      buildingId,
      roomTypeId,
      includeOoRooms = false,
      includeOiRooms = false,
      includeHuRooms = true
    } = data

    // Call RPC function
    const { data: result, error } = await supabase.rpc('rpc_get_forecast_room_grid', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_building_id: buildingId || null,
      p_room_type_id: roomTypeId || null,
      p_show_revenue: true,
      p_show_pax: true
    })

    if (error) {
      console.error('Get forecast grid error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('Get forecast grid error:', error)
    return { success: false, error: 'Failed to fetch forecast grid' }
  }
}

// =============================================
// 3. CALCULATE DAILY SUMMARY
// =============================================

export async function calculateDailySummary(data: {
  forecastDate: string
  propertyId?: string
}) {
  try {
    const { forecastDate, propertyId } = data

    // Call RPC function - returns JSONB
    const { data: result, error } = await supabase.rpc('rpc_calculate_daily_summary', {
      p_forecast_date: forecastDate,
      p_property_id: propertyId || null
    })

    if (error) {
      console.error('Calculate daily summary error:', error)
      return { success: false, error: error.message }
    }

    // Upsert to forecast_summary_daily
    if (result) {
      await supabase.from('forecast_summary_daily').upsert({
        forecast_date: result.forecast_date,
        property_id: result.property_id,
        total_rooms: result.total_rooms,
        available_rooms: result.available_rooms,
        occupied_rooms: result.occupied_rooms,
        stayover_rooms: result.stayover_rooms,
        arrival_rooms: result.arrival_rooms,
        departure_rooms: result.departure_rooms,
        oo_rooms: result.oo_rooms,
        oi_rooms: result.oi_rooms,
        hu_rooms: result.hu_rooms,
        complimentary_rooms: result.complimentary_rooms,
        occupancy_percentage: result.occupancy_percentage,
        rooms_sold: result.rooms_sold,
        total_revenue: result.total_revenue,
        room_revenue: result.room_revenue,
        extra_revenue: result.extra_revenue,
        fit_revenue: result.fit_revenue,
        grp_revenue: result.grp_revenue,
        adr: result.adr,
        revpar: result.revpar,
        actual_rooms_sold: result.actual_rooms_sold,
        actual_revenue: result.actual_revenue,
        actual_adr: result.actual_adr,
        actual_revpar: result.actual_revpar,
        revenue_variance: result.revenue_variance,
        variance_percentage: result.variance_percentage
      }, {
        onConflict: 'forecast_date,property_id'
      })
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('Calculate daily summary error:', error)
    return { success: false, error: 'Failed to calculate daily summary' }
  }
}

// =============================================
// 4. ADJUST FORECAST ITEM
// =============================================

const adjustForecastItemSchema = z.object({
  itemId: z.string().uuid(),
  rateAmount: z.number().min(0),
  overrideReason: z.string().min(1, 'Reason is required'),
  userId: z.string().uuid().optional()
})

export async function adjustForecastItem(formData: FormData) {
  try {
    // Validate form data
    const validated = adjustForecastItemSchema.parse({
      itemId: formData.get('itemId'),
      rateAmount: Number(formData.get('rateAmount')),
      overrideReason: formData.get('overrideReason'),
      userId: formData.get('userId') || undefined
    })

    // Call RPC function - parameter is p_rate_amount not p_new_rate
    const { data: result, error } = await supabase.rpc('rpc_adjust_forecast_item', {
      p_item_id: validated.itemId,
      p_rate_amount: validated.rateAmount,
      p_override_reason: validated.overrideReason,
      p_user_id: validated.userId || null
    })

    if (error) {
      console.error('Adjust forecast item error:', error)
      return { success: false, error: error.message }
    }

    // Revalidate cache
    revalidatePath('/dashboard/reports/forecast')

    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: String(error) }
    }
    console.error('Adjust forecast item error:', error)
    return { success: false, error: 'Failed to adjust forecast item' }
  }
}

export async function adjustForecastItemDirect(data: {
  itemId: string
  rateAmount: number
  overrideReason: string
  userId?: string
}) {
  try {
    const validated = adjustForecastItemSchema.parse(data)

    const { data: result, error } = await supabase.rpc('rpc_adjust_forecast_item', {
      p_item_id: validated.itemId,
      p_rate_amount: validated.rateAmount,
      p_override_reason: validated.overrideReason,
      p_user_id: validated.userId || null
    })

    if (error) {
      console.error('Adjust forecast item error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/reports/forecast')

    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: String(error) }
    }
    console.error('Adjust forecast item error:', error)
    return { success: false, error: 'Failed to adjust forecast item' }
  }
}

// =============================================
// 5. UPDATE ROOM STATUS DATE
// =============================================

const roomStatusDateSchema = z.object({
  roomId: z.string().uuid(),
  statusType: z.enum(['OO', 'OI', 'HU'], { message: 'Status type must be OO, OI, or HU' }),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  reason: z.string().optional(),
  userId: z.string().uuid().optional()
})

export async function updateRoomStatusDate(formData: FormData) {
  try {
    const validated = roomStatusDateSchema.parse({
      roomId: formData.get('roomId'),
      statusType: formData.get('statusType'),
      fromDate: formData.get('fromDate'),
      toDate: formData.get('toDate'),
      reason: formData.get('reason'),
      userId: formData.get('userId') || undefined
    })

    // Call RPC function - simplified parameters
    const { data: result, error } = await supabase.rpc('rpc_update_room_status_date', {
      p_room_id: validated.roomId,
      p_status_type: validated.statusType,
      p_from_date: validated.fromDate,
      p_to_date: validated.toDate,
      p_reason: validated.reason || '',
      p_user_id: validated.userId || null
    })

    if (error) {
      console.error('Update room status date error:', error)
      return { success: false, error: error.message }
    }

    // Revalidate cache
    revalidatePath('/dashboard/reports/forecast')
    revalidatePath('/dashboard/rooms')

    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as unknown as z.ZodError
      return { success: false, error: String(error) }
    }
    console.error('Update room status date error:', error)
    return { success: false, error: 'Failed to update room status date' }
  }
}

export async function updateRoomStatusDateDirect(data: {
  roomId: string
  statusType: 'OO' | 'OI' | 'HU'
  fromDate: string
  toDate: string
  reason?: string
  userId?: string
}) {
  try {
    const validated = roomStatusDateSchema.parse(data)

    const { data: result, error } = await supabase.rpc('rpc_update_room_status_date', {
      p_room_id: validated.roomId,
      p_status_type: validated.statusType,
      p_from_date: validated.fromDate,
      p_to_date: validated.toDate,
      p_reason: validated.reason || '',
      p_user_id: validated.userId || null
    })

    if (error) {
      console.error('Update room status date error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/reports/forecast')
    revalidatePath('/dashboard/rooms')

    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as unknown as z.ZodError
      return { success: false, error: String(error) }
    }
    console.error('Update room status date error:', error)
    return { success: false, error: 'Failed to update room status date' }
  }
}

// =============================================
// 6. DELETE FORECAST DATA
// =============================================

export async function deleteForecastData(data: {
  startDate: string
  endDate: string
  propertyId?: string
  userId?: string
}) {
  try {
    const { startDate, endDate, propertyId, userId } = data

    // Call RPC function
    const { data: result, error } = await supabase.rpc('rpc_delete_forecast_data', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_property_id: propertyId || null,
      p_user_id: userId || null
    })

    if (error) {
      console.error('Delete forecast data error:', error)
      return { success: false, error: error.message }
    }

    // Revalidate cache
    revalidatePath('/dashboard/reports/forecast')

    return { success: true, data: result }
  } catch (error) {
    console.error('Delete forecast data error:', error)
    return { success: false, error: 'Failed to delete forecast data' }
  }
}

// =============================================
// 7. GET FORECAST CONFIGURATIONS
// =============================================

export async function getForecastConfigurations(propertyId?: string) {
  try {
    let query = supabase
      .from('forecast_configurations')
      .select('*')
      .order('created_at', { ascending: false })

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get forecast configurations error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Get forecast configurations error:', error)
    return { success: false, error: 'Failed to fetch forecast configurations' }
  }
}

// =============================================
// 8. GET ROOM STATUS DATES
// =============================================

export async function getRoomStatusDates(roomId?: string, propertyId?: string) {
  try {
    let query = supabase
      .from('room_status_dates')
      .select(`
        *,
        rooms (
          room_number,
          room_types (name),
          buildings (name, property_id)
        )
      `)
      .order('from_date', { ascending: true })

    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    if (propertyId) {
      // Note: This nested filter may not work directly, might need to fetch rooms first
      // For now, just filter by room_id if provided
      query = query
    }

    const { data, error } = await query

    if (error) {
      console.error('Get room status dates error:', error)
      return { success: false, error: error.message }
    }

    // Filter by property_id client-side if needed
    let filteredData = data
    if (propertyId && data) {
      filteredData = data.filter((item: any) =>
        item.rooms?.buildings?.property_id === propertyId
      )
    }

    return { success: true, data: filteredData }
  } catch (error) {
    console.error('Get room status dates error:', error)
    return { success: false, error: 'Failed to fetch room status dates' }
  }
}

// =============================================
// 9. GET CORPORATE ALLOTMENTS
// =============================================

export async function getCorporateAllotments(activeOnly = true) {
  try {
    let query = supabase
      .from('corporate_allotments')
      .select(`
        *,
        room_types (name, code)
      `)
      .order('allot_code', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get corporate allotments error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Get corporate allotments error:', error)
    return { success: false, error: 'Failed to fetch corporate allotments' }
  }
}

// =============================================
// 10. GET FORECAST SUMMARY (from view)
// =============================================

export async function getForecastSummary(data: {
  startDate?: string
  endDate?: string
  propertyId?: string
  limit?: number
}) {
  try {
    const { startDate, endDate, propertyId, limit = 30 } = data

    let query = supabase
      .from('v_forecast_summary_comparison')
      .select('*')
      .order('forecast_date', { ascending: true })
      .limit(limit)

    if (startDate) {
      query = query.gte('forecast_date', startDate)
    }

    if (endDate) {
      query = query.lte('forecast_date', endDate)
    }

    if (propertyId) {
      // Note: The view doesn't have property_id directly
      // Need to check if view includes it
    }

    const { data: result, error } = await query

    if (error) {
      console.error('Get forecast summary error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('Get forecast summary error:', error)
    return { success: false, error: 'Failed to fetch forecast summary' }
  }
}

// =============================================
// 11. GET ADJUSTMENT HISTORY (from view)
// =============================================

export async function getAdjustmentHistory(roomId?: string, limit = 50) {
  try {
    let query = supabase
      .from('v_forecast_adjustment_history')
      .select('*')
      .order('override_at', { ascending: false })
      .limit(limit)

    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get adjustment history error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Get adjustment history error:', error)
    return { success: false, error: 'Failed to fetch adjustment history' }
  }
}

// =============================================
// 12. CREATE FORECAST CONFIGURATION
// =============================================

const forecastConfigSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  forecastDays: z.number().min(1).max(365).default(30),
  forecastType: z.enum(['summary', 'room_by_room', 'by_room_type', 'by_building']).default('room_by_room'),
  includeWeekendPremium: z.boolean().default(true),
  includeHolidayPremium: z.boolean().default(true),
  weekendPremiumRate: z.number().min(0).default(20.00),
  holidayPremiumRate: z.number().min(0).default(30.00),
  includeOoRooms: z.boolean().default(false),
  includeOiRooms: z.boolean().default(false),
  includeHuRooms: z.boolean().default(true),
  showRevenue: z.boolean().default(true),
  showPax: z.boolean().default(true),
  fitGrpBreakdown: z.boolean().default(true),
  createdBy: z.string().uuid().optional()
})

export async function createForecastConfiguration(data: {
  propertyId: string
  name: string
  description?: string
  forecastDays?: number
  forecastType?: 'summary' | 'room_by_room' | 'by_room_type' | 'by_building'
  includeWeekendPremium?: boolean
  includeHolidayPremium?: boolean
  weekendPremiumRate?: number
  holidayPremiumRate?: number
  includeOoRooms?: boolean
  includeOiRooms?: boolean
  includeHuRooms?: boolean
  showRevenue?: boolean
  showPax?: boolean
  fitGrpBreakdown?: boolean
  createdBy?: string
}) {
  try {
    const validated = forecastConfigSchema.parse(data)

    const { data: result, error } = await supabase
      .from('forecast_configurations')
      .insert({
        property_id: validated.propertyId,
        name: validated.name,
        description: validated.description || '',
        forecast_days: validated.forecastDays,
        forecast_type: validated.forecastType,
        include_weekend_premium: validated.includeWeekendPremium,
        include_holiday_premium: validated.includeHolidayPremium,
        weekend_premium_rate: validated.weekendPremiumRate,
        holiday_premium_rate: validated.holidayPremiumRate,
        include_oo_rooms: validated.includeOoRooms,
        include_oi_rooms: validated.includeOiRooms,
        include_hu_rooms: validated.includeHuRooms,
        show_revenue: validated.showRevenue,
        show_pax: validated.showPax,
        fit_grp_breakdown: validated.fitGrpBreakdown,
        created_by: validated.createdBy
      })
      .select()
      .single()

    if (error) {
      console.error('Create forecast configuration error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/reports/forecast')
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as unknown as z.ZodError
      return { success: false, error: String(error) }
    }
    console.error('Create forecast configuration error:', error)
    return { success: false, error: 'Failed to create forecast configuration' }
  }
}
