'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResponse, NamedEntity, PaginatedResponse } from '@/lib/types/database'

// Whitelist of tables allowed for generic CRUD operations
// Prevents table name injection from client
const ALLOWED_TABLES = new Set([
    'booking_sources',
    'channels',
    'departments',
    'folio_groups',
    'guest_types',
    'market_groups',
    'markets',
    'nationalities',
    'passport_types',
    'special_services',
    'user_groups',
    'visa_types',
    'zone_codes',
])

function validateTable(table: string): void {
    if (!ALLOWED_TABLES.has(table)) {
        throw new Error(`Table "${table}" is not allowed for generic CRUD operations`)
    }
}

import { namedEntitySchema } from '@/lib/validators/generic-crud-schema'

export async function getNamedEntities(
    table: string,
    page = 1,
    pageSize = 10,
    search = ''
): Promise<PaginatedResponse<NamedEntity>> {
    validateTable(table)
    const supabase = await createClient()
    let query = supabase.from(table).select('*', { count: 'exact' })
    if (search) query = query.ilike('name', `%${search}%`)
    const from = (page - 1) * pageSize
    const { data, count, error } = await query.order('name').range(from, from + pageSize - 1)
    if (error) return { data: [], count: 0, page, pageSize }
    return { data: (data || []) as NamedEntity[], count: count || 0, page, pageSize }
}

export async function createNamedEntity(
    table: string,
    formData: unknown
): Promise<ActionResponse<NamedEntity>> {
    validateTable(table)
    const parsed = namedEntitySchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const { data, error } = await supabase.from(table).insert(parsed.data).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as NamedEntity }
}

export async function updateNamedEntity(
    table: string,
    id: string,
    formData: unknown
): Promise<ActionResponse<NamedEntity>> {
    validateTable(table)
    const parsed = namedEntitySchema.safeParse(formData)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const supabase = await createClient()
    const { data, error } = await supabase.from(table).update(parsed.data).eq('id', id).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as NamedEntity }
}

export async function deleteNamedEntity(
    table: string,
    id: string
): Promise<ActionResponse> {
    validateTable(table)
    const supabase = await createClient()
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
        if (error.code === '23503') return { success: false, error: 'Cannot delete: item is in use' }
        return { success: false, error: error.message }
    }
    return { success: true }
}
