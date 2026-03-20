'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResponse, Building, PaginatedResponse } from '@/lib/types/database'

const buildingSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(500).default(''),
})

export async function getBuildings(page = 1, pageSize = 10, search = ''): Promise<PaginatedResponse<Building>> {
    const supabase = await createClient()
    let query = supabase.from('buildings').select('*', { count: 'exact' })
    if (search) query = query.ilike('name', `%${search}%`)
    const from = (page - 1) * pageSize
    const { data, count, error } = await query.order('name').range(from, from + pageSize - 1)
    if (error) return { data: [], count: 0, page, pageSize }
    return { data: (data || []) as Building[], count: count || 0, page, pageSize }
}

export async function createBuilding(formData: unknown): Promise<ActionResponse<Building>> {
    const parsed = buildingSchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const { data, error } = await supabase.from('buildings').insert(parsed.data).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Building }
}

export async function updateBuilding(id: string, formData: unknown): Promise<ActionResponse<Building>> {
    const parsed = buildingSchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const { data, error } = await supabase.from('buildings').update(parsed.data).eq('id', id).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Building }
}

export async function deleteBuilding(id: string): Promise<ActionResponse> {
    const supabase = await createClient()
    const { error } = await supabase.from('buildings').delete().eq('id', id)
    if (error) {
        if (error.code === '23503') return { success: false, error: 'Cannot delete: building is in use' }
        return { success: false, error: error.message }
    }
    return { success: true }
}
