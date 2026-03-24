'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResponse, Room, PaginatedResponse } from '@/lib/types/database'

const roomSchema = z.object({
    room_number: z.string().min(1, 'Room number is required').max(20),
    building_id: z.string().uuid('Invalid building'),
    floor_plan_id: z.string().uuid('Invalid floor plan').nullable().optional(),
    room_type_id: z.string().uuid('Invalid room type'),
    status: z.enum(['available', 'occupied', 'maintenance', 'out_of_order']).default('available'),
})

export async function getRooms(
  page = 1, 
  pageSize = 10, 
  search = '',
  filters?: { building_id?: string; floor_plan_id?: string; room_type_id?: string; status?: string }
): Promise<PaginatedResponse<Room>> {
    const supabase = await createClient()
    let query = supabase.from('rooms').select('*, building:buildings(id,name), floor_plan:floor_plans(id,name), room_type:room_types(id,code,name,max_occupancy)', { count: 'exact' })
    
    if (search) query = query.or(`room_number.ilike.%${search}%`)
    
    if (filters?.building_id && filters.building_id !== 'all') {
        query = query.eq('building_id', filters.building_id)
    }
    if (filters?.floor_plan_id && filters.floor_plan_id !== 'all') {
        query = query.eq('floor_plan_id', filters.floor_plan_id)
    }
    if (filters?.room_type_id && filters.room_type_id !== 'all') {
        query = query.eq('room_type_id', filters.room_type_id)
    }
    if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
    }
    
    const from = (page - 1) * pageSize
    const { data, count, error } = await query.order('room_number').range(from, from + pageSize - 1)
    if (error) { console.error(error); return { data: [], count: 0, page, pageSize } }
    return { data: (data || []) as Room[], count: count || 0, page, pageSize }
}

export async function getRoom(id: string): Promise<Room | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('rooms')
        .select('*, building:buildings(id,name), floor_plan:floor_plans(id,name), room_type:room_types(id,code,name,max_occupancy)')
        .eq('id', id)
        .single()
    if (error) return null
    return data as Room
}

export async function createRoom(formData: unknown): Promise<ActionResponse<Room>> {
    const parsed = roomSchema.safeParse(formData)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('rooms')
        .insert(parsed.data)
        .select()
        .single()
    
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Room }
}

export async function updateRoom(id: string, formData: unknown): Promise<ActionResponse<Room>> {
    const parsed = roomSchema.partial().safeParse(formData)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('rooms')
        .update(parsed.data)
        .eq('id', id)
        .select()
        .single()
    
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Room }
}

export async function deleteRoom(id: string): Promise<ActionResponse> {
    const supabase = await createClient()
    
    // Check for active reservations
    const { data: reservations } = await supabase
        .from('reservations')
        .select('id')
        .eq('room_id', id)
        .in('status', ['reserved', 'checked_in'])
        .limit(1)
    
    if (reservations && reservations.length > 0) {
        return { success: false, error: 'Cannot delete: room has active reservations' }
    }
    
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function updateRoomStatus(roomId: string, status: string): Promise<ActionResponse> {
    const supabase = await createClient()
    const { error } = await supabase.from('rooms').update({ status }).eq('id', roomId)
    if (error) return { success: false, error: error.message }
    return { success: true }
}

// Move room (swap rooms for a reservation)
export async function moveRoom(sourceRoomId: string, targetRoomId: string, checkInDate?: string, checkOutDate?: string): Promise<ActionResponse> {
    const supabase = await createClient()
    
    // Get active reservation for source room
    const { data: reservation } = await supabase
        .from('reservations')
        .select('*')
        .eq('room_id', sourceRoomId)
        .in('status', ['reserved', 'checked_in'])
        .single()
    
    if (!reservation) {
        return { success: false, error: 'No active reservation found for source room' }
    }
    
    // Use provided dates or fallback to reservation dates
    const resCheckIn = checkInDate || reservation.check_in_date
    const resCheckOut = checkOutDate || reservation.check_out_date
    
    // Check for conflicting reservations in target room
    const { data: conflicts } = await supabase
        .from('reservations')
        .select('*')
        .eq('room_id', targetRoomId)
        .in('status', ['reserved', 'checked_in'])
        .neq('id', reservation.id)
    
    // Check if any existing reservation overlaps with the dates we're moving
    const hasOverlap = conflicts?.some(r => {
        const existingCheckIn = new Date(r.check_in_date)
        const existingCheckOut = new Date(r.check_out_date)
        const newCheckIn = new Date(resCheckIn)
        const newCheckOut = new Date(resCheckOut)
        return !(newCheckOut <= existingCheckIn || newCheckIn >= existingCheckOut)
    })
    
    if (hasOverlap) {
        return { success: false, error: 'Target room has conflicting reservations for these dates' }
    }
    
    // Update reservation with new room
    const { error: updateError } = await supabase
        .from('reservations')
        .update({ room_id: targetRoomId })
        .eq('id', reservation.id)
    
    if (updateError) return { success: false, error: updateError.message }
    
    // Update room statuses
    await supabase.from('rooms').update({ status: 'available' }).eq('id', sourceRoomId)
    await supabase.from('rooms').update({ status: reservation.status === 'checked_in' ? 'occupied' : 'reserved' }).eq('id', targetRoomId)
    
    return { success: true }
}

// Get room availability for a date range
export async function getRoomAvailability(checkIn: string, checkOut: string, roomTypeId?: string): Promise<Room[]> {
    const supabase = await createClient()
    
    let query = supabase
        .from('rooms')
        .select('*, building:buildings(id,name), room_type:room_types(id,code,name,base_price)')
        .not('status', 'eq', 'maintenance')
        .not('status', 'eq', 'out_of_order')
    
    if (roomTypeId) {
        query = query.eq('room_type_id', roomTypeId)
    }
    
    const { data: rooms } = await query
    
    if (!rooms) return []
    
    const availableRooms: Room[] = []
    
    for (const room of rooms) {
        const { data: conflicts } = await supabase
            .from('reservations')
            .select('id')
            .eq('room_id', room.id)
            .in('status', ['reserved', 'checked_in'])
            .or(`check_in_date.lt.${checkOut},check_out_date.gt.${checkIn}`)
        
        if (!conflicts || conflicts.length === 0) {
            availableRooms.push(room)
        }
    }
    
    return availableRooms
}

// Get room status summary
export async function getRoomStatusSummary(): Promise<Record<string, number>> {
    const supabase = await createClient()
    
    const { data: rooms } = await supabase
        .from('rooms')
        .select('status')
    
    const summary: Record<string, number> = {
        available: 0,
        occupied: 0,
        reserved: 0,
        dirty: 0,
        clean: 0,
        maintenance: 0,
        out_of_order: 0,
    }
    
    rooms?.forEach(room => {
        const status = room.status || 'available'
        summary[status] = (summary[status] || 0) + 1
    })
    
    return summary
}

export async function getRoomTypes(page = 1, pageSize = 100, search = ''): Promise<PaginatedResponse<any>> {
    const supabase = await createClient()
    let query = supabase.from('room_types').select('*', { count: 'exact' })
    
    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`)
    
    query = query.eq('deleted_at', null).order('name')
    
    const { data, error, count } = await query
    
    if (error) return { data: [], count: 0, page, pageSize }
    
    return { data: data || [], count: count || 0, page, pageSize }
}
