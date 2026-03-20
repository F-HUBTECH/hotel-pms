'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResponse } from '@/lib/types/database'

export interface OccupancyReport {
  date: string
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  outOfOrderRooms: number
  occupancyRate: number
  arrivals: number
  departures: number
  stayovers: number
}

export interface RevenueReport {
  date: string
  roomRevenue: number
  fandbRevenue: number
  otherRevenue: number
  totalRevenue: number
  avgDailyRate: number
  revPAR: number
}

export async function getDashboardMetrics(startDate: string, endDate: string) {
    try {
        const supabase = await createClient()

        // 1. Get total rooms
        const { count: totalRooms } = await supabase.from('rooms').select('*', { count: 'exact' }).eq('status', 'available')

        const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
        const totalAvailableRoomNights = (totalRooms || 0) * days

        // 2. Get reservations that overlap this date range
        // Status should be checked_in or checked_out for past dates, or reserved for future dates. But typically reports look at actuals or books. Let's include everything except cancelled/no_show.
        const { data: reservations, error } = await supabase
            .from('reservations')
            .select(`
                id, check_in_date, check_out_date, rate, status,
                market:markets(name),
                source:booking_sources(name)
            `)
            .in('status', ['reserved', 'checked_in', 'checked_out'])
            .lte('check_in_date', endDate)
            .gte('check_out_date', startDate)

        if (error) throw new Error(error.message)

        let totalOccupiedNights = 0
        let totalRevenue = 0
        const revenueByMarket: Record<string, number> = {}
        const revenueBySource: Record<string, number> = {}

        const startMs = new Date(startDate).getTime()
        const endMs = new Date(endDate).getTime()

        reservations?.forEach(res => {
            // Calculate overlap
            const resInMs = new Date(res.check_in_date).getTime()
            const resOutMs = new Date(res.check_out_date).getTime()

            const overlapStart = Math.max(startMs, resInMs)
            const overlapEnd = Math.min(endMs, resOutMs)

            if (overlapEnd > overlapStart) {
                const overlapNights = Math.ceil((overlapEnd - overlapStart) / 86400000)
                const rev = overlapNights * res.rate

                totalOccupiedNights += overlapNights
                totalRevenue += rev

                const marketName = (res.market as any)?.name || 'Direct / Undefined'
                const sourceName = (res.source as any)?.name || 'Walk-in / Undefined'

                revenueByMarket[marketName] = (revenueByMarket[marketName] || 0) + rev
                revenueBySource[sourceName] = (revenueBySource[sourceName] || 0) + rev
            }
        })

        const occupancy = totalAvailableRoomNights > 0 ? (totalOccupiedNights / totalAvailableRoomNights) * 100 : 0
        const adr = totalOccupiedNights > 0 ? (totalRevenue / totalOccupiedNights) : 0
        const revpar = totalAvailableRoomNights > 0 ? (totalRevenue / totalAvailableRoomNights) : 0

        // Format for charts
        const marketChart = Object.entries(revenueByMarket)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)

        const sourceChart = Object.entries(revenueBySource)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)

        return {
            success: true,
            data: {
                totalRevenue,
                totalOccupiedNights,
                totalAvailableRoomNights,
                occupancy,
                adr,
                revpar,
                marketChart,
                sourceChart
            }
        }

    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Get occupancy report for date range
export async function getOccupancyReport(
  startDate: string, 
  endDate: string
): Promise<ActionResponse<OccupancyReport[]>> {
  const supabase = await createClient()
  
  try {
    // Get all rooms count
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, status')
    
    if (roomsError) throw roomsError
    
    const totalRooms = rooms?.length || 0
    const outOfOrderRooms = rooms?.filter(r => r.status === 'out_of_order').length || 0
    const availableRoomCount = totalRooms - outOfOrderRooms
    
    // Generate daily stats
    const report: OccupancyReport[] = []
    const currentDate = new Date(startDate)
    const end = new Date(endDate)
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]
      
      // Get reservations for this date
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('status, check_in_date, check_out_date')
        .lte('check_in_date', dateStr)
        .gte('check_out_date', dateStr)
        .in('status', ['checked_in', 'reserved'])
      
      if (resError) throw resError
      
      const occupiedRooms = reservations?.filter(r => {
        const checkIn = new Date(r.check_in_date)
        const checkOut = new Date(r.check_out_date)
        const current = new Date(dateStr)
        return current >= checkIn && current < checkOut && 
               (r.status === 'checked_in' || r.status === 'reserved')
      }).length || 0
      
      // Get arrivals for this date
      const { count: arrivals, error: arrError } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('check_in_date', dateStr)
        .eq('status', 'checked_in')
      
      if (arrError) throw arrError
      
      // Get departures for this date
      const { count: departures, error: depError } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('check_out_date', dateStr)
        .eq('status', 'checked_out')
      
      if (depError) throw depError
      
      const stayovers = Math.max(0, occupiedRooms - (arrivals || 0))
      
      report.push({
        date: dateStr,
        totalRooms,
        occupiedRooms,
        availableRooms: availableRoomCount - occupiedRooms,
        outOfOrderRooms,
        occupancyRate: availableRoomCount > 0 ? Math.round((occupiedRooms / availableRoomCount) * 100) : 0,
        arrivals: arrivals || 0,
        departures: departures || 0,
        stayovers,
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return { success: true, data: report }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Get revenue report
export async function getRevenueReport(
  startDate: string,
  endDate: string
): Promise<ActionResponse<RevenueReport[]>> {
  const supabase = await createClient()
  
  try {
    const report: RevenueReport[] = []
    const currentDate = new Date(startDate)
    const end = new Date(endDate)
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]
      
      // Get folio items for this date
      const { data: items, error: itemsError } = await supabase
        .from('folio_items')
        .select('amount, description')
        .eq('item_date', dateStr)
        .eq('is_voided', false)
      
      if (itemsError) throw itemsError
      
      // Calculate revenue by category
      let roomRevenue = 0
      let fandbRevenue = 0
      let otherRevenue = 0
      
      items?.forEach(item => {
        const amount = Number(item.amount) || 0
        if (item.description?.toLowerCase().includes('room')) {
          roomRevenue += amount
        } else if (item.description?.toLowerCase().includes('f&b') || 
                   item.description?.toLowerCase().includes('restaurant') ||
                   item.description?.toLowerCase().includes('minibar')) {
          fandbRevenue += amount
        } else {
          otherRevenue += amount
        }
      })
      
      // Get occupied rooms for ADR and RevPAR
      const { data: reservations } = await supabase
        .from('reservations')
        .select('rate')
        .lte('check_in_date', dateStr)
        .gte('check_out_date', dateStr)
        .eq('status', 'checked_in')
      
      const occupiedRooms = reservations?.length || 0
      const totalRevenue = roomRevenue + fandbRevenue + otherRevenue
      const avgDailyRate = occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0
      
      // Get total room count for RevPAR
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id')
        .neq('status', 'out_of_order')
      
      const availableRooms = rooms?.length || 0
      const revPAR = availableRooms > 0 ? roomRevenue / availableRooms : 0
      
      report.push({
        date: dateStr,
        roomRevenue,
        fandbRevenue,
        otherRevenue,
        totalRevenue,
        avgDailyRate,
        revPAR,
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return { success: true, data: report }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Get room type statistics
export async function getRoomTypeStats(date: string): Promise<ActionResponse<any[]>> {
  const supabase = await createClient()
  
  try {
    // Get room types with room counts
    const { data: roomTypes, error: rtError } = await supabase
      .from('room_types')
      .select('id, code, name, base_price')
    
    if (rtError) throw rtError
    
    const stats = []
    
    for (const rt of roomTypes || []) {
      // Get total rooms of this type
      const { count: totalRooms, error: countError } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('room_type_id', rt.id)
      
      if (countError) throw countError
      
      // Get occupied rooms of this type
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('room_id')
        .lte('check_in_date', date)
        .gte('check_out_date', date)
        .eq('status', 'checked_in')
      
      if (resError) throw resError
      
      // Get room IDs that are occupied
      const occupiedRoomIds = reservations?.map(r => r.room_id) || []
      
      // Count occupied rooms of this type
      let occupiedRooms = 0
      if (occupiedRoomIds.length > 0) {
        const { count: occCount, error: occError } = await supabase
          .from('rooms')
          .select('*', { count: 'exact', head: true })
          .eq('room_type_id', rt.id)
          .in('id', occupiedRoomIds)
        
        if (!occError) occupiedRooms = occCount || 0
      }
      
      stats.push({
        roomTypeId: rt.id,
        code: rt.code,
        name: rt.name,
        basePrice: rt.base_price,
        totalRooms: totalRooms || 0,
        occupiedRooms,
        availableRooms: (totalRooms || 0) - occupiedRooms,
        occupancyRate: (totalRooms || 0) > 0 ? Math.round((occupiedRooms / (totalRooms || 0)) * 100) : 0,
      })
    }
    
    return { success: true, data: stats }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Get source/market statistics
export async function getSourceMarketStats(startDate: string, endDate: string): Promise<ActionResponse<any[]>> {
  const supabase = await createClient()
  
  try {
    // Get reservations grouped by source
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('source_id, source:booking_sources(id, name), rate, check_in_date, check_out_date')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate)
    
    if (error) throw error
    
    // Group by source
    const stats = new Map()
    
    reservations?.forEach(res => {
      const sourceId = res.source_id || 'unknown'
      const sourceName = (res.source as any)?.name || 'Unknown'
      
      // Calculate nights
      const checkIn = new Date(res.check_in_date)
      const checkOut = new Date(res.check_out_date)
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)))
      const revenue = (res.rate || 0) * nights
      
      if (!stats.has(sourceId)) {
        stats.set(sourceId, {
          sourceId,
          sourceName,
          reservationCount: 0,
          roomNights: 0,
          revenue: 0,
        })
      }
      
      const stat = stats.get(sourceId)
      stat.reservationCount++
      stat.roomNights += nights
      stat.revenue += revenue
    })
    
    return { success: true, data: Array.from(stats.values()) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
