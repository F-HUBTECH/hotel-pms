'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActionResponse, FloorPlan, PaginatedResponse } from '@/lib/types/database'

const floorPlanSchema = z.object({
    building_id: z.string().uuid('Invalid building'),
    name: z.string().min(1, 'Name is required').max(100),
})

export async function getFloorPlans(page = 1, pageSize = 10, search = ''): Promise<PaginatedResponse<FloorPlan>> {
    const supabase = await createClient()
    let query = supabase.from('floor_plans').select('*, building:buildings(id, name)', { count: 'exact' })
    if (search) query = query.ilike('name', `%${search}%`)
    const from = (page - 1) * pageSize
    const { data, count, error } = await query.order('name').range(from, from + pageSize - 1)
    if (error) return { data: [], count: 0, page, pageSize }
    return { data: (data || []) as FloorPlan[], count: count || 0, page, pageSize }
}

export async function createFloorPlan(formData: unknown): Promise<ActionResponse<FloorPlan>> {
    const parsed = floorPlanSchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const { data, error } = await supabase.from('floor_plans').insert(parsed.data).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as FloorPlan }
}

export async function updateFloorPlan(id: string, formData: unknown): Promise<ActionResponse<FloorPlan>> {
    const parsed = floorPlanSchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const { data, error } = await supabase.from('floor_plans').update(parsed.data).eq('id', id).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as FloorPlan }
}

export async function deleteFloorPlan(id: string): Promise<ActionResponse> {
    const supabase = await createClient()
    const { error } = await supabase.from('floor_plans').delete().eq('id', id)
    if (error) {
        if (error.code === '23503') return { success: false, error: 'Cannot delete: floor plan is in use' }
        return { success: false, error: error.message }
    }
    return { success: true }
}
