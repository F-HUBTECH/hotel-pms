'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResponse, Reservation, PaginatedResponse, Room } from '@/lib/types/database'

const reservationSchema = z.object({
    guest_id: z.string().uuid('Guest is required'),
    room_id: z.string().uuid().nullable().optional(),
    room_type_id: z.string().uuid('Room type is required'),
    check_in_date: z.string().min(1, 'Check-in date is required'),
    check_out_date: z.string().min(1, 'Check-out date is required'),
    adults: z.number().min(1).default(1),
    children: z.number().min(0).default(0),
    rate: z.number().min(0).default(0),
    status: z.enum(['reserved', 'checked_in', 'checked_out', 'cancelled', 'no_show']).default('reserved'),
    source_id: z.string().uuid().nullable().optional(),
    market_id: z.string().uuid().nullable().optional(),
    notes: z.string().max(1000).default(''),
    created_by: z.string().uuid().nullable().optional(),
})

import { ReservationService } from '../services/reservation-service'
import { RateRepository } from '../repositories/rate-repo'

// ===== Availability Check =====
export async function checkAvailability(
    checkIn: string, checkOut: string, roomTypeId?: string
): Promise<Room[]> {
    const supabase = await createClient()

    try {
        console.log('checkAvailability called:', { checkIn, checkOut, roomTypeId })

        // First check ALL rooms in DB (no filters) to debug
        const { data: allDbRooms, error: allError } = await supabase
            .from('rooms')
            .select('id, room_number, status, room_type_id')
            .limit(50)
        
        console.log('ALL rooms in DB:', allDbRooms?.length || 0, 'Error:', allError?.message)
        
        // Check if room_type_id matches any rooms
        const matchingRt = allDbRooms?.filter(r => r.room_type_id === roomTypeId)
        console.log('Rooms with matching room_type_id:', matchingRt?.length || 0)
        console.log('Matching rooms:', matchingRt?.map(r => ({ id: r.id, num: r.room_number, status: r.status })))
        
        // Check available/clean rooms
        const availableClean = allDbRooms?.filter(r => r.status === 'available' || r.status === 'clean')
        console.log('Rooms with status available/clean:', availableClean?.length || 0)
        
        // First get all rooms of the requested type that are available/clean
        let roomsQuery = supabase
            .from('rooms')
            .select('*, building:buildings(id,name), room_type:room_types(id,code,name,base_price)')
            .in('status', ['available', 'clean'])

        if (roomTypeId) {
            console.log('Filtering by room_type_id:', roomTypeId)
            roomsQuery = roomsQuery.eq('room_type_id', roomTypeId)
        }

        const { data: allRooms, error: roomsError } = await roomsQuery.order('room_number')

        if (roomsError) {
            console.error('Error fetching rooms:', roomsError)
            return []
        }

        console.log('Available/Clean rooms found:', allRooms?.length || 0)

        // Get booked room IDs for the date range
        console.log('Checking for booked rooms between', checkIn, 'and', checkOut)
        const { data: bookedReservations, error: bookedError } = await supabase
            .from('reservations')
            .select('room_id')
            .in('status', ['reserved', 'checked_in'])
            .lt('check_in_date', checkOut)
            .gt('check_out_date', checkIn)
            .not('room_id', 'is', null)

        if (bookedError) {
            console.error('Error fetching booked reservations:', bookedError)
            return allRooms || []
        }

        console.log('Booked reservations found:', bookedReservations?.length || 0)

        const bookedRoomIds = new Set(
            (bookedReservations || [])
                .map(r => r.room_id)
                .filter((id): id is string => !!id)
        )

        console.log('Booked room IDs to exclude:', Array.from(bookedRoomIds))

        // Filter out booked rooms
        const availableRooms = (allRooms || []).filter(room => !bookedRoomIds.has(room.id))

        console.log('Final available rooms after filtering:', availableRooms.length)
        return availableRooms as Room[]
    } catch (err: any) {
        console.error('checkAvailability exception:', err)
        return []
    }
}

// ===== Get Reservations =====
export async function getReservations(
    page = 1, pageSize = 10, search = '', statusFilter = ''
): Promise<PaginatedResponse<Reservation>> {
    const supabase = await createClient()
    let query = supabase.from('reservations').select(
        '*, guest:guests(id,first_name,last_name,email,phone), room:rooms(id,room_number), room_type:room_types(id,code,name), source:booking_sources(id,name), market:markets(id,name)',
        { count: 'exact' }
    )
    if (search) {
        query = query.or(`reservation_number.ilike.%${search}%`)
    }
    if (statusFilter) {
        const statuses = statusFilter.split(',').filter(s => s.trim())
        if (statuses.length > 0) {
            query = query.in('status', statuses)
        }
    }
    const from = (page - 1) * pageSize
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
    if (error) { console.error(error); return { data: [], count: 0, page, pageSize } }
    return { data: (data || []) as Reservation[], count: count || 0, page, pageSize }
}

// ===== Get Single Reservation =====
export async function getReservation(id: string): Promise<Reservation | null> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('reservations')
        .select('*, guest:guests(*), room:rooms(id,room_number,status), room_type:room_types(id,code,name,base_price), source:booking_sources(id,name), market:markets(id,name)')
        .eq('id', id)
        .single()
    return data as Reservation | null
}

// ===== Create Reservation =====
export async function createReservation(formData: unknown): Promise<ActionResponse<Reservation>> {
    const parsed = reservationSchema.extend({
        rate_plan_id: z.string().uuid().optional()
    }).safeParse(formData)

    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const data = parsed.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Get default property
    const { data: prop } = await supabase.from('properties').select('id').eq('code', 'MAIN').single()
    if (!prop) return { success: false, error: 'Property not configured' }

    let ratePlan = undefined
    if (data.rate_plan_id) {
        const plans = await RateRepository.getRatePlansByRoomType(prop.id, data.room_type_id)
        ratePlan = plans.find(p => p.id === data.rate_plan_id)
    }

    const result = await ReservationService.bookReservation({
        property_id: prop.id,
        guest_id: data.guest_id,
        room_id: data.room_id || undefined,
        room_type_id: data.room_type_id,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        adults: data.adults,
        children: data.children,
        rate: data.rate,
        source_id: data.source_id || undefined,
        market_id: data.market_id || undefined,
        notes: data.notes,
        created_by: user?.id,
    }, ratePlan)

    if (!result.success) return { success: false, error: result.error }

    // Fetch the created reservation to return
    const { data: newRes } = await supabase.from('reservations').select('*').eq('id', result.reservationId).single()
    return { success: true, data: newRes as Reservation }
}

// ===== Check-In =====
export async function checkIn(reservationId: string): Promise<ActionResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Get reservation
    const { data: reservation } = await supabase
        .from('reservations')
        .select('*, room:rooms(id,status)')
        .eq('id', reservationId)
        .single()

    if (!reservation) return { success: false, error: 'Reservation not found' }
    if (reservation.status !== 'reserved') return { success: false, error: 'Can only check-in reserved reservations' }
    if (!reservation.room_id) return { success: false, error: 'No room assigned' }

    const room = reservation.room as { id: string; status: string } | null
    if (room && !['available', 'reserved', 'clean'].includes(room.status)) {
        return { success: false, error: `Cannot check-in: room is ${room.status}` }
    }

    // Check if folio exists, if not create one
    let { data: folio } = await supabase
        .from('folios')
        .select('id')
        .eq('reservation_id', reservationId)
        .single()

    if (!folio) {
        const { data: newFolio, error: folioError } = await supabase
            .from('folios')
            .insert({ reservation_id: reservationId, status: 'open' })
            .select()
            .single()
        if (folioError) return { success: false, error: folioError.message }
        folio = newFolio
    }

    // Update reservation status with check-in time
    const checkInTime = new Date().toTimeString().split(' ')[0].substring(0, 5)
    const { error: resError } = await supabase
        .from('reservations')
        .update({ 
            status: 'checked_in',
            check_in_time: checkInTime,
            check_in_by: user.id 
        })
        .eq('id', reservationId)
    if (resError) return { success: false, error: resError.message }

    // Update room status to occupied
    const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', reservation.room_id)
    if (roomError) return { success: false, error: roomError.message }

    // Add room charge to folio
    const nights = Math.max(1, Math.ceil(
        (new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / (1000 * 60 * 60 * 24)
    ))
    const totalRoomCharge = Number(reservation.rate) * nights

    // Get ROOM transaction code
    const { data: tranCode } = await supabase
        .from('revenue_transaction_codes')
        .select('code')
        .eq('code', 'ROOM')
        .single()

    if (tranCode && folio) {
        await supabase.from('folio_items').insert({
            folio_id: folio.id,
            tran_code: 'ROOM',
            description: `Room charge (${nights} night${nights > 1 ? 's' : ''} × ฿${Number(reservation.rate).toLocaleString()})`,
            amount: totalRoomCharge,
            quantity: nights,
            unit_price: reservation.rate,
            item_date: new Date().toISOString().split('T')[0],
            posted_by: user.id,
            payf: 'I',
        })
        
        // Update folio totals
        const { data: items } = await supabase
            .from('folio_items')
            .select('amount, vat_amount, service_amount')
            .eq('folio_id', folio.id)
            .eq('is_voided', false)
        
        if (items) {
            const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0)
            const totalVat = items.reduce((sum, i) => sum + Number(i.vat_amount || 0), 0)
            const totalService = items.reduce((sum, i) => sum + Number(i.service_amount || 0), 0)
            await supabase.from('folios').update({ 
                total_amount: totalAmount,
                tax_amount: totalVat,
                service_charge: totalService,
                balance: totalAmount
            }).eq('id', folio.id)
        }
    }

    return { success: true }
}

// ===== Check-Out =====
export async function checkOut(reservationId: string, forceCheckout = false): Promise<ActionResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: reservation } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single()

    if (!reservation) return { success: false, error: 'Reservation not found' }
    if (reservation.status !== 'checked_in') return { success: false, error: 'Can only check-out checked-in reservations' }

    // Get folio and check balance
    const { data: folio } = await supabase
        .from('folios')
        .select('id, balance')
        .eq('reservation_id', reservationId)
        .single()

    if (folio && Number(folio.balance) > 0 && !forceCheckout) {
        return { success: false, error: `Cannot check-out: Outstanding balance of ฿${Number(folio.balance).toLocaleString()}. Please settle payment first or use force checkout.` }
    }

    // Record check-out time and user
    const checkOutTime = new Date().toTimeString().split(' ')[0].substring(0, 5)
    const actualCheckOut = new Date().toISOString()

    // Update reservation
    const { error: resError } = await supabase
        .from('reservations')
        .update({ 
            status: 'checked_out',
            check_out_time: checkOutTime,
            check_out_by: user.id,
            actual_check_out: actualCheckOut
        })
        .eq('id', reservationId)
    if (resError) return { success: false, error: resError.message }

    // Set room to dirty/needs cleaning
    if (reservation.room_id) {
        await supabase.from('rooms').update({ status: 'dirty' }).eq('id', reservation.room_id)
    }

    // Close folio and recalculate total
    if (folio) {
        const { data: items } = await supabase
            .from('folio_items')
            .select('amount, vat_amount, service_amount')
            .eq('folio_id', folio.id)
            .eq('is_voided', false)

        const totalAmount = (items || []).reduce((sum, item) => sum + Number(item.amount), 0)
        const totalVat = (items || []).reduce((sum, item) => sum + Number(item.vat_amount || 0), 0)
        const totalService = (items || []).reduce((sum, item) => sum + Number(item.service_amount || 0), 0)
        
        // Get total payments
        const { data: payments } = await supabase
            .from('group_deposits')
            .select('amount')
            .eq('reservation_id', reservationId)
            .eq('status', 'applied')
        
        const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
        const balance = totalAmount - totalPaid

        await supabase.from('folios').update({ 
            total_amount: totalAmount,
            tax_amount: totalVat,
            service_charge: totalService,
            paid_amount: totalPaid,
            balance: balance,
            status: 'closed',
            closed_at: actualCheckOut,
            closed_by: user.id
        }).eq('id', folio.id)
    }

    return { success: true }
}

// ===== Cancel Reservation =====
export async function cancelReservation(reservationId: string): Promise<ActionResponse> {
    const supabase = await createClient()

    const { data: reservation } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single()

    if (!reservation) return { success: false, error: 'Reservation not found' }
    if (['checked_out', 'cancelled'].includes(reservation.status)) {
        return { success: false, error: 'Cannot cancel a completed or already cancelled reservation' }
    }

    const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId)
    if (error) return { success: false, error: error.message }

    // Release room if assigned
    if (reservation.room_id && ['reserved', 'occupied'].includes(reservation.status)) {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', reservation.room_id)
    }

    return { success: true }
}

// ===== Today Stats =====
export async function getTodayStats() {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const [arrivals, departures, revenue] = await Promise.all([
        supabase.from('reservations').select('*', { count: 'exact', head: true })
            .eq('check_in_date', today).in('status', ['reserved']),
        supabase.from('reservations').select('*', { count: 'exact', head: true })
            .eq('check_out_date', today).in('status', ['checked_in']),
        supabase.from('folios').select('total_amount')
            .eq('status', 'closed')
            .gte('updated_at', `${today}T00:00:00`)
            .lte('updated_at', `${today}T23:59:59`),
    ])

    const todayRevenue = (revenue.data || []).reduce((sum, f) => sum + Number(f.total_amount), 0)

    return {
        todayArrivals: arrivals.count || 0,
        todayDepartures: departures.count || 0,
        todayRevenue,
    }
}
