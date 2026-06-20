/**
 * VAT and Service Charge Calculation Service
 * Implements standard Thai hotel accounting formulas for VAT and Service Charge.
 *
 * Thailand VAT rate: 7%
 * Hotel Service Charge: typically 10%
 */

export interface VatBreakdown {
    gross: number
    netAmount: number
    vatAmount: number
    servAmount: number
    vatRate: number
    servRate: number
    vatableAmount: number
    nonVatAmount: number
}

/**
 * Type A: VAT Inclusive (Thailand Standard)
 * Amount already includes VAT + Service Charge
 *
 * Formula:
 * - VAT Amount = (Gross × VAT Rate) / (100 + VAT Rate)
 * - Service Amount = (Gross × Service Rate) / (100 + VAT Rate + Service Rate)
 * - Net Amount = Gross - VAT - Service
 *
 * @param gross - Total amount including VAT and Service Charge
 * @param vatRate - VAT percentage (default 7% in Thailand)
 * @param servRate - Service charge percentage (default 10% in hotels)
 */
export function calculateVATTypeA(
    gross: number,
    vatRate: number = 7.0,
    servRate: number = 10.0,
): VatBreakdown {
    // VAT Amount
    const vatAmount =
        Math.round(((gross * vatRate) / (100 + vatRate)) * 100) / 100

    // Service Amount (from pre-VAT amount)
    const servAmount =
        Math.round(((gross * servRate) / (100 + vatRate + servRate)) * 100) /
        100

    // Net Amount (before VAT and Service)
    const netAmount = gross - vatAmount - servAmount

    return {
        gross,
        netAmount: Math.round(netAmount * 100) / 100,
        vatAmount,
        servAmount,
        vatRate,
        servRate,
        vatableAmount: gross,
        nonVatAmount: 0,
    }
}

/**
 * Type B: VAT Exclusive
 * VAT and Service Charge added on top of net amount
 *
 * Formula:
 * - Service Amount = Net × Service Rate / 100
 * - VAT Amount = (Net + Service Amount) × VAT Rate / 100
 * - Gross = Net + VAT + Service
 *
 * @param net - Amount before VAT and Service Charge
 * @param vatRate - VAT percentage (default 7%)
 * @param servRate - Service charge percentage (default 10%)
 */
export function calculateVATTypeB(
    net: number,
    vatRate: number = 7.0,
    servRate: number = 10.0,
): VatBreakdown {
    // Service Amount
    const servAmount = Math.round(((net * servRate) / 100) * 100) / 100

    // VAT Amount (on net + service)
    const vatAmount =
        Math.round((((net + servAmount) * vatRate) / 100) * 100) / 100

    // Gross Amount (net + VAT + Service)
    const gross = net + vatAmount + servAmount

    return {
        gross: Math.round(gross * 100) / 100,
        netAmount: net,
        vatAmount,
        servAmount,
        vatRate,
        servRate,
        vatableAmount: net,
        nonVatAmount: 0,
    }
}

/**
 * Non-VAT Item
 * No VAT or Service Charge applied
 *
 * @param amount - Full amount (no tax)
 */
export function calculateNonVAT(amount: number): VatBreakdown {
    return {
        gross: amount,
        netAmount: amount,
        vatAmount: 0,
        servAmount: 0,
        vatRate: 0,
        servRate: 0,
        vatableAmount: 0,
        nonVatAmount: amount,
    }
}
