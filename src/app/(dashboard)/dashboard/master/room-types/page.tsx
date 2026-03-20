'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable, type Column } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { RoomTypeForm } from './room-type-form'
import { getRoomTypes, createRoomType, updateRoomType, deleteRoomType } from '@/lib/actions/room-types'
import type { RoomType } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function RoomTypesPage() {
    const [data, setData] = useState<RoomType[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
    const [editingItem, setEditingItem] = useState<RoomType | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingItem, setDeletingItem] = useState<RoomType | null>(null)
    const pageSize = 10

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        const result = await getRoomTypes(page, pageSize, search)
        setData(result.data)
        setTotalCount(result.count)
        setIsLoading(false)
    }, [page, search])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Debounce search
    useEffect(() => {
        setPage(1)
    }, [search])

    const handleCreate = () => {
        setFormMode('create')
        setEditingItem(null)
        setFormOpen(true)
    }

    const handleEdit = (item: RoomType) => {
        setFormMode('edit')
        setEditingItem(item)
        setFormOpen(true)
    }

    const handleDeleteClick = (item: RoomType) => {
        setDeletingItem(item)
        setDeleteDialogOpen(true)
    }

    const handleFormSubmit = async (formData: { code: string; name: string; description: string; base_price: number }) => {
        if (formMode === 'create') {
            const result = await createRoomType(formData)
            if (result.success) {
                toast.success('Room type created successfully')
                fetchData()
            }
            return result
        } else {
            const result = await updateRoomType(editingItem!.id, formData)
            if (result.success) {
                toast.success('Room type updated successfully')
                fetchData()
            }
            return result
        }
    }

    const handleDelete = async () => {
        if (!deletingItem) return
        const result = await deleteRoomType(deletingItem.id)
        if (result.success) {
            toast.success('Room type deleted successfully')
            fetchData()
        } else {
            toast.error(result.error || 'Failed to delete room type')
        }
    }

    const columns: Column<RoomType>[] = [
        {
            key: 'code',
            header: 'Code',
            cell: (item) => (
                <Badge variant="secondary" className="font-mono text-xs bg-indigo-50 text-indigo-700">
                    {item.code}
                </Badge>
            ),
        },
        {
            key: 'name',
            header: 'Name',
            cell: (item) => <span className="font-medium">{item.name}</span>,
        },
        {
            key: 'description',
            header: 'Description',
            cell: (item) => (
                <span className="text-slate-500 truncate max-w-[300px] block">
                    {item.description || '—'}
                </span>
            ),
        },
        {
            key: 'base_price',
            header: 'Base Price',
            cell: (item) => (
                <span className="font-semibold text-emerald-600">
                    ฿{Number(item.base_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
            ),
            className: 'text-right',
        },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Room Types</h1>
                <p className="text-sm text-slate-500 mt-1">Manage room type categories and base pricing</p>
            </div>

            <DataTable
                columns={columns}
                data={data}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by code or name..."
                isLoading={isLoading}
                headerActions={
                    <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Room Type
                    </Button>
                }
                actions={(item) => (
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            onClick={() => handleEdit(item)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteClick(item)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            />

            <RoomTypeForm
                open={formOpen}
                onOpenChange={setFormOpen}
                onSubmit={handleFormSubmit}
                initialData={editingItem}
                mode={formMode}
            />

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Room Type"
                description={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
                onConfirm={handleDelete}
            />
        </div>
    )
}
