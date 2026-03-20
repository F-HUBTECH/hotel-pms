'use server'

import { createClient } from '@/lib/supabase/server'
import { UserRole } from '@/lib/types/database'
import { revalidatePath } from 'next/cache'

export async function updateUserRole(userId: string, newRole: UserRole) {
    const supabase = await createClient()

    // 1. Verify caller is super_admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (callerProfile?.role !== 'super_admin') {
        return { success: false, error: 'Insufficient permissions. Only Super Admins can change roles.' }
    }

    // 2. Perform Update
    const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

    if (error) {
        console.error('Error updating user role:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/master/user-groups')
    return { success: true }
}
