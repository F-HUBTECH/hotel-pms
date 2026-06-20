/**
 * Date/time utility functions shared across the application.
 */

/** Returns today's date in YYYY-MM-DD format */
export function todayISO(): string {
    return new Date().toISOString().split('T')[0]
}

/** Returns current time in HH:MM format */
export function currentTimeHHMM(): string {
    return new Date().toTimeString().split(' ')[0].substring(0, 5)
}

/** Returns current ISO datetime string */
export function nowISO(): string {
    return new Date().toISOString()
}

/**
 * Calculate number of nights between two date strings.
 * Returns at least 1 night.
 */
export function calculateNights(checkIn: string, checkOut: string): number {
    const start = new Date(checkIn).getTime()
    const end = new Date(checkOut).getTime()
    return Math.max(1, Math.ceil((end - start) / 86_400_000))
}

/** Format a date string for display in compact numeric format (DD/MM/YYYY) */
export function formatDateShort(dateStr: string | Date): string {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

/** Format a date string for display in Thai locale */
export function formatDisplayDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

/**
 * Generate an array of date strings between two dates (inclusive).
 * Returns empty array if fromDate > toDate.
 */
export function generateDateRange(fromDate: string, toDate: string): string[] {
    const dates: string[] = []
    const start = new Date(fromDate)
    const end = new Date(toDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return dates
    if (start > end) return dates

    const current = new Date(start)
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
    }
    return dates
}

/** Format a date string for display in English locale */
export function formatDisplayDateEN(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}
