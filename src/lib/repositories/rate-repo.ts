import { createClient } from '@/lib/supabase/server'
import type { RatePlan, SeasonalRate, WeekdayRate } from '@/lib/types/database'

export class RateRepository {
    static async getRatePlansByRoomType(propertyId: string, roomTypeId: string) {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('rate_plans')
            .select('*')
            .eq('property_id', propertyId)
            .eq('room_type_id', roomTypeId)
            .eq('is_active', true)
            .is('deleted_at', null)

        if (error) throw new Error(error.message)
        return data as RatePlan[]
    }

    static async getSeasonalRates(ratePlanId: string, checkIn: string, checkOut: string) {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('seasonal_rates')
            .select('*')
            .eq('rate_plan_id', ratePlanId)
            .lte('start_date', checkOut)
            .gte('end_date', checkIn)
            .order('start_date', { ascending: false })

        if (error) throw new Error(error.message)
        return data as SeasonalRate[]
    }

    static async getWeekdayRates(ratePlanId: string) {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('weekday_rates')
            .select('*')
            .eq('rate_plan_id', ratePlanId)

        if (error) throw new Error(error.message)
        return data as WeekdayRate[]
    }
}
