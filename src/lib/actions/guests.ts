'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResponse, Guest, PaginatedResponse } from '@/lib/types/database'

const guestSchema = z.object({
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    phone: z.string().max(30).default(''),
    email: z.string().email('Invalid email').or(z.literal('')).default(''),
    nationality_id: z.string().uuid().nullable().optional(),
    passport_type_id: z.string().uuid().nullable().optional(),
    passport_number: z.string().max(50).default(''),
    visa_type_id: z.string().uuid().nullable().optional(),
    address: z.string().max(500).default(''),
})

export async function getGuests(page = 1, pageSize = 10, search = ''): Promise<PaginatedResponse<Guest>> {
    const supabase = await createClient()
    let query = supabase.from('guests').select('*, nationality:nationalities(id,name), passport_type:passport_types(id,name), visa_type:visa_types(id,name)', { count: 'exact' })
    if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,passport_number.ilike.%${search}%`)
    }
    const from = (page - 1) * pageSize
    const { data, count, error } = await query.order('last_name').range(from, from + pageSize - 1)
    if (error) { console.error(error); return { data: [], count: 0, page, pageSize } }
    return { data: (data || []) as Guest[], count: count || 0, page, pageSize }
}

export async function searchGuests(search: string): Promise<Guest[]> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('guests')
        .select('*')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,passport_number.ilike.%${search}%`)
        .order('last_name')
        .limit(20)
    return (data || []) as Guest[]
}

export async function getGuest(id: string): Promise<Guest | null> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('guests')
        .select('*, nationality:nationalities(id,name), passport_type:passport_types(id,name), visa_type:visa_types(id,name)')
        .eq('id', id)
        .single()
    return data as Guest | null
}

export async function createGuest(formData: unknown): Promise<ActionResponse<Guest>> {
    const parsed = guestSchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const insert = { ...parsed.data, nationality_id: parsed.data.nationality_id || null, passport_type_id: parsed.data.passport_type_id || null, visa_type_id: parsed.data.visa_type_id || null }
    const { data, error } = await supabase.from('guests').insert(insert).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Guest }
}

export async function updateGuest(id: string, formData: unknown): Promise<ActionResponse<Guest>> {
    const parsed = guestSchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const update = { ...parsed.data, nationality_id: parsed.data.nationality_id || null, passport_type_id: parsed.data.passport_type_id || null, visa_type_id: parsed.data.visa_type_id || null }
    const { data, error } = await supabase.from('guests').update(update).eq('id', id).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Guest }
}

export async function deleteGuest(id: string): Promise<ActionResponse> {
    const supabase = await createClient()
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (error) {
        if (error.code === '23503') return { success: false, error: 'Cannot delete: guest has reservations' }
        return { success: false, error: error.message }
    }
    return { success: true }
}

// ===== Link Share Room =====
export async function linkShareRoom(
    mainReservationId: string,
    shareReservationId: string
): Promise<ActionResponse> {
    const supabase = await createClient()
    
    // Verify both reservations exist and are in the same room
    const { data: mainRes } = await supabase
        .from('reservations')
        .select('id, room_id, check_in_date, check_out_date, status')
        .eq('id', mainReservationId)
        .single()
    
    const { data: shareRes } = await supabase
        .from('reservations')
        .select('id, room_id, check_in_date, check_out_date, status')
        .eq('id', shareReservationId)
        .single()

    if (!mainRes || !shareRes) {
        return { success: false, error: 'Reservation not found' }
    }

    if (mainRes.room_id !== shareRes.room_id) {
        return { success: false, error: 'Both reservations must be in the same room' }
    }

    // Check dates overlap
    const mainIn = new Date(mainRes.check_in_date)
    const mainOut = new Date(mainRes.check_out_date)
    const shareIn = new Date(shareRes.check_in_date)
    const shareOut = new Date(shareRes.check_out_date)

    if (shareIn >= mainOut || shareOut <= mainIn) {
        return { success: false, error: 'Stay dates do not overlap' }
    }

    // Update share reservation
    const { error } = await supabase
        .from('reservations')
        .update({
            share_with_reservation_id: mainReservationId,
            is_share: true
        })
        .eq('id', shareReservationId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// ===== Unlink Share Room =====
export async function unlinkShareRoom(reservationId: string): Promise<ActionResponse> {
    const supabase = await createClient()
    
    const { error } = await supabase
        .from('reservations')
        .update({
            share_with_reservation_id: null,
            is_share: false
        })
        .eq('id', reservationId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// ===== Get Share Room Guests =====
export async function getShareRoomGuests(reservationId: string): Promise<ActionResponse<{ reservations: any[], guests: any[] }>> {
    const supabase = await createClient()

    // Find all linked reservations (same room, overlapping dates)
    const { data: reservation } = await supabase
        .from('reservations')
        .select('room_id, check_in_date, check_out_date')
        .eq('id', reservationId)
        .single()

    if (!reservation) return { success: false, error: 'Reservation not found' }

    // Get all reservations in the same room with overlapping dates
    const { data: linkedReservations } = await supabase
        .from('reservations')
        .select('*, guest:guests(*)')
        .eq('room_id', reservation.room_id)
        .eq('status', 'checked_in')
        .or(`check_in_date.lt.${reservation.check_out_date},check_out_date.gt.${reservation.check_in_date}`)

    if (!linkedReservations) return { success: false, error: 'Error fetching share guests' }

    const guests = linkedReservations.map((r: any) => r.guest).filter(Boolean)

    return { success: true, data: { reservations: linkedReservations, guests } }
}
