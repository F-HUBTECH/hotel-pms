'use client'

import { useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export interface Column<T> {
    key: string
    header: string
    cell?: (item: T) => React.ReactNode
    className?: string
}

interface DataTableProps<T> {
    columns: Column<T>[]
    data: T[]
    totalCount: number
    page: number
    pageSize: number
    onPageChange: (page: number) => void
    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
    isLoading?: boolean
    actions?: (item: T) => React.ReactNode
    headerActions?: React.ReactNode
}

export function DataTable<T extends { id: string }>({
    columns,
    data,
    totalCount,
    page,
    pageSize,
    onPageChange,
    searchValue = '',
    onSearchChange,
    searchPlaceholder = 'Search...',
    isLoading = false,
    actions,
    headerActions,
}: DataTableProps<T>) {
    const totalPages = Math.ceil(totalCount / pageSize)
    const startItem = (page - 1) * pageSize + 1
    const endItem = Math.min(page * pageSize, totalCount)

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                {onSearchChange && (
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9 bg-white border-slate-200"
                        />
                    </div>
                )}
                {headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            {columns.map((col) => (
                                <TableHead
                                    key={col.key}
                                    className={`text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.className || ''}`}
                                >
                                    {col.header}
                                </TableHead>
                            ))}
                            {actions && (
                                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-[100px] text-right">
                                    Actions
                                </TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    {columns.map((col) => (
                                        <TableCell key={col.key}>
                                            <Skeleton className="h-4 w-full max-w-[200px]" />
                                        </TableCell>
                                    ))}
                                    {actions && (
                                        <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                    )}
                                </TableRow>
                            ))
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length + (actions ? 1 : 0)}
                                    className="h-32 text-center text-slate-400"
                                >
                                    No results found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                    {columns.map((col) => (
                                        <TableCell key={col.key} className={`text-sm text-slate-700 ${col.className || ''}`}>
                                            {col.cell
                                                ? col.cell(item)
                                                : String((item as Record<string, unknown>)[col.key] ?? '')}
                                        </TableCell>
                                    ))}
                                    {actions && (
                                        <TableCell className="text-right">
                                            {actions(item)}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    {totalCount > 0 ? (
                        <>Showing <span className="font-medium text-slate-700">{startItem}</span> to <span className="font-medium text-slate-700">{endItem}</span> of <span className="font-medium text-slate-700">{totalCount}</span> results</>
                    ) : (
                        'No results'
                    )}
                </p>
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(1)}
                        disabled={page <= 1}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-3">
                        Page {page} of {totalPages || 1}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(totalPages)}
                        disabled={page >= totalPages}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
