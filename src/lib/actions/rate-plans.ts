'use server'

import { createClient } from '@/lib/supabase/server'
import { ratePlanSchema, seasonalRateSchema, weekdayRateSchema } from '../validators/rate-plan'
import type { RatePlanFormValues, SeasonalRateFormValues, WeekdayRateFormValues } from '../validators/rate-plan'
import { revalidatePath } from 'next/cache'

async function getDefaultPropertyId() {
    const supabase = await createClient()
    const { data } = await supabase.from('properties').select('id').eq('code', 'MAIN').single()
    return data?.id
}

// ==========================================
// RATE PLANS
// ==========================================
export async function getRatePlans(page = 1, pageSize = 10, search = '') {
    const supabase = await createClient()
    const propertyId = await getDefaultPropertyId()

    let query = supabase
        .from('rate_plans')
        .select('*, room_type:room_types(name)', { count: 'exact' })
        .eq('property_id', propertyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (search) {
        query = query.ilike('name', `%${search}%`)
    }

    const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1)

    if (error) return { success: false, error: error.message, data: [], count: 0 }
    return { success: true, data, count: count || 0 }
}

export async function getRatePlanDetails(id: string) {
    const supabase = await createClient()

    const [planRes, seasonalRes, weekdayRes] = await Promise.all([
        supabase.from('rate_plans').select('*, room_type:room_types(*)').eq('id', id).single(),
        supabase.from('seasonal_rates').select('*').eq('rate_plan_id', id).order('start_date', { ascending: true }),
        supabase.from('weekday_rates').select('*').eq('rate_plan_id', id).order('weekday', { ascending: true })
    ])

    if (planRes.error) return { success: false, error: planRes.error.message }

    return {
        success: true,
        data: planRes.data,
        seasonalRates: seasonalRes.data || [],
        weekdayRates: weekdayRes.data || []
    }
}

export async function createRatePlan(data: RatePlanFormValues) {
    try {
        const propertyId = await getDefaultPropertyId()
        const validated = ratePlanSchema.parse(data)
        const supabase = await createClient()

        const { error } = await supabase
            .from('rate_plans')
            .insert([{ ...validated, property_id: propertyId }])

        if (error) throw error
        revalidatePath('/dashboard/master/rate-plans')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateRatePlan(id: string, data: RatePlanFormValues) {
    try {
        const validated = ratePlanSchema.parse(data)
        const supabase = await createClient()

        const { error } = await supabase
            .from('rate_plans')
            .update(validated)
            .eq('id', id)

        if (error) throw error
        revalidatePath(`/dashboard/master/rate-plans/${id}`)
        revalidatePath('/dashboard/master/rate-plans')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ==========================================
// SEASONAL RATES
// ==========================================
export async function addSeasonalRate(data: SeasonalRateFormValues) {
    try {
        const validated = seasonalRateSchema.parse(data)
        const supabase = await createClient()

        const { error } = await supabase.from('seasonal_rates').insert([validated])
        if (error) throw error

        revalidatePath(`/dashboard/master/rate-plans/${data.rate_plan_id}`)
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteSeasonalRate(id: string, planId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('seasonal_rates').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath(`/dashboard/master/rate-plans/${planId}`)
    return { success: true }
}

// ==========================================
// WEEKDAY RATES
// ==========================================
export async function saveWeekdayRate(data: WeekdayRateFormValues) {
    try {
        const validated = weekdayRateSchema.parse(data)
        const supabase = await createClient()

        // Upsert since it's unique by (plan_id, weekday)
        const { error } = await supabase
            .from('weekday_rates')
            .upsert([validated], { onConflict: 'rate_plan_id,weekday' })

        if (error) throw error
        revalidatePath(`/dashboard/master/rate-plans/${data.rate_plan_id}`)
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteWeekdayRate(id: string, planId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('weekday_rates').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath(`/dashboard/master/rate-plans/${planId}`)
    return { success: true }
}

// ==========================================
// RESERVATION CALCULATION HELPERS
// ==========================================
import { RateEngineService } from '../services/rate-engine'
import { RateRepository } from '../repositories/rate-repo'

export async function getActiveRatePlansForRoomType(roomTypeId: string) {
    try {
        const supabase = await createClient()
        const { data: prop } = await supabase.from('properties').select('id').eq('code', 'MAIN').single()
        if (!prop) throw new Error('Property not found')

        const plans = await RateRepository.getRatePlansByRoomType(prop.id, roomTypeId)
        return { success: true, data: plans }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function calculateStayPrice(ratePlanId: string, checkIn: string, checkOut: string) {
    try {
        const supabase = await createClient()
        const { data: plan, error } = await supabase.from('rate_plans').select('*').eq('id', ratePlanId).single()
        if (error || !plan) throw new Error('Rate plan not found')

        const total = await RateEngineService.calculateStayPrice(plan, checkIn, checkOut)

        // Calculate nights 
        const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
        const adr = Math.round(total / nights)

        return { success: true, total, adr, nights }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
