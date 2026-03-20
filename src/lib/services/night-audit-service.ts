import { NightAuditRepository } from '../repositories/night-audit-repo'

export class NightAuditService {
    /**
     * Service wrapper for night audit execution. 
     * Orchestrates any pre-audit or post-audit external API calls (e.g OTA sync).
     */
    static async runDailyAudit(propertyId: string, auditDate: string, userId: string) {
        try {
            // 1. Pre-audit validation (e.g., check if all departures are checked out)
            // Future validation logic here...

            // 2. Execute Night Audit RPC
            const result = await NightAuditRepository.executeNightAudit(propertyId, auditDate, userId)

            // 3. Post-audit tasks (e.g. Email reports, channel manager rate push)
            // Future logic here...

            return result
        } catch (err: any) {
            return { success: false, error: err.message || 'Night audit failed' }
        }
    }

    static async getRecentAudits(propertyId: string) {
        try {
            const audits = await NightAuditRepository.getNightAudits(propertyId)
            return { success: true, data: audits }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }
}
