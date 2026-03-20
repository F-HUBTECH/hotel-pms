'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable, type Column } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { getBuildings, createBuilding, updateBuilding, deleteBuilding } from '@/lib/actions/buildings'
import type { Building } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function BuildingForm({
    open, onOpenChange, onSubmit, initialData, mode,
}: {
    open: boolean; onOpenChange: (o: boolean) => void
    onSubmit: (d: { name: string; description: string }) => Promise<{ success: boolean; error?: string }>
    initialData?: Building | null; mode: 'create' | 'edit'
}) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (initialData && mode === 'edit') { setName(initialData.name); setDescription(initialData.description || '') }
        else { setName(''); setDescription('') }
        setError('')
    }, [initialData, mode, open])

    const handle = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setError('')
        const r = await onSubmit({ name, description })
        setLoading(false)
        if (!r.success) setError(r.error || 'Error'); else onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{mode === 'create' ? 'Create Building' : 'Edit Building'}</DialogTitle></DialogHeader>
                <form onSubmit={handle} className="space-y-4 mt-2">
                    {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
                    <div className="space-y-2"><Label htmlFor="name">Name <span className="text-red-500">*</span></Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                    <div className="space-y-2"><Label htmlFor="desc">Description</Label><Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'create' ? 'Create' : 'Save'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default function BuildingsPage() {
    const [data, setData] = useState<Building[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [mode, setMode] = useState<'create' | 'edit'>('create')
    const [editing, setEditing] = useState<Building | null>(null)
    const [delOpen, setDelOpen] = useState(false)
    const [deleting, setDeleting] = useState<Building | null>(null)

    const fetch = useCallback(async () => {
        setLoading(true)
        const r = await getBuildings(page, 10, search)
        setData(r.data); setTotal(r.count); setLoading(false)
    }, [page, search])

    useEffect(() => { fetch() }, [fetch])
    useEffect(() => { setPage(1) }, [search])

    const columns: Column<Building>[] = [
        { key: 'name', header: 'Name', cell: (i) => <span className="font-medium">{i.name}</span> },
        { key: 'description', header: 'Description', cell: (i) => <span className="text-slate-500">{i.description || '—'}</span> },
        { key: 'created_at', header: 'Created', cell: (i) => <span className="text-xs text-slate-400">{new Date(i.created_at).toLocaleDateString()}</span> },
    ]

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-slate-900">Buildings</h1><p className="text-sm text-slate-500 mt-1">Manage property buildings</p></div>
            <DataTable columns={columns} data={data} totalCount={total} page={page} pageSize={10} onPageChange={setPage} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search buildings..." isLoading={loading}
                headerActions={<Button onClick={() => { setMode('create'); setEditing(null); setFormOpen(true) }} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" />Add Building</Button>}
                actions={(item) => (
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => { setMode('edit'); setEditing(item); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => { setDeleting(item); setDelOpen(true) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                )}
            />
            <BuildingForm open={formOpen} onOpenChange={setFormOpen} initialData={editing} mode={mode}
                onSubmit={async (d) => {
                    const r = mode === 'create' ? await createBuilding(d) : await updateBuilding(editing!.id, d)
                    if (r.success) { toast.success(`Building ${mode === 'create' ? 'created' : 'updated'}`); fetch() }
                    return r
                }}
            />
            <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title="Delete Building" description={`Delete "${deleting?.name}"?`}
                onConfirm={async () => { const r = await deleteBuilding(deleting!.id); if (r.success) { toast.success('Building deleted'); fetch() } else toast.error(r.error!) }}
            />
        </div>
    )
}
