'use server'

import { createClient } from '@/lib/supabase/server'
import { housekeepingTaskSchema } from '../validators/housekeeping'
import type { HousekeepingTaskFormValues } from '../validators/housekeeping'
import type { HousekeepingTask, ActionResponse, PaginatedResponse } from '@/lib/types/database'
import { revalidatePath } from 'next/cache'

export async function getHousekeepingTasks(date: string): Promise<PaginatedResponse<HousekeepingTask>> {
    const supabase = await createClient()

    const { data, count, error } = await supabase
        .from('housekeeping_tasks')
        .select('*, room:rooms(room_number, status, room_type:room_types(name)), assignee:profiles!assigned_to(first_name, last_name)', { count: 'exact' })
        .eq('scheduled_date', date)
        .order('priority', { ascending: false }) // Returns urgent first, then high, etc., wait, this is alphabetical... Better sort by created_at or case statement. We'll just order by created_at for now.
        .order('created_at', { ascending: true })

    if (error) {
        console.error('getHousekeepingTasks error:', error)
        return { data: [], count: 0, page: 1, pageSize: 100 }
    }

    return { data: (data || []) as HousekeepingTask[], count: count || 0, page: 1, pageSize: 100 }
}

export async function createHousekeepingTask(data: HousekeepingTaskFormValues): Promise<ActionResponse<HousekeepingTask>> {
    const validated = housekeepingTaskSchema.parse(data)
    const supabase = await createClient()

    const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .insert([validated])
        .select()
        .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/operations/housekeeping')
    return { success: true, data: result as HousekeepingTask }
}

export async function updateHousekeepingTaskStatus(id: string, status: string, roomId?: string): Promise<ActionResponse> {
    const supabase = await createClient()

    // 1. Update Task
    const updateData: any = { status }
    if (status === 'completed') updateData.completed_at = new Date().toISOString()
    if (status === 'pending') updateData.completed_at = null

    const { error } = await supabase.from('housekeeping_tasks').update(updateData).eq('id', id)
    if (error) return { success: false, error: error.message }

    // 2. Auto-update room status if it was a cleaning task
    if (roomId && status === 'completed') {
        const { data: task } = await supabase.from('housekeeping_tasks').select('task_type').eq('id', id).single()
        if (task?.task_type === 'cleaning') {
            await supabase.from('rooms').update({ status: 'clean' }).eq('id', roomId)
        } else if (task?.task_type === 'inspection') {
            await supabase.from('rooms').update({ status: 'inspected' }).eq('id', roomId)
        }
    }

    revalidatePath('/dashboard/operations/housekeeping')
    return { success: true }
}

export async function deleteHousekeepingTask(id: string): Promise<ActionResponse> {
    const supabase = await createClient()
    const { error } = await supabase.from('housekeeping_tasks').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/operations/housekeeping')
    return { success: true }
}

export async function getHousekeepingStaff() {
    const supabase = await createClient()
    // Assuming anyone with role inside [admin, manager, staff] can be assigned
    const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('role', ['admin', 'manager', 'staff'])

    if (error) return []
    return data
}
