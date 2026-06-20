/**
 * Unit tests for Forecast Comparison pure helper functions
 */
import { describe, it, expect } from 'vitest'
import {
    formatCurrency,
    formatPercent,
    getAccuracyColor,
    getVarianceColor,
    classifyTrend,
} from '../services/forecast-comparison-service'

// ─────────────────────────────────────────────
// formatCurrency (forecast-comparison variant)
// ─────────────────────────────────────────────

describe('formatCurrency', () => {
    it('formats THB with Intl.NumberFormat', () => {
        const result = formatCurrency(1000)
        expect(result).toBeTruthy()
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
    })

    it('formats zero', () => {
        const result = formatCurrency(0)
        expect(typeof result).toBe('string')
    })

    it('formats large numbers', () => {
        const result = formatCurrency(1_000_000)
        expect(typeof result).toBe('string')
    })
})

// ─────────────────────────────────────────────
// formatPercent (forecast-comparison variant)
// ─────────────────────────────────────────────

describe('formatPercent', () => {
    it('formats with 1 decimal place', () => {
        expect(formatPercent(42.57)).toBe('42.6%')
    })

    it('formats whole numbers', () => {
        expect(formatPercent(0)).toBe('0.0%')
    })

    it('formats 100', () => {
        expect(formatPercent(100)).toBe('100.0%')
    })

    it('formats negative values', () => {
        expect(formatPercent(-5.2)).toBe('-5.2%')
    })
})

// ─────────────────────────────────────────────
// getAccuracyColor
// ─────────────────────────────────────────────

describe('getAccuracyColor', () => {
    it('returns green for excellent', () => {
        const result = getAccuracyColor('excellent')
        expect(result).toContain('bg-green-100')
        expect(result).toContain('text-green-700')
    })

    it('returns blue for good', () => {
        const result = getAccuracyColor('good')
        expect(result).toContain('bg-blue-100')
        expect(result).toContain('text-blue-700')
    })

    it('returns yellow for fair', () => {
        const result = getAccuracyColor('fair')
        expect(result).toContain('bg-yellow-100')
        expect(result).toContain('text-yellow-700')
    })

    it('returns red for poor', () => {
        const result = getAccuracyColor('poor')
        expect(result).toContain('bg-red-100')
        expect(result).toContain('text-red-700')
    })

    it('returns gray for forecast', () => {
        const result = getAccuracyColor('forecast')
        expect(result).toContain('bg-gray-100')
    })

    it('returns gray for both_zero', () => {
        const result = getAccuracyColor('both_zero')
        expect(result).toContain('bg-gray-100')
    })

    it('returns gray (default) for unknown classification', () => {
        const result = getAccuracyColor('unknown_type')
        expect(result).toContain('bg-gray-100')
    })
})

// ─────────────────────────────────────────────
// getVarianceColor
// ─────────────────────────────────────────────

describe('getVarianceColor', () => {
    it('returns green for variance < 5%', () => {
        expect(getVarianceColor(3)).toBe('text-green-600')
        expect(getVarianceColor(-4)).toBe('text-green-600')
        expect(getVarianceColor(0)).toBe('text-green-600')
    })

    it('returns blue for variance 5-10%', () => {
        expect(getVarianceColor(5)).toBe('text-blue-600')
        expect(getVarianceColor(9.9)).toBe('text-blue-600')
    })

    it('returns yellow for variance 10-20%', () => {
        expect(getVarianceColor(10)).toBe('text-yellow-600')
        expect(getVarianceColor(19)).toBe('text-yellow-600')
    })

    it('returns red for variance >= 20%', () => {
        expect(getVarianceColor(20)).toBe('text-red-600')
        expect(getVarianceColor(25)).toBe('text-red-600')
        expect(getVarianceColor(100)).toBe('text-red-600')
    })

    it('handles negative variances by absolute value', () => {
        expect(getVarianceColor(-3)).toBe('text-green-600')
        expect(getVarianceColor(-7)).toBe('text-blue-600')
        expect(getVarianceColor(-15)).toBe('text-yellow-600')
        expect(getVarianceColor(-25)).toBe('text-red-600')
    })
})

// ─────────────────────────────────────────────
// classifyTrend
// ─────────────────────────────────────────────

describe('classifyTrend', () => {
    it('classifies increase > 5% as up', () => {
        expect(classifyTrend(10)).toBe('up')
        expect(classifyTrend(5.1)).toBe('up')
    })

    it('classifies decrease < -5% as down', () => {
        expect(classifyTrend(-10)).toBe('down')
        expect(classifyTrend(-5.1)).toBe('down')
    })

    it('classifies variance within ±5 as stable', () => {
        expect(classifyTrend(0)).toBe('stable')
        expect(classifyTrend(5)).toBe('stable')
        expect(classifyTrend(-5)).toBe('stable')
        expect(classifyTrend(3)).toBe('stable')
        expect(classifyTrend(-2)).toBe('stable')
    })

    it('handles extreme values', () => {
        expect(classifyTrend(100)).toBe('up')
        expect(classifyTrend(-100)).toBe('down')
        expect(classifyTrend(0.01)).toBe('stable')
    })
})
