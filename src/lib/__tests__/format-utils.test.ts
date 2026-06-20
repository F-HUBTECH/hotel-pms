/**
 * Unit tests for currency and number formatting utilities
 */
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyDecimal, formatPercent } from '../utils/format'

describe('formatPercent', () => {
    it('formats whole numbers correctly', () => {
        expect(formatPercent(42)).toBe('42%')
    })

    it('rounds decimal values', () => {
        expect(formatPercent(42.57)).toBe('43%')
    })

    it('handles zero', () => {
        expect(formatPercent(0)).toBe('0%')
    })

    it('rounds up at .5', () => {
        expect(formatPercent(99.5)).toBe('100%')
    })

    it('handles negative values', () => {
        expect(formatPercent(-5)).toBe('-5%')
    })

    it('handles 100 exactly', () => {
        expect(formatPercent(100)).toBe('100%')
    })
})

describe('formatCurrency', () => {
    it('formats thousand with comma', () => {
        const result = formatCurrency(1000)
        expect(result).toContain('฿')
        expect(result).toContain('1,000')
    })

    it('formats zero', () => {
        const result = formatCurrency(0)
        expect(result).toContain('฿')
        expect(result).toContain('0')
    })

    it('formats large number', () => {
        const result = formatCurrency(1_000_000)
        expect(result).toContain('฿')
        expect(result).toContain('1,000,000')
    })

    it('formats decimal number', () => {
        const result = formatCurrency(1234.56)
        expect(result).toContain('฿')
        expect(result).toContain('1,234.56')
    })
})

describe('formatCurrencyDecimal', () => {
    it('formats with 2 decimal places', () => {
        const result = formatCurrencyDecimal(1234.5, 2)
        expect(result).toContain('฿')
        expect(result).toContain('1,234.50')
    })

    it('formats with custom decimal places', () => {
        const result = formatCurrencyDecimal(1234.567, 3)
        expect(result).toContain('฿')
        expect(result).toContain('1,234.567')
    })

    it('formats zero with decimals', () => {
        const result = formatCurrencyDecimal(0, 2)
        expect(result).toContain('฿')
        expect(result).toContain('0.00')
    })
})
