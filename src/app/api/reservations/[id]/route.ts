import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const result = updateSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.issues },
        { status: 400 }
      )
    }
    
    const { check_in_date, check_out_date } = result.data
    
    // Validate dates
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    
    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      )
    }
    
    // Get current reservation
    const { data: currentRes, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !currentRes) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    
    // Check for conflicts with other reservations in the same room
    const { data: conflicts, error: conflictError } = await supabase
      .from('reservations')
      .select('*')
      .eq('room_id', currentRes.room_id)
      .neq('id', id)
      .in('status', ['reserved', 'checked_in'])
      .or(`check_in_date.lt.${check_out_date},check_out_date.gt.${check_in_date}`)
    
    if (conflictError) {
      console.error('Conflict check error:', conflictError)
    }
    
    // Filter actual overlaps
    const hasOverlap = conflicts?.some(r => {
      const rCheckIn = new Date(r.check_in_date)
      const rCheckOut = new Date(r.check_out_date)
      return !(rCheckOut <= checkIn || rCheckIn >= checkOut)
    })
    
    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Date range conflicts with existing reservation' },
        { status: 409 }
      )
    }
    
    // Update reservation
    const { data, error } = await supabase
      .from('reservations')
      .update({
        check_in_date,
        check_out_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Update error:', error)
      return NextResponse.json(
        { error: 'Failed to update reservation' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, data })
    
  } catch (error) {
    console.error('PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
