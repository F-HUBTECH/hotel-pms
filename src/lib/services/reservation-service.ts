import { ReservationRepository, CreateReservationDTO } from '../repositories/reservation-repo'
import { RateEngineService } from './rate-engine'
import type { RatePlan } from '@/lib/types/database'

/** Calculate Average Daily Rate from total stay price */
export function calculateAverageDailyRate(totalPrice: number, nights: number): number {
    return nights > 0 ? Math.round(totalPrice / nights) : totalPrice
}

export class ReservationService {
    /**
     * Orchestrates rate calculation and transactional reservation creation.
     */
    static async bookReservation(data: CreateReservationDTO, ratePlan?: RatePlan) {
        try {
            // 1. Calculate dynamic rate if ratePlan is provided, else use static rate
            let finalRate = data.rate
            if (ratePlan && finalRate === 0) {
                const total = await RateEngineService.calculateStayPrice(ratePlan, data.check_in_date, data.check_out_date)
                const nights = Math.ceil((new Date(data.check_out_date).getTime() - new Date(data.check_in_date).getTime()) / 86400000)
                finalRate = calculateAverageDailyRate(total, nights)
            }

            // 2. Execute transactional creation
            const result = await ReservationRepository.createReservationWithTransaction({
                ...data,
                rate: finalRate
            })

            if ('error' in result) {
                return { success: false, error: result.error }
            }

            return { success: true, reservationId: result.id }
        } catch (err: any) {
            return { success: false, error: err.message || 'Error booking reservation' }
        }
    }

    static async getReservationDetails(id: string) {
        try {
            const data = await ReservationRepository.getReservationById(id)
            return { success: true, data }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }
}
