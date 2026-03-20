import { z } from 'zod'

export const housekeepingTaskSchema = z.object({
    room_id: z.string().uuid(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
    assigned_to: z.string().uuid().nullable().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    task_type: z.enum(['cleaning', 'inspection', 'maintenance', 'turndown']).default('cleaning'),
    notes: z.string().optional(),
    scheduled_date: z.string()
})

export type HousekeepingTaskFormValues = z.infer<typeof housekeepingTaskSchema>
