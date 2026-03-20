import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint receives reservations pushed from an OTA or Channel Manager
// We use the service role key to bypass RLS since this is a server-to-server call.
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Requires the service role key for webhook
)

export async function POST(req: Request) {
    try {
        // 1. Basic Token Auth (You would use standard HMAC or Bearer tokens in production)
        const authHeader = req.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.OTA_WEBHOOK_SECRET || 'ota-secret-key'}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await req.json()
        const { ota_id, channel_manager, property_code, guest, reservation } = payload

        if (!ota_id || !property_code || !guest || !reservation) {
            return NextResponse.json({ error: 'Invalid payload schema' }, { status: 400 })
        }

        // 2. Resolve Property & Room Type Context
        const { data: property } = await supabase.from('properties').select('id').eq('code', property_code).single()
        if (!property) return NextResponse.json({ error: 'Unknown property code' }, { status: 404 })

        const { data: roomType } = await supabase.from('room_types').select('id').eq('code', reservation.room_type_code).single()
        if (!roomType) return NextResponse.json({ error: 'Unknown room type code' }, { status: 404 })

        // 3. Resolve or Create Guest
        let guestId: string
        const { data: existingGuest } = await supabase
            .from('guests')
            .select('id')
            .eq('email', guest.email || '')
            .maybeSingle()

        if (existingGuest) {
            guestId = existingGuest.id
        } else {
            const { data: newGuest, error: guestErr } = await supabase.from('guests').insert({
                first_name: guest.first_name,
                last_name: guest.last_name,
                email: guest.email,
                phone: guest.phone,
                id_type: 'passport',
                id_number: 'N/A'
            }).select('id').single()

            if (guestErr || !newGuest) throw new Error(`Guest creation failed: ${guestErr?.message}`)
            guestId = newGuest.id
        }

        // 4. Record Channel Payload (Idempotency check)
        const { data: existingChannelRes } = await supabase.from('channel_reservations').select('id').eq('ota_reservation_id', ota_id).maybeSingle()
        if (existingChannelRes) {
            return NextResponse.json({ message: 'Reservation already processed', ota_id }, { status: 200 })
        }

        // Insert Raw Payload
        await supabase.from('channel_reservations').insert({
            property_id: property.id,
            channel_name: channel_manager || 'OTA',
            ota_reservation_id: ota_id,
            raw_payload: payload,
            status: 'pending'
        })

        // 5. Create Core Reservation using RPC (Handles inventory updates transactionally)
        // We assume p_user_id is null since it's an automated webhook
        const { data: resData, error: rpcErr } = await supabase.rpc('rpc_create_reservation', {
            p_guest_id: guestId,
            p_room_id: null, // Unassigned room
            p_room_type_id: roomType.id,
            p_rate_plan_id: null, // Basic rate plan mapping can be added here
            p_check_in: reservation.check_in,
            p_check_out: reservation.check_out,
            p_adults: reservation.adults || 2,
            p_children: reservation.children || 0,
            p_rate: reservation.rate || 0,
            p_status: 'reserved',
            p_source_id: null,
            p_market_id: null,
            p_notes: `OTA Ref: ${ota_id} | ${reservation.notes || ''}`,
            p_user_id: null
        })

        if (rpcErr) {
            // Mark channel record as failed
            await supabase.from('channel_reservations').update({ status: 'failed', error_message: rpcErr.message }).eq('ota_reservation_id', ota_id)
            throw new Error(`Reservation creation failed: ${rpcErr.message}`)
        }

        // Mark channel record as mapped
        await supabase.from('channel_reservations').update({
            status: 'mapped',
            pms_reservation_id: resData.id
        }).eq('ota_reservation_id', ota_id)

        return NextResponse.json({
            success: true,
            message: 'Reservation created via OTA webhook',
            pms_reservation_id: resData.reservation_number
        }, { status: 201 })

    } catch (err: any) {
        console.error('OTA Webhook Error:', err)
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 })
    }
}
