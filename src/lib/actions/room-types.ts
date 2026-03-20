'use server'

import { createClient } from '@/lib/supabase/server'
import { roomTypeSchema } from '@/lib/validations/room-types'
import type { ActionResponse, RoomType, PaginatedResponse } from '@/lib/types/database'

export async function getRoomTypes(
    page: number = 1,
    pageSize: number = 10,
    search: string = ''
): Promise<PaginatedResponse<RoomType>> {
    const supabase = await createClient()

    let query = supabase.from('room_types').select('*', { count: 'exact' })

    if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query
        .order('code', { ascending: true })
        .range(from, to)

    if (error) {
        console.error('getRoomTypes error:', error)
        return { data: [], count: 0, page, pageSize }
    }

    return {
        data: (data || []) as RoomType[],
        count: count || 0,
        page,
        pageSize,
    }
}

export async function createRoomType(
    formData: unknown
): Promise<ActionResponse<RoomType>> {
    const parsed = roomTypeSchema.safeParse(formData)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('room_types')
        .insert(parsed.data)
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'A room type with this code already exists' }
        }
        return { success: false, error: error.message }
    }

    return { success: true, data: data as RoomType }
}

export async function updateRoomType(
    id: string,
    formData: unknown
): Promise<ActionResponse<RoomType>> {
    const parsed = roomTypeSchema.safeParse(formData)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('room_types')
        .update(parsed.data)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'A room type with this code already exists' }
        }
        return { success: false, error: error.message }
    }

    return { success: true, data: data as RoomType }
}

export async function deleteRoomType(id: string): Promise<ActionResponse> {
    const supabase = await createClient()
    const { error } = await supabase
        .from('room_types')
        .delete()
        .eq('id', id)

    if (error) {
        if (error.code === '23503') {
            return { success: false, error: 'Cannot delete: this room type is in use by rooms' }
        }
        return { success: false, error: error.message }
    }

    return { success: true }
}
