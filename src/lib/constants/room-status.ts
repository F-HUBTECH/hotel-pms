/**
 * Room status configurations — single source of truth for status colors, labels, and icons.
 */

import type { RoomStatus } from '@/lib/types/database'

export interface RoomStatusConfig {
    label: string
    bg: string
    border: string
    text: string
    dot: string
}

export const ROOM_STATUS_CONFIG: Record<RoomStatus, RoomStatusConfig> = {
    available: {
        label: 'Available',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
    },
    occupied: {
        label: 'Occupied',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
    },
    reserved: {
        label: 'Reserved',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
    },
    dirty: {
        label: 'Dirty',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
    },
    clean: {
        label: 'Clean',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        text: 'text-cyan-700',
        dot: 'bg-cyan-500',
    },
    maintenance: {
        label: 'Maintenance',
        bg: 'bg-slate-50',
        border: 'border-slate-300',
        text: 'text-slate-600',
        dot: 'bg-slate-400',
    },
    out_of_order: {
        label: 'Out of Order',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        dot: 'bg-red-500',
    },
}

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
    available: 'Available',
    occupied: 'Occupied',
    reserved: 'Reserved',
    dirty: 'Dirty',
    clean: 'Clean',
    maintenance: 'Maintenance',
    out_of_order: 'Out of Order',
}
