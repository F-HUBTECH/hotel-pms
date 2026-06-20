/**
 * Currency and number formatting utilities.
 */

const CURRENCY_SYMBOL = '฿'

/** Format a number as Thai Baht currency */
export function formatCurrency(amount: number): string {
    return `${CURRENCY_SYMBOL}${amount.toLocaleString()}`
}

/** Format a number as Thai Baht with decimal places */
export function formatCurrencyDecimal(amount: number, decimals = 2): string {
    return `${CURRENCY_SYMBOL}${amount.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}`
}

/** Format a percentage value */
export function formatPercent(value: number): string {
    return `${Math.round(value)}%`
}
