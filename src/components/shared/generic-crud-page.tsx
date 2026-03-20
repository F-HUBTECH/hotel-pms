'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable, type Column } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { getNamedEntities, createNamedEntity, updateNamedEntity, deleteNamedEntity } from '@/lib/actions/generic-crud'
import type { NamedEntity } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface GenericCrudPageProps {
    title: string
    description: string
    tableName: string
}

export function GenericCrudPage({ title, description, tableName }: GenericCrudPageProps) {
    const [data, setData] = useState<NamedEntity[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [mode, setMode] = useState<'create' | 'edit'>('create')
    const [editing, setEditing] = useState<NamedEntity | null>(null)
    const [delOpen, setDelOpen] = useState(false)
    const [deleting, setDeleting] = useState<NamedEntity | null>(null)
    const [formName, setFormName] = useState('')
    const [formError, setFormError] = useState('')
    const [formLoading, setFormLoading] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        const r = await getNamedEntities(tableName, page, 10, search)
        setData(r.data); setTotal(r.count); setLoading(false)
    }, [page, search, tableName])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setPage(1) }, [search])

    const openCreate = () => { setMode('create'); setEditing(null); setFormName(''); setFormError(''); setFormOpen(true) }
    const openEdit = (item: NamedEntity) => { setMode('edit'); setEditing(item); setFormName(item.name); setFormError(''); setFormOpen(true) }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setFormLoading(true); setFormError('')
        const r = mode === 'create'
            ? await createNamedEntity(tableName, { name: formName })
            : await updateNamedEntity(tableName, editing!.id, { name: formName })
        setFormLoading(false)
        if (r.success) { toast.success(`${mode === 'create' ? 'Created' : 'Updated'} successfully`); setFormOpen(false); fetchData() }
        else setFormError(r.error || 'Error')
    }

    const handleDelete = async () => {
        if (!deleting) return
        const r = await deleteNamedEntity(tableName, deleting.id)
        if (r.success) { toast.success('Deleted'); fetchData() } else toast.error(r.error!)
    }

    const columns: Column<NamedEntity>[] = [
        { key: 'name', header: 'Name', cell: (i) => <span className="font-medium">{i.name}</span> },
        { key: 'created_at', header: 'Created', cell: (i) => <span className="text-xs text-slate-400">{new Date(i.created_at).toLocaleDateString()}</span> },
    ]

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="text-sm text-slate-500 mt-1">{description}</p></div>
            <DataTable columns={columns} data={data} totalCount={total} page={page} pageSize={10} onPageChange={setPage} searchValue={search} onSearchChange={setSearch}
                searchPlaceholder={`Search ${title.toLowerCase()}...`} isLoading={loading}
                headerActions={<Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" />Add {title.replace(/s$/, '')}</Button>}
                actions={(item) => (
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => { setDeleting(item); setDelOpen(true) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                )}
            />
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{mode === 'create' ? `Create ${title.replace(/s$/, '')}` : `Edit ${title.replace(/s$/, '')}`}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                        {formError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{formError}</div>}
                        <div className="space-y-2"><Label htmlFor="name">Name <span className="text-red-500">*</span></Label><Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} required /></div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={formLoading}>Cancel</Button>
                            <Button type="submit" disabled={formLoading} className="bg-indigo-600 hover:bg-indigo-700">{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'create' ? 'Create' : 'Save'}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title={`Delete ${title.replace(/s$/, '')}`} description={`Delete "${deleting?.name}"?`} onConfirm={handleDelete} />
        </div>
    )
}
