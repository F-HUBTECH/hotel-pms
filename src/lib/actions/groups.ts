'use server';

import { createClient } from '../supabase/server';
import { revalidatePath } from 'next/cache';

// -- Group Masters --

export async function getGroups(propertyId: string) {
    const supabase = await createClient();
    const { data: groups, error } = await supabase
        .from('groups')
        .select('*')
        .eq('property_id', propertyId)
        .order('arrival_date', { ascending: true });

    if (error) {
        console.error('Error fetching groups:', error);
        throw new Error('Failed to fetch groups');
    }

    return groups;
}

export async function getGroupById(groupId: string) {
    const supabase = await createClient();
    const { data: group, error } = await supabase
        .from('groups')
        .select(`
            *,
            group_blocks (
                id,
                room_type_id,
                room_types (
                    code,
                    name
                ),
                block_date,
                agreed_rooms,
                picked_up_rooms,
                rate
            ),
            reservations!left (
                id,
                check_in_date,
                check_out_date,
                status,
                room_type_id,
                adults,
                children,
                rate,
                guest:guests (
                    first_name,
                    last_name
                )
            )
        `)
        .eq('id', groupId)
        .single();

    if (error) {
        console.error('Error fetching group details:', error);
        throw new Error('Failed to fetch group details');
    }

    return group;
}

export async function createGroup(groupData: any) {
    try {
        const supabase = await createClient();

        const { data: property } = await supabase
            .from('properties')
            .select('id')
            .eq('code', 'MAIN')
            .single();
        
        if (!property) {
            return { success: false, error: 'No property found' };
        }

        const propertyId = property.id;

        const { data: existing } = await supabase
            .from('groups')
            .select('id')
            .eq('property_id', propertyId)
            .eq('code', groupData.code)
            .single();

        if (existing) {
            return { success: false, error: `Group Code ${groupData.code} already exists for this property.` };
        }

        const { data, error } = await supabase
            .from('groups')
            .insert([{ ...groupData, property_id: propertyId }])
            .select()
            .single();

        if (error) {
            console.error('Error creating group:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/dashboard/groups');
        return { success: true, data };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function updateGroup(groupId: string, updates: any) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId)
        .select()
        .single();

    if (error) {
        console.error('Error updating group:', error);
        throw new Error(error.message);
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath('/dashboard/groups');
    return data;
}

// -- Group Blocks (Allotments) --

export async function addGroupBlock(blockData: any) {
    const supabase = await createClient();

    const { data: existing } = await supabase
        .from('group_blocks')
        .select('id, agreed_rooms')
        .eq('group_id', blockData.group_id)
        .eq('room_type_id', blockData.room_type_id)
        .eq('block_date', blockData.block_date)
        .single();

    let result;
    if (existing) {
        const { data, error } = await supabase
            .from('group_blocks')
            .update({ agreed_rooms: blockData.agreed_rooms, rate: blockData.rate })
            .eq('id', existing.id)
            .select()
            .single();
        result = { data, error };
    } else {
        const { data, error } = await supabase
            .from('group_blocks')
            .insert([blockData])
            .select()
            .single();
        result = { data, error };
    }

    if (result.error) {
        console.error('Error creating/updating group block:', result.error);
        throw new Error(result.error.message);
    }

    revalidatePath(`/dashboard/groups/${blockData.group_id}`);
    return result.data;
}

// -- Group Bookings (from KFO bookheader) --

export async function getGroupBookings(groupId: string) {
    const supabase = await createClient();
    const { data: bookings, error } = await supabase
        .from('group_bookings')
        .select(`
            *,
            room_types (
                code,
                name
            )
        `)
        .eq('group_id', groupId)
        .order('arrival_date', { ascending: true });

    if (error) {
        console.error('Error fetching group bookings:', error);
        throw new Error('Failed to fetch group bookings');
    }

    return bookings;
}

export async function getGroupBookingById(bookingId: string) {
    const supabase = await createClient();
    const { data: booking, error } = await supabase
        .from('group_bookings')
        .select(`
            *,
            room_types (
                code,
                name
            ),
            markets (
                name
            ),
            booking_sources (
                name
            )
        `)
        .eq('id', bookingId)
        .single();

    if (error) {
        console.error('Error fetching group booking:', error);
        throw new Error('Failed to fetch group booking');
    }

    return booking;
}

export async function createGroupBooking(bookingData: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('group_bookings')
        .insert([bookingData])
        .select()
        .single();

    if (error) {
        console.error('Error creating group booking:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${bookingData.group_id}`);
    revalidatePath(`/dashboard/groups/${bookingData.group_id}/bookings`);
    return { success: true, data };
}

export async function updateGroupBooking(bookingId: string, updates: any, groupId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('group_bookings')
        .update(updates)
        .eq('id', bookingId)
        .select()
        .single();

    if (error) {
        console.error('Error updating group booking:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/bookings`);
    return { success: true, data };
}

export async function deleteGroupBooking(bookingId: string, groupId: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('group_bookings')
        .delete()
        .eq('id', bookingId);

    if (error) {
        console.error('Error deleting group booking:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/bookings`);
    return { success: true };
}

// -- Group Guests (Rooming List from KFO customer) --

export async function getGroupGuests(groupId: string) {
    const supabase = await createClient();
    const { data: guests, error } = await supabase
        .from('group_guests')
        .select(`
            *,
            rooms (
                room_number
            ),
            room_types (
                code,
                name
            )
        `)
        .eq('group_id', groupId)
        .order('last_name', { ascending: true });

    if (error) {
        console.error('Error fetching group guests:', error);
        throw new Error('Failed to fetch group guests');
    }

    return guests;
}

export async function getGroupGuestById(guestId: string) {
    const supabase = await createClient();
    const { data: guest, error } = await supabase
        .from('group_guests')
        .select(`
            *,
            rooms (
                room_number
            ),
            room_types (
                code,
                name
            )
        `)
        .eq('id', guestId)
        .single();

    if (error) {
        console.error('Error fetching group guest:', error);
        throw new Error('Failed to fetch group guest');
    }

    return guest;
}

export async function addGuestToGroup(guestData: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('group_guests')
        .insert([guestData])
        .select()
        .single();

    if (error) {
        console.error('Error adding guest to group:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${guestData.group_id}`);
    revalidatePath(`/dashboard/groups/${guestData.group_id}/rooming`);
    return { success: true, data };
}

export async function updateGroupGuest(guestId: string, updates: any, groupId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('group_guests')
        .update(updates)
        .eq('id', guestId)
        .select()
        .single();

    if (error) {
        console.error('Error updating group guest:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/rooming`);
    return { success: true, data };
}

export async function deleteGroupGuest(guestId: string, groupId: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('group_guests')
        .delete()
        .eq('id', guestId);

    if (error) {
        console.error('Error deleting group guest:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/rooming`);
    return { success: true };
}

export async function assignRoomToGuest(guestId: string, roomId: string | null, groupId: string) {
    const supabase = await createClient();

    let updates: any = { room_id: roomId };
    
    if (roomId) {
        const { data: room } = await supabase
            .from('rooms')
            .select('room_number')
            .eq('id', roomId)
            .single();
        
        if (room) {
            updates.room_number = room.room_number;
        }
    } else {
        updates.room_number = null;
    }

    const { data, error } = await supabase
        .from('group_guests')
        .update(updates)
        .eq('id', guestId)
        .select()
        .single();

    if (error) {
        console.error('Error assigning room to guest:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/rooming`);
    return { success: true, data };
}

export async function bulkImportGuests(groupId: string, guests: any[]) {
    const supabase = await createClient();

    const guestsWithGroupId = guests.map(g => ({
        ...g,
        group_id: groupId
    }));

    const { data, error } = await supabase
        .from('group_guests')
        .insert(guestsWithGroupId)
        .select();

    if (error) {
        console.error('Error bulk importing guests:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/rooming`);
    return { success: true, data };
}

// -- Check-in Functions --

export async function checkInGroupGuest(guestId: string, groupId: string) {
    const supabase = await createClient();
    
    const now = new Date();
    const checkInDate = now.toISOString().split('T')[0];
    const checkInTime = now.toTimeString().slice(0, 5);

    const { data, error } = await supabase
        .from('group_guests')
        .update({
            status: 'checked_in',
            check_in_date: checkInDate,
            check_in_time: checkInTime
        })
        .eq('id', guestId)
        .select()
        .single();

    if (error) {
        console.error('Error checking in guest:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/checkin`);
    return { success: true, data };
}

export async function checkInGroupAll(groupId: string) {
    const supabase = await createClient();
    
    const now = new Date();
    const checkInDate = now.toISOString().split('T')[0];
    const checkInTime = now.toTimeString().slice(0, 5);

    const { data, error } = await supabase
        .from('group_guests')
        .update({
            status: 'checked_in',
            check_in_date: checkInDate,
            check_in_time: checkInTime
        })
        .eq('group_id', groupId)
        .eq('status', 'confirmed')
        .select();

    if (error) {
        console.error('Error checking in all guests:', error);
        return { success: false, error: error.message };
    }

    // Update group status
    await supabase
        .from('groups')
        .update({ status: 'in_house' })
        .eq('id', groupId);

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/checkin`);
    return { success: true, data };
}

export async function checkInGroupPartial(groupId: string, guestIds: string[]) {
    const supabase = await createClient();
    
    const now = new Date();
    const checkInDate = now.toISOString().split('T')[0];
    const checkInTime = now.toTimeString().slice(0, 5);

    const { data, error } = await supabase
        .from('group_guests')
        .update({
            status: 'checked_in',
            check_in_date: checkInDate,
            check_in_time: checkInTime
        })
        .eq('group_id', groupId)
        .in('id', guestIds)
        .select();

    if (error) {
        console.error('Error checking in partial guests:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/checkin`);
    return { success: true, data };
}

export async function checkOutGroupGuest(guestId: string, groupId: string) {
    const supabase = await createClient();
    
    const now = new Date();
    const checkOutDate = now.toISOString().split('T')[0];
    const checkOutTime = now.toTimeString().slice(0, 5);

    const { data, error } = await supabase
        .from('group_guests')
        .update({
            status: 'checked_out',
            check_out_date: checkOutDate,
            check_out_time: checkOutTime
        })
        .eq('id', guestId)
        .select()
        .single();

    if (error) {
        console.error('Error checking out guest:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/checkin`);
    return { success: true, data };
}

// -- Group Deposits (from KFO depositrev) --

export async function getGroupDeposits(groupId: string) {
    const supabase = await createClient();
    const { data: deposits, error } = await supabase
        .from('group_deposits')
        .select('*')
        .eq('group_id', groupId)
        .order('tran_date', { ascending: false });

    if (error) {
        console.error('Error fetching group deposits:', error);
        throw new Error('Failed to fetch group deposits');
    }

    return deposits;
}

export async function addGroupDeposit(depositData: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('group_deposits')
        .insert([depositData])
        .select()
        .single();

    if (error) {
        console.error('Error adding group deposit:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${depositData.group_id}`);
    revalidatePath(`/dashboard/groups/${depositData.group_id}/deposits`);
    return { success: true, data };
}

export async function transferDepositToFolio(depositId: string, targetGuestId: string, groupId: string) {
    const supabase = await createClient();
    
    const now = new Date();
    const transferDate = now.toISOString().split('T')[0];

    const { data: deposit } = await supabase
        .from('group_deposits')
        .select('*')
        .eq('id', depositId)
        .single();

    if (!deposit) {
        return { success: false, error: 'Deposit not found' };
    }

    const { data, error } = await supabase
        .from('group_deposits')
        .update({
            status: 'transferred',
            transfer_to_guest_id: targetGuestId,
            transfer_date: transferDate
        })
        .eq('id', depositId)
        .select()
        .single();

    if (error) {
        console.error('Error transferring deposit:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/deposits`);
    return { success: true, data };
}

// -- Group Agents/Companies --

export async function getGroupAgents(propertyId: string) {
    const supabase = await createClient();
    const { data: agents, error } = await supabase
        .from('group_agents')
        .select('*')
        .eq('property_id', propertyId)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching group agents:', error);
        throw new Error('Failed to fetch group agents');
    }

    return agents;
}

export async function createGroupAgent(agentData: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('group_agents')
        .insert([agentData])
        .select()
        .single();

    if (error) {
        console.error('Error creating group agent:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/master/agents');
    return { success: true, data };
}

export async function updateGroupAgent(agentId: string, updates: any) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('group_agents')
        .update(updates)
        .eq('id', agentId)
        .select()
        .single();

    if (error) {
        console.error('Error updating group agent:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/master/agents');
    return { success: true, data };
}

// -- Commission Calculation --

export async function calculateGroupCommission(groupId: string) {
    const supabase = await createClient();

    const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

    if (!group) {
        return { success: false, error: 'Group not found' };
    }

    const { data: bookings } = await supabase
        .from('group_bookings')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active');

    let totalRoomRevenue = 0;
    let totalCommission = 0;

    for (const booking of bookings || []) {
        const nights = Math.ceil(
            (new Date(booking.departure_date).getTime() - new Date(booking.arrival_date).getTime()) 
            / (1000 * 60 * 60 * 24)
        );
        const roomRevenue = (booking.rate_amount || 0) * (booking.room_qty || 0) * nights;
        totalRoomRevenue += roomRevenue;
        
        const commission = roomRevenue * ((booking.commission_percent || 0) / 100);
        totalCommission += commission;
    }

    const { data, error } = await supabase
        .from('groups')
        .update({
            commission_amount: totalCommission
        })
        .eq('id', groupId)
        .select()
        .single();

    if (error) {
        console.error('Error calculating commission:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    return { 
        success: true, 
        data: {
            totalRoomRevenue,
            commissionPercent: group.commission_percent,
            commissionAmount: totalCommission
        }
    };
}

// -- Group Services (ABF, Transfer, etc.) --

export async function getGroupServices(groupId: string) {
    const supabase = await createClient();
    const { data: services, error } = await supabase
        .from('group_services')
        .select('*')
        .eq('group_id', groupId)
        .order('service_date', { ascending: true });

    if (error) {
        console.error('Error fetching group services:', error);
        throw new Error('Failed to fetch group services');
    }

    return services;
}

export async function addGroupService(serviceData: any) {
    const supabase = await createClient();

    const totalAmount = (serviceData.price || 0) * (serviceData.quantity || 1);

    const { data, error } = await supabase
        .from('group_services')
        .insert([{ ...serviceData, total_amount: totalAmount }])
        .select()
        .single();

    if (error) {
        console.error('Error adding group service:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${serviceData.group_id}`);
    return { success: true, data };
}

export async function deleteGroupService(serviceId: string, groupId: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('group_services')
        .delete()
        .eq('id', serviceId);

    if (error) {
        console.error('Error deleting group service:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    return { success: true };
}

// -- Group Master Folio --

export async function getGroupMasterFolio(groupId: string) {
    const supabase = await createClient();

    let { data: folio, error: folioError } = await supabase
        .from('folios')
        .select('*')
        .eq('group_id', groupId)
        .is('reservation_id', null)
        .single();

    if (folioError && folioError.code === 'PGRST116') {
        const { data: group } = await supabase.from('groups').select('property_id').eq('id', groupId).single();
        if (!group) throw new Error('Group not found');

        const { data: newFolio, error: insertError } = await supabase
            .from('folios')
            .insert([{
                group_id: groupId,
                property_id: group.property_id,
                status: 'open',
                balance: 0
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Error creating Master Folio:', insertError);
            throw new Error('Failed to create Master Folio: ' + insertError.message);
        }
        folio = newFolio;
    } else if (folioError) {
        throw new Error('Failed to fetch Master Folio');
    }

    const { data: transactions, error: txError } = await supabase
        .from('folio_transactions')
        .select('*')
        .eq('folio_id', folio.id)
        .order('created_at', { ascending: false });

    return {
        ...folio,
        transactions: transactions || []
    };
}

export async function postGroupCharge(groupId: string, chargeData: any) {
    const supabase = await createClient();

    const folio = await getGroupMasterFolio(groupId);

    const { data: transaction, error } = await supabase
        .from('folio_transactions')
        .insert([{
            folio_id: folio.id,
            type: 'charge',
            description: chargeData.description,
            amount: chargeData.amount,
            item_date: chargeData.item_date || new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

    if (error) {
        console.error('Error posting group charge:', error);
        return { success: false, error: error.message };
    }

    // Update folio balance
    const newBalance = (folio.balance || 0) + chargeData.amount;
    await supabase
        .from('folios')
        .update({ balance: newBalance })
        .eq('id', folio.id);

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/folio`);
    return { success: true, data: transaction };
}

export async function postGroupPayment(groupId: string, paymentData: any) {
    const supabase = await createClient();

    const folio = await getGroupMasterFolio(groupId);

    const { data: transaction, error } = await supabase
        .from('folio_transactions')
        .insert([{
            folio_id: folio.id,
            type: 'payment',
            description: paymentData.description || 'Payment',
            amount: paymentData.amount,
            item_date: paymentData.item_date || new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

    if (error) {
        console.error('Error posting group payment:', error);
        return { success: false, error: error.message };
    }

    // Update folio balance
    const newBalance = (folio.balance || 0) - paymentData.amount;
    await supabase
        .from('folios')
        .update({ balance: newBalance })
        .eq('id', folio.id);

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/folio`);
    return { success: true, data: transaction };
}

// -- Bulk Operations --

export async function generateRoomingList(groupId: string) {
    const supabase = await createClient();

    const { data: bookings } = await supabase
        .from('group_bookings')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active');

    const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

    if (!group) {
        return { success: false, error: 'Group not found' };
    }

    const guestsToInsert = [];

    for (const booking of bookings || []) {
        const nights = Math.ceil(
            (new Date(booking.departure_date).getTime() - new Date(booking.arrival_date).getTime()) 
            / (1000 * 60 * 60 * 24)
        );

        for (let i = 0; i < booking.room_qty; i++) {
            guestsToInsert.push({
                group_id: groupId,
                group_booking_id: booking.id,
                room_type_id: booking.room_type_id,
                arrival_date: booking.arrival_date,
                departure_date: booking.departure_date,
                room_nights: nights,
                pax_adult: Math.ceil((booking.pax_adult || 1) / (booking.room_qty || 1)),
                pax_child: Math.ceil((booking.pax_child || 0) / (booking.room_qty || 1)),
                rate_amount: booking.rate_amount,
                rate_code: booking.rate_code,
                status: 'pending'
            });
        }
    }

    if (guestsToInsert.length > 0) {
        const { error } = await supabase
            .from('group_guests')
            .insert(guestsToInsert);

        if (error) {
            console.error('Error generating rooming list:', error);
            return { success: false, error: error.message };
        }
    }

    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath(`/dashboard/groups/${groupId}/rooming`);
    return { success: true, count: guestsToInsert.length };
}

// -- Summary Data --

export async function getGroupSummary(groupId: string) {
    const supabase = await createClient();

    const [group, bookings, guests, deposits] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase.from('group_bookings').select('*').eq('group_id', groupId),
        supabase.from('group_guests').select('*').eq('group_id', groupId),
        supabase.from('group_deposits').select('*').eq('group_id', groupId)
    ]);

    const bookingsData = bookings.data || [];
    const guestsData = guests.data || [];
    const depositsData = deposits.data || [];

    const summary = {
        group: group.data,
        bookings: {
            total: bookingsData.length,
            active: bookingsData.filter(b => b.status === 'active').length,
            cancelled: bookingsData.filter(b => b.status === 'cancelled').length,
            checkedIn: bookingsData.filter(b => b.status === 'checked_in').length,
            totalRooms: bookingsData.reduce((sum, b) => sum + (b.room_qty || 0), 0),
            totalPax: bookingsData.reduce((sum, b) => sum + (b.pax_adult || 0) + (b.pax_child || 0), 0),
            totalRevenue: bookingsData.reduce((sum, b) => {
                const nights = Math.ceil(
                    (new Date(b.departure_date).getTime() - new Date(b.arrival_date).getTime()) 
                    / (1000 * 60 * 60 * 24)
                );
                return sum + ((b.rate_amount || 0) * (b.room_qty || 0) * nights);
            }, 0)
        },
        guests: {
            total: guestsData.length,
            pending: guestsData.filter(g => g.status === 'pending').length,
            confirmed: guestsData.filter(g => g.status === 'confirmed').length,
            checkedIn: guestsData.filter(g => g.status === 'checked_in').length,
            checkedOut: guestsData.filter(g => g.status === 'checked_out').length,
            cancelled: guestsData.filter(g => g.status === 'cancelled').length,
            assignedRooms: guestsData.filter(g => g.room_id).length
        },
        deposits: {
            total: depositsData.length,
            pending: depositsData.filter(d => d.status === 'pending').length,
            applied: depositsData.filter(d => d.status === 'applied').length,
            transferred: depositsData.filter(d => d.status === 'transferred').length,
            totalAmount: depositsData.reduce((sum, d) => sum + (d.amount || 0), 0)
        }
    };

    return summary;
}
