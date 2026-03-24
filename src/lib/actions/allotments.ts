'use server';

import { createClient } from '../supabase/server';
import { revalidatePath } from 'next/cache';

export type ActionResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};

// -- Corporate Allotments --

export async function getCorporateAllotments() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('corporate_allotments')
        .select('*')
        .eq('is_active', true)
        .order('allot_code');

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

export async function getCorporateAllotmentById(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('corporate_allotments')
        .select('*, allotment_room_types(*, room_type:room_types(*))')
        .eq('id', id)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

export async function createCorporateAllotment(allotData: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('corporate_allotments')
        .insert([allotData])
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    // Initialize daily allotments if dates and rooms provided
    if (allotData.valid_from && allotData.valid_to && allotData.room_type_id) {
        await initializeAllotmentDaily(data.id, allotData.room_type_id, allotData.valid_from, allotData.valid_to, 0);
    }

    revalidatePath('/dashboard/master/allotments');
    return { success: true, data };
}

export async function updateCorporateAllotment(id: string, updates: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('corporate_allotments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return { success: false, error: error.message };
    revalidatePath('/dashboard/master/allotments');
    return { success: true, data };
}

export async function deleteCorporateAllotment(id: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('corporate_allotments')
        .update({ is_active: false })
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/dashboard/master/allotments');
    return { success: true };
}

// -- Allotment Room Types --

export async function addAllotmentRoomType(allotmentId: string, roomTypeData: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('allotment_room_types')
        .insert([{ ...roomTypeData, allotment_id: allotmentId }])
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    // Initialize daily allotments for this room type
    const allot = await supabase.from('corporate_allotments').select('valid_from, valid_to').eq('id', allotmentId).single();
    if (allot.data) {
        await initializeAllotmentDaily(allotmentId, roomTypeData.room_type_id, allot.data.valid_from, allot.data.valid_to, roomTypeData.agreed_rooms);
    }

    revalidatePath('/dashboard/master/allotments');
    return { success: true, data };
}

export async function updateAllotmentRoomType(id: string, updates: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('allotment_room_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return { success: false, error: error.message };
    revalidatePath('/dashboard/master/allotments');
    return { success: true, data };
}

export async function deleteAllotmentRoomType(id: string) {
    const supabase = await createClient();

    // Get the allotment_room_type first
    const { data: art } = await supabase
        .from('allotment_room_types')
        .select('allotment_id, room_type_id')
        .eq('id', id)
        .single();

    const { error } = await supabase
        .from('allotment_room_types')
        .delete()
        .eq('id', id);

    if (error) return { success: false, error: error.message };

    // Clean up daily allotments
    if (art) {
        await supabase
            .from('allotment_daily')
            .delete()
            .eq('allotment_id', art.allotment_id)
            .eq('room_type_id', art.room_type_id);
    }

    revalidatePath('/dashboard/master/allotments');
    return { success: true };
}

// -- Daily Allotments --

export async function getAllotmentDaily(allotmentId: string, fromDate: string, toDate: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('allotment_daily')
        .select('*, room_type:room_types(*)')
        .eq('allotment_id', allotmentId)
        .gte('allott_date', fromDate)
        .lte('allott_date', toDate)
        .order('allott_date');

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

export async function getAllotmentAvailability(roomTypeId: string, fromDate: string, toDate: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('allotment_daily')
        .select(`
            *,
            allotment:corporate_allotments(id, allot_code, company_name, valid_from, valid_to)
        `)
        .eq('room_type_id', roomTypeId)
        .gte('allott_date', fromDate)
        .lte('allott_date', toDate)
        .gt('available_rooms', 0)
        .order('allott_date');

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

export async function updateAllotmentDaily(id: string, updates: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('allotment_daily')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

async function initializeAllotmentDaily(
    allotmentId: string,
    roomTypeId: string,
    fromDate: string,
    toDate: string,
    agreedRooms: number
) {
    const supabase = await createClient();

    // Generate date series and insert/update daily records
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    const dates: { date: string; allotment_id: string; room_type_id: string; total_rooms: number }[] = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        dates.push({
            date: currentDate.toISOString().split('T')[0],
            allotment_id: allotmentId,
            room_type_id: roomTypeId,
            total_rooms: agreedRooms
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Use RPC or bulk insert
    const { error } = await supabase.from('allotment_daily').upsert(dates, {
        onConflict: 'allotment_id,room_type_id,allott_date'
    });

    return { success: !error, error: error?.message };
}

export async function syncAllotmentDaily(allotmentId: string, roomTypeId: string, fromDate: string, toDate: string, agreedRooms: number) {
    return initializeAllotmentDaily(allotmentId, roomTypeId, fromDate, toDate, agreedRooms);
}

// -- Pickups --

export async function pickFromAllotment(
    allotmentId: string,
    reservationId: string,
    roomTypeId: string,
    pickupDate: string,
    rooms: number,
    rate: number
) {
    const supabase = await createClient();

    // Start transaction
    const { data: pickup, error: pickupError } = await supabase
        .from('allotment_pickups')
        .insert([{
            allotment_id: allotmentId,
            reservation_id: reservationId,
            room_type_id: roomTypeId,
            pickup_date: pickupDate,
            rooms_picked: rooms,
            rate: rate,
            status: 'picked'
        }])
        .select()
        .single();

    if (pickupError) return { success: false, error: pickupError.message };

    // Update daily allotment used_rooms
    const { error: dailyError } = await supabase.rpc('increment_allotment_used', {
        p_allotment_id: allotmentId,
        p_room_type_id: roomTypeId,
        p_date: pickupDate,
        p_rooms: rooms
    });

    if (dailyError) {
        // Rollback pickup
        await supabase.from('allotment_pickups').delete().eq('id', pickup.id);
        return { success: false, error: dailyError.message };
    }

    revalidatePath('/dashboard/master/allotments');
    return { success: true, data: pickup };
}

export async function cancelAllotmentPickup(pickupId: string) {
    const supabase = await createClient();

    // Get pickup details first
    const { data: pickup } = await supabase
        .from('allotment_pickups')
        .select('*')
        .eq('id', pickupId)
        .single();

    if (!pickup) return { success: false, error: 'Pickup not found' };

    // Update pickup status
    const { error: updateError } = await supabase
        .from('allotment_pickups')
        .update({ status: 'cancelled' })
        .eq('id', pickupId);

    if (updateError) return { success: false, error: updateError.message };

    // Decrement daily allotment used_rooms
    await supabase.rpc('decrement_allotment_used', {
        p_allotment_id: pickup.allotment_id,
        p_room_type_id: pickup.room_type_id,
        p_date: pickup.pickup_date,
        p_rooms: pickup.rooms_picked
    });

    revalidatePath('/dashboard/master/allotments');
    return { success: true };
}

export async function getAllotmentPickups(reservationId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('allotment_pickups')
        .select('*, allotment:corporate_allotments(*), room_type:room_types(*)')
        .eq('reservation_id', reservationId);

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

// -- Check Availability --

export async function checkAllotmentAvailability(
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
    rooms: number = 1
) {
    const supabase = await createClient();

    // Get all daily records for the date range
    const { data: dailyData, error } = await supabase
        .from('allotment_daily')
        .select(`
            *,
            allotment:corporate_allotments(id, allot_code, company_name, is_active, valid_from, valid_to)
        `)
        .eq('room_type_id', roomTypeId)
        .lte('allott_date', checkOut)
        .gte('allott_date', checkIn)
        .order('allott_date');

    if (error) return { success: false, error: error.message };

    // Filter to only active allotments and calculate availability
    const allotments: Record<string, {
        allotment_id: string;
        allot_code: string;
        company_name: string;
        min_available: number;
        daily: any[];
    }> = {};

    for (const day of dailyData || []) {
        if (!day.allotment?.is_active) continue;

        const allottId = day.allotment_id;
        if (!allotments[allottId]) {
            allotments[allottId] = {
                allotment_id: allottId,
                allot_code: day.allotment.allot_code,
                company_name: day.allotment.company_name,
                min_available: day.available_rooms,
                daily: []
            };
        }
        allotments[allottId].daily.push(day);
        allotments[allottId].min_available = Math.min(
            allotments[allottId].min_available,
            day.available_rooms
        );
    }

    // Filter to only those with enough availability for all days
    const available = Object.values(allotments)
        .filter(a => a.min_available >= rooms)
        .map(a => ({
            ...a,
            total_days: a.daily.length
        }));

    return { success: true, data: available };
}
