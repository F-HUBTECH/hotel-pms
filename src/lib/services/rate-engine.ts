import { RateRepository } from '../repositories/rate-repo'
import type { RatePlan } from '@/lib/types/database'

export class RateEngineService {
    /**
     * Calculate the total price for a stay based on dynamic rates.
     * Logic: Seasonal Rate > Weekday Rate > Base Price
     */
    static async calculateStayPrice(ratePlan: RatePlan, checkIn: string, checkOut: string): Promise<number> {
        const seasonalRates = await RateRepository.getSeasonalRates(ratePlan.id, checkIn, checkOut)
        const weekdayRates = await RateRepository.getWeekdayRates(ratePlan.id)

        let totalPrice = 0
        let currentDate = new Date(checkIn)
        const end = new Date(checkOut)

        while (currentDate < end) {
            const dateStr = currentDate.toISOString().split('T')[0]
            const weekday = currentDate.getDay() // 0 = Sunday, 6 = Saturday
            let nightlyPrice = ratePlan.base_price

            // 1. Check Seasonal Rate match (Highest priority)
            const matchingSeasonal = seasonalRates.find(
                (sr) => dateStr >= sr.start_date && dateStr <= sr.end_date
            )

            if (matchingSeasonal) {
                nightlyPrice = matchingSeasonal.price
            } else {
                // 2. Check Weekday Rate match (Second priority)
                const matchingWeekday = weekdayRates.find((wr) => wr.weekday === weekday)
                if (matchingWeekday) {
                    nightlyPrice = matchingWeekday.price
                }
            }

            totalPrice += Number(nightlyPrice)
            currentDate.setDate(currentDate.getDate() + 1)
        }

        return totalPrice
    }
}
