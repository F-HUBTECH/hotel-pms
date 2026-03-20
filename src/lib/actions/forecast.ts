'use server'

import { ForecastService } from '../services/forecast-service'

export async function getForecastAction(propertyId: string, days: number = 30) {
    return await ForecastService.getForecast(propertyId, days)
}
