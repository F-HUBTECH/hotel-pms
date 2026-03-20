import { z } from 'zod'

export const ratePlanSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    room_type_id: z.string().uuid('Invalid room type selected'),
    base_price: z.coerce.number().min(0, 'Price cannot be negative'),
    refundable: z.boolean().default(true),
    cancellation_policy: z.string().optional(),
    is_active: z.boolean().default(true),
})

export type RatePlanFormValues = z.infer<typeof ratePlanSchema>

export const seasonalRateSchema = z.object({
    rate_plan_id: z.string().uuid(),
    start_date: z.string(),
    end_date: z.string(),
    price: z.coerce.number().min(0),
}).refine(data => new Date(data.end_date) >= new Date(data.start_date), {
    message: 'End date must be after start date',
    path: ['end_date'],
})

export type SeasonalRateFormValues = z.infer<typeof seasonalRateSchema>

export const weekdayRateSchema = z.object({
    rate_plan_id: z.string().uuid(),
    weekday: z.coerce.number().min(0).max(6),
    price: z.coerce.number().min(0),
})

export type WeekdayRateFormValues = z.infer<typeof weekdayRateSchema>
