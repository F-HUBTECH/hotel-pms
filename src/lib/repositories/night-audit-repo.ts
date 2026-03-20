import { createClient } from '@/lib/supabase/server'
import type { NightAudit } from '@/lib/types/database'

export class NightAuditRepository {
    /**
     * Calls the PostgreSQL RPC function to run night audit transactions securely.
     */
    static async executeNightAudit(propertyId: string, auditDate: string, performedBy: string): Promise<{ success: boolean; id?: string; error?: string }> {
        const supabase = await createClient()
        const { data: auditId, error } = await supabase.rpc('rpc_run_night_audit', {
            p_property_id: propertyId,
            p_audit_date: auditDate,
            p_performed_by: performedBy
        })

        if (error) return { success: false, error: error.message }
        return { success: true, id: auditId }
    }

    static async getNightAudits(propertyId: string, limit = 30): Promise<NightAudit[]> {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('night_audits')
            .select('*, performed_by_user:profiles(first_name, last_name)')
            .eq('property_id', propertyId)
            .order('audit_date', { ascending: false })
            .limit(limit)

        if (error) throw new Error(error.message)
        return data as NightAudit[]
    }
}
