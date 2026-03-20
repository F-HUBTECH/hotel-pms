import { createClient } from '../supabase/server'

export interface ForecastSummary {
    property_id: string
    forecast_date: string
    total_rooms: number
    expected_occupancy: number
    expected_revenue: number
    occupancy_percentage: number
    adr: number
    revpar: number
}

export class ForecastService {
    /**
     * Get the forecast for a specific property over a number of days.
     * The SQL view `forecast_summary_view` calculates expected occupancy based on
     * actual booked reservations vs historical rolling averages.
     */
    static async getForecast(propertyId: string, days: number = 30): Promise<{ success: boolean; data?: ForecastSummary[]; error?: string }> {
        try {
            const supabase = await createClient()

            // Fetch the view data
            const { data, error } = await supabase
                .from('forecast_summary_view')
                .select('*')
                .eq('property_id', propertyId)
                .order('forecast_date', { ascending: true })
                .limit(days)

            if (error) throw error

            // Map and calculate derived KPI metrics
            const forecastData: ForecastSummary[] = (data || []).map((row: any) => {
                const occ = row.total_rooms > 0
                    ? Math.round((row.expected_occupancy / row.total_rooms) * 100)
                    : 0

                const adr = row.expected_occupancy > 0
                    ? Math.round(row.expected_revenue / row.expected_occupancy)
                    : 0

                const revpar = row.total_rooms > 0
                    ? Math.round(row.expected_revenue / row.total_rooms)
                    : 0

                return {
                    property_id: row.property_id,
                    forecast_date: row.forecast_date,
                    total_rooms: row.total_rooms,
                    expected_occupancy: row.expected_occupancy,
                    expected_revenue: row.expected_revenue,
                    occupancy_percentage: occ,
                    adr: adr,
                    revpar: revpar
                }
            })

            return { success: true, data: forecastData }
        } catch (err: any) {
            console.error('ForecastService.getForecast error:', err)
            return { success: false, error: err.message }
        }
    }
}
