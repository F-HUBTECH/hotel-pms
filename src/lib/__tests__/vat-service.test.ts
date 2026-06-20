/**
 * Unit tests for VAT/Service Charge calculation (Thai hotel standards)
 */
import { describe, it, expect } from 'vitest'
import { calculateVATTypeA, calculateVATTypeB, calculateNonVAT } from '../services/vat-service'

describe('calculateVATTypeA (VAT Inclusive)', () => {
    it('calculates standard hotel rate: 1,000 THB with 7% VAT, 10% SC', () => {
        const result = calculateVATTypeA(1000, 7, 10)

        expect(result.vatAmount).toBeCloseTo(65.42, 2)
        expect(result.servAmount).toBeCloseTo(85.47, 2)
        expect(result.netAmount).toBeCloseTo(849.11, 2)
        expect(result.gross).toBe(1000)
        expect(result.vatableAmount).toBe(1000)
        expect(result.nonVatAmount).toBe(0)
    })

    it('calculates 500 THB with 7% VAT, 10% SC', () => {
        const result = calculateVATTypeA(500, 7, 10)

        expect(result.vatAmount).toBeCloseTo(32.71, 2)
        expect(result.servAmount).toBeCloseTo(42.74, 2)
        expect(result.netAmount).toBeCloseTo(424.55, 2)
    })

    it('calculates 2,500 THB with 7% VAT, 10% SC', () => {
        const result = calculateVATTypeA(2500, 7, 10)

        expect(result.vatAmount).toBeCloseTo(163.55, 2)
        expect(result.servAmount).toBeCloseTo(213.68, 2)
        expect(result.netAmount).toBeCloseTo(2122.77, 2)
    })

    it('handles custom VAT and Service rates', () => {
        const result = calculateVATTypeA(2000, 10, 5)

        expect(result.vatAmount).toBeCloseTo(181.82, 2)
        expect(result.servAmount).toBeCloseTo(86.96, 2)
        expect(result.netAmount).toBeCloseTo(1731.22, 2)
    })

    it('handles zero VAT rate', () => {
        const result = calculateVATTypeA(1000, 0, 10)

        expect(result.vatAmount).toBe(0)
        expect(result.servAmount).toBeCloseTo(90.91, 2)
        expect(result.netAmount).toBeCloseTo(909.09, 2)
    })

    it('handles zero Service Charge', () => {
        const result = calculateVATTypeA(1000, 7, 0)

        expect(result.vatAmount).toBeCloseTo(65.42, 2)
        expect(result.servAmount).toBe(0)
        expect(result.netAmount).toBeCloseTo(934.58, 2)
    })

    it('handles room rate: 3,500 THB', () => {
        const result = calculateVATTypeA(3500, 7, 10)

        expect(result.vatAmount).toBeCloseTo(228.97, 2)
        expect(result.servAmount).toBeCloseTo(299.15, 2)
        expect(result.netAmount).toBeCloseTo(2971.88, 2)
    })

    it('rounds to 2 decimal places', () => {
        const result = calculateVATTypeA(999.99, 7, 10)

        // All values should have at most 2 decimal places
        expect(result.vatAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
        expect(result.servAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
        expect(result.netAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
    })

    it('handles large amounts without overflow', () => {
        const result = calculateVATTypeA(1_000_000, 7, 10)

        expect(result.vatAmount).toBeGreaterThan(0)
        expect(result.servAmount).toBeGreaterThan(0)
        expect(result.netAmount).toBeGreaterThan(0)
        // gross = net + vat + service
        expect(result.gross).toBeCloseTo(
            result.netAmount + result.vatAmount + result.servAmount,
            2,
        )
    })

    // Edge cases

    it('handles zero gross amount', () => {
        const result = calculateVATTypeA(0, 7, 10)

        expect(result.vatAmount).toBe(0)
        expect(result.servAmount).toBe(0)
        expect(result.netAmount).toBe(0)
        expect(result.gross).toBe(0)
    })

    it('handles extreme VAT rate (100%)', () => {
        const result = calculateVATTypeA(2000, 100, 0)

        expect(result.vatAmount).toBeCloseTo(1000, 2)
        expect(result.netAmount).toBeCloseTo(1000, 2)
    })

    it('handles extreme Service Charge rate (50%)', () => {
        const result = calculateVATTypeA(1570, 7, 50)

        expect(result.servAmount).toBeCloseTo(500, 2)
        expect(result.gross).toBe(1570)
    })

    it('gross equals net + VAT + service (rounding check)', () => {
        // Test with many random-looking amounts
        const testCases = [500, 1234, 9999, 15750, 999.99]
        for (const gross of testCases) {
            const result = calculateVATTypeA(gross, 7, 10)
            const recomposed = result.netAmount + result.vatAmount + result.servAmount
            expect(Math.abs(recomposed - gross)).toBeLessThanOrEqual(0.02)
        }
    })
})

describe('calculateVATTypeB (VAT Exclusive)', () => {
    it('calculates 1,000 THB net with 7% VAT, 10% SC', () => {
        const result = calculateVATTypeB(1000, 7, 10)

        expect(result.vatAmount).toBeCloseTo(77.0, 2)
        expect(result.servAmount).toBeCloseTo(100.0, 2)
        expect(result.gross).toBeCloseTo(1177.0, 2)
        expect(result.netAmount).toBe(1000)
    })

    it('calculates 500 THB net with 7% VAT, 10% SC', () => {
        const result = calculateVATTypeB(500, 7, 10)

        expect(result.vatAmount).toBeCloseTo(38.5, 2)
        expect(result.servAmount).toBeCloseTo(50.0, 2)
        expect(result.gross).toBeCloseTo(588.5, 2)
    })

    it('handles custom VAT and Service rates', () => {
        const result = calculateVATTypeB(500, 10, 8)

        expect(result.servAmount).toBeCloseTo(40.0, 2)
        expect(result.vatAmount).toBeCloseTo(54.0, 2)
        expect(result.gross).toBeCloseTo(594.0, 2)
    })

    it('handles zero VAT rate', () => {
        const result = calculateVATTypeB(1000, 0, 10)

        expect(result.vatAmount).toBe(0)
        expect(result.servAmount).toBeCloseTo(100.0, 2)
        expect(result.gross).toBeCloseTo(1100.0, 2)
    })

    it('handles zero Service Charge', () => {
        const result = calculateVATTypeB(1000, 7, 0)

        expect(result.servAmount).toBe(0)
        expect(result.vatAmount).toBeCloseTo(70.0, 2)
        expect(result.gross).toBeCloseTo(1070.0, 2)
    })

    it('rounds to 2 decimal places', () => {
        const result = calculateVATTypeB(999.99, 7, 10)

        expect(result.vatAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
        expect(result.servAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
        expect(result.gross.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
    })

    // Edge cases

    it('handles zero net amount', () => {
        const result = calculateVATTypeB(0, 7, 10)

        expect(result.servAmount).toBe(0)
        expect(result.vatAmount).toBe(0)
        expect(result.gross).toBe(0)
    })

    it('handles extreme VAT and Service rates', () => {
        const result = calculateVATTypeB(1000, 20, 15)

        expect(result.servAmount).toBeCloseTo(150, 2)
        expect(result.vatAmount).toBeCloseTo(230, 2)
        expect(result.gross).toBeCloseTo(1380, 2)
    })

    it('gross is always >= net (VAT and SC are non-negative)', () => {
        const testCases = [0, 500, 1000, 9999]
        for (const net of testCases) {
            const result = calculateVATTypeB(net, 7, 10)
            expect(result.gross).toBeGreaterThanOrEqual(net)
        }
    })
})

describe('calculateNonVAT', () => {
    it('returns all amounts equal with zero VAT/SC', () => {
        const result = calculateNonVAT(500)

        expect(result.gross).toBe(500)
        expect(result.netAmount).toBe(500)
        expect(result.vatAmount).toBe(0)
        expect(result.servAmount).toBe(0)
        expect(result.vatRate).toBe(0)
        expect(result.servRate).toBe(0)
        expect(result.vatableAmount).toBe(0)
        expect(result.nonVatAmount).toBe(500)
    })

    it('handles zero amount', () => {
        const result = calculateNonVAT(0)

        expect(result.gross).toBe(0)
        expect(result.vatAmount).toBe(0)
        expect(result.servAmount).toBe(0)
    })

    it('handles large amounts', () => {
        const result = calculateNonVAT(100_000)

        expect(result.gross).toBe(100_000)
        expect(result.nonVatAmount).toBe(100_000)
        expect(result.vatableAmount).toBe(0)
    })
})
