'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable, type Column } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { getRooms, createRoom, updateRoom, deleteRoom } from '@/lib/actions/rooms'
import { getBuildings } from '@/lib/actions/buildings'
import { getFloorPlans } from '@/lib/actions/floor-plans'
import { getRoomTypes } from '@/lib/actions/room-types'
import type { Room, Building, FloorPlan, RoomType } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const statusColors: Record<string, string> = {
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    occupied: 'bg-amber-50 text-amber-700 border-amber-200',
    maintenance: 'bg-red-50 text-red-700 border-red-200',
    out_of_order: 'bg-slate-100 text-slate-600 border-slate-200',
}

function RoomForm({
    open, onOpenChange, onSubmit, initialData, mode, buildings, floorPlans, roomTypes,
}: {
    open: boolean; onOpenChange: (o: boolean) => void
    onSubmit: (d: { room_number: string; building_id: string; floor_plan_id: string | null; room_type_id: string; status: string }) => Promise<{ success: boolean; error?: string }>
    initialData?: Room | null; mode: 'create' | 'edit'
    buildings: Building[]; floorPlans: FloorPlan[]; roomTypes: RoomType[]
}) {
    const [roomNumber, setRoomNumber] = useState('')
    const [buildingId, setBuildingId] = useState('')
    const [floorPlanId, setFloorPlanId] = useState('')
    const [roomTypeId, setRoomTypeId] = useState('')
    const [status, setStatus] = useState('available')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (initialData && mode === 'edit') {
            setRoomNumber(initialData.room_number); setBuildingId(initialData.building_id)
            setFloorPlanId(initialData.floor_plan_id || ''); setRoomTypeId(initialData.room_type_id)
            setStatus(initialData.status)
        } else { setRoomNumber(''); setBuildingId(''); setFloorPlanId(''); setRoomTypeId(''); setStatus('available') }
        setError('')
    }, [initialData, mode, open])

    const filteredFloors = floorPlans.filter((f) => f.building_id === buildingId)

    const handle = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setError('')
        if (!buildingId || !roomTypeId) { setError('Please fill required fields'); setLoading(false); return }
        const r = await onSubmit({ room_number: roomNumber, building_id: buildingId, floor_plan_id: floorPlanId || null, room_type_id: roomTypeId, status })
        setLoading(false)
        if (!r.success) setError(r.error || 'Error'); else onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{mode === 'create' ? 'Create Room' : 'Edit Room'}</DialogTitle></DialogHeader>
                <form onSubmit={handle} className="space-y-4 mt-2">
                    {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Room Number <span className="text-red-500">*</span></Label><Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required placeholder="e.g. 101" /></div>
                        <div className="space-y-2"><Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="available">Available</SelectItem>
                                    <SelectItem value="occupied">Occupied</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                    <SelectItem value="out_of_order">Out of Order</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2"><Label>Building <span className="text-red-500">*</span></Label>
                        <Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setFloorPlanId('') }}><SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                            <SelectContent>{buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label>Floor Plan</Label>
                        <Select value={floorPlanId} onValueChange={setFloorPlanId}><SelectTrigger><SelectValue placeholder="Select floor (optional)" /></SelectTrigger>
                            <SelectContent>{filteredFloors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label>Room Type <span className="text-red-500">*</span></Label>
                        <Select value={roomTypeId} onValueChange={setRoomTypeId}><SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                            <SelectContent>{roomTypes.map((rt) => <SelectItem key={rt.id} value={rt.id}>{rt.code} — {rt.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'create' ? 'Create' : 'Save'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default function RoomsPage() {
    const [data, setData] = useState<Room[]>([])
    const [buildings, setBuildings] = useState<Building[]>([])
    const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [mode, setMode] = useState<'create' | 'edit'>('create')
    const [editing, setEditing] = useState<Room | null>(null)
    const [delOpen, setDelOpen] = useState(false)
    const [deleting, setDeleting] = useState<Room | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        const [r, b, fp, rt] = await Promise.all([
            getRooms(page, 10, search), getBuildings(1, 100), getFloorPlans(1, 200), getRoomTypes(1, 100),
        ])
        setData(r.data); setTotal(r.count); setBuildings(b.data); setFloorPlans(fp.data); setRoomTypes(rt.data); setLoading(false)
    }, [page, search])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setPage(1) }, [search])

    const columns: Column<Room>[] = [
        { key: 'room_number', header: 'Room #', cell: (i) => <span className="font-bold text-slate-800">{i.room_number}</span> },
        { key: 'room_type', header: 'Type', cell: (i) => <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 font-mono text-xs">{(i as Room & { room_type: RoomType }).room_type?.code || '—'}</Badge> },
        { key: 'building', header: 'Building', cell: (i) => <span className="text-sm">{(i as Room & { building: Building }).building?.name || '—'}</span> },
        { key: 'floor_plan', header: 'Floor', cell: (i) => <span className="text-sm text-slate-500">{(i as Room & { floor_plan: FloorPlan }).floor_plan?.name || '—'}</span> },
        { key: 'status', header: 'Status', cell: (i) => <Badge variant="outline" className={statusColors[i.status] || ''}>{i.status.replace('_', ' ')}</Badge> },
    ]

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-slate-900">Rooms</h1><p className="text-sm text-slate-500 mt-1">Room inventory management</p></div>
            <DataTable columns={columns} data={data} totalCount={total} page={page} pageSize={10} onPageChange={setPage} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by room number..." isLoading={loading}
                headerActions={<Button onClick={() => { setMode('create'); setEditing(null); setFormOpen(true) }} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" />Add Room</Button>}
                actions={(item) => (
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => { setMode('edit'); setEditing(item); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => { setDeleting(item); setDelOpen(true) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                )}
            />
            <RoomForm open={formOpen} onOpenChange={setFormOpen} initialData={editing} mode={mode} buildings={buildings} floorPlans={floorPlans} roomTypes={roomTypes}
                onSubmit={async (d) => {
                    const r = mode === 'create' ? await createRoom(d) : await updateRoom(editing!.id, d)
                    if (r.success) { toast.success(`Room ${mode === 'create' ? 'created' : 'updated'}`); fetchData() }
                    return r
                }}
            />
            <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title="Delete Room" description={`Delete room "${deleting?.room_number}"?`}
                onConfirm={async () => { const r = await deleteRoom(deleting!.id); if (r.success) { toast.success('Room deleted'); fetchData() } else toast.error(r.error!) }}
            />
        </div>
    )
}
