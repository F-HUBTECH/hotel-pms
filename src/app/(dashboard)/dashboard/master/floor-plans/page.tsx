'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable, type Column } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { getFloorPlans, createFloorPlan, updateFloorPlan, deleteFloorPlan } from '@/lib/actions/floor-plans'
import { getBuildings } from '@/lib/actions/buildings'
import type { FloorPlan, Building } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function FloorPlanForm({
    open, onOpenChange, onSubmit, initialData, mode, buildings,
}: {
    open: boolean; onOpenChange: (o: boolean) => void
    onSubmit: (d: { building_id: string; name: string }) => Promise<{ success: boolean; error?: string }>
    initialData?: FloorPlan | null; mode: 'create' | 'edit'; buildings: Building[]
}) {
    const [buildingId, setBuildingId] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (initialData && mode === 'edit') { setBuildingId(initialData.building_id); setName(initialData.name) }
        else { setBuildingId(''); setName('') }
        setError('')
    }, [initialData, mode, open])

    const handle = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setError('')
        if (!buildingId) { setError('Please select a building'); setLoading(false); return }
        const r = await onSubmit({ building_id: buildingId, name })
        setLoading(false)
        if (!r.success) setError(r.error || 'Error'); else onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{mode === 'create' ? 'Create Floor Plan' : 'Edit Floor Plan'}</DialogTitle></DialogHeader>
                <form onSubmit={handle} className="space-y-4 mt-2">
                    {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
                    <div className="space-y-2">
                        <Label>Building <span className="text-red-500">*</span></Label>
                        <Select value={buildingId} onValueChange={setBuildingId}>
                            <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                            <SelectContent>{buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label htmlFor="name">Name <span className="text-red-500">*</span></Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Floor 1" /></div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'create' ? 'Create' : 'Save'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default function FloorPlansPage() {
    const [data, setData] = useState<FloorPlan[]>([])
    const [buildings, setBuildings] = useState<Building[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [mode, setMode] = useState<'create' | 'edit'>('create')
    const [editing, setEditing] = useState<FloorPlan | null>(null)
    const [delOpen, setDelOpen] = useState(false)
    const [deleting, setDeleting] = useState<FloorPlan | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        const [r, b] = await Promise.all([getFloorPlans(page, 10, search), getBuildings(1, 100)])
        setData(r.data); setTotal(r.count); setBuildings(b.data); setLoading(false)
    }, [page, search])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setPage(1) }, [search])

    const columns: Column<FloorPlan>[] = [
        { key: 'name', header: 'Name', cell: (i) => <span className="font-medium">{i.name}</span> },
        { key: 'building', header: 'Building', cell: (i) => <Badge variant="secondary" className="bg-cyan-50 text-cyan-700">{(i as FloorPlan & { building: Building }).building?.name || '—'}</Badge> },
        { key: 'created_at', header: 'Created', cell: (i) => <span className="text-xs text-slate-400">{new Date(i.created_at).toLocaleDateString()}</span> },
    ]

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-slate-900">Floor Plans</h1><p className="text-sm text-slate-500 mt-1">Manage building floor plans</p></div>
            <DataTable columns={columns} data={data} totalCount={total} page={page} pageSize={10} onPageChange={setPage} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search floor plans..." isLoading={loading}
                headerActions={<Button onClick={() => { setMode('create'); setEditing(null); setFormOpen(true) }} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" />Add Floor Plan</Button>}
                actions={(item) => (
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => { setMode('edit'); setEditing(item); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => { setDeleting(item); setDelOpen(true) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                )}
            />
            <FloorPlanForm open={formOpen} onOpenChange={setFormOpen} initialData={editing} mode={mode} buildings={buildings}
                onSubmit={async (d) => {
                    const r = mode === 'create' ? await createFloorPlan(d) : await updateFloorPlan(editing!.id, d)
                    if (r.success) { toast.success(`Floor plan ${mode === 'create' ? 'created' : 'updated'}`); fetchData() }
                    return r
                }}
            />
            <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title="Delete Floor Plan" description={`Delete "${deleting?.name}"?`}
                onConfirm={async () => { const r = await deleteFloorPlan(deleting!.id); if (r.success) { toast.success('Deleted'); fetchData() } else toast.error(r.error!) }}
            />
        </div>
    )
}
