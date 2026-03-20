'use client'

import { useState, useEffect, useCallback } from 'react'
import { getHousekeepingTasks, createHousekeepingTask, updateHousekeepingTaskStatus, deleteHousekeepingTask, getHousekeepingStaff } from '@/lib/actions/housekeeping'
import { getRooms, updateRoomStatus } from '@/lib/actions/rooms'
import type { HousekeepingTaskFormValues } from '@/lib/validators/housekeeping'
import type { Room } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, Calendar, CheckCircle2, Circle, Clock, Trash2, User, Sparkles, LayoutGrid, List, Filter } from 'lucide-react'
import { toast } from 'sonner'

export default function HousekeepingPage() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [tasks, setTasks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [viewMode, setViewMode] = useState<'tasks' | 'rooms'>('tasks')
    const [rooms, setRooms] = useState<Room[]>([])
    const [roomFilter, setRoomFilter] = useState('all')

    // Form state
    const [formOpen, setFormOpen] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [staff, setStaff] = useState<any[]>([])
    const [allRooms, setAllRooms] = useState<Room[]>([])

    const [form, setForm] = useState<Partial<HousekeepingTaskFormValues>>({
        status: 'pending',
        priority: 'normal',
        task_type: 'cleaning',
        scheduled_date: date,
        notes: ''
    })

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        const res = await getHousekeepingTasks(date)
        setTasks(res.data)
        setLoading(false)
    }, [date])

    const fetchLookups = useCallback(async () => {
        const [staffRes, roomsRes] = await Promise.all([
            getHousekeepingStaff(),
            getRooms(1, 500, '') // Get all rooms for grid view
        ])
        setStaff(staffRes)
        if (roomsRes?.data && Array.isArray(roomsRes.data)) {
            setRooms(roomsRes.data)
            setAllRooms(roomsRes.data)
        }
    }, [])

    useEffect(() => { 
        setMounted(true)
        fetchTasks() 
        fetchLookups()
    }, [fetchTasks, fetchLookups])

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.room_id) { toast.error('Please select a room'); return }

        setFormLoading(true)
        const res = await createHousekeepingTask({ ...form, scheduled_date: date } as HousekeepingTaskFormValues)
        setFormLoading(false)

        if (res.success) {
            toast.success('Task created')
            setFormOpen(false)
            setForm({ status: 'pending', priority: 'normal', task_type: 'cleaning', scheduled_date: date, notes: '' })
            fetchTasks()
        } else {
            toast.error(res.error || 'Failed to create task')
        }
    }

    const handleStatusUpdate = async (id: string, newStatus: string, roomId: string) => {
        const res = await updateHousekeepingTaskStatus(id, newStatus, roomId)
        if (res.success) {
            toast.success(`Task marked as ${newStatus.replace('_', ' ')}`)
            fetchTasks()
        } else {
            toast.error(res.error || 'Update failed')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return
        const res = await deleteHousekeepingTask(id)
        if (res.success) { toast.success('Task deleted'); fetchTasks() }
        else toast.error(res.error || 'Delete failed')
    }

    const statusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />
            case 'cancelled': return <Circle className="w-4 h-4 text-slate-300" />
            default: return <Circle className="w-4 h-4 text-slate-400" />
        }
    }

    const handleRoomStatusUpdate = async (roomId: string, newStatus: string) => {
        const result = await updateRoomStatus(roomId, newStatus)
        if (result.success) {
            toast.success(`Room marked as ${newStatus}`)
            fetchLookups()
        } else {
            toast.error(result.error || 'Update failed')
        }
    }

    // Filter rooms for grid view
    const filteredRooms = rooms.filter(room => {
        if (roomFilter === 'all') return true
        return room.status === roomFilter
    })

    // Group rooms by building and floor
    const groupedRooms = filteredRooms.reduce((acc, room) => {
        const building = room.building?.name || 'Unknown Building'
        const floor = room.floor_plan?.name || 'Unknown Floor'
        if (!acc[building]) acc[building] = {}
        if (!acc[building][floor]) acc[building][floor] = []
        acc[building][floor].push(room)
        return acc
    }, {} as Record<string, Record<string, Room[]>>)

    // Room status config
    const ROOM_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
        available: { label: 'Available', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
        clean: { label: 'Clean', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
        occupied: { label: 'Occupied', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
        reserved: { label: 'Reserved', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
        dirty: { label: 'Dirty', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
        maintenance: { label: 'Maintenance', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
        out_of_order: { label: 'OOO', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    }

    const STATUS_OPTIONS = [
        { value: 'all', label: 'All', color: 'bg-slate-100' },
        { value: 'available', label: 'Available', color: 'bg-emerald-100 text-emerald-700' },
        { value: 'clean', label: 'Clean', color: 'bg-blue-100 text-blue-700' },
        { value: 'occupied', label: 'Occupied', color: 'bg-amber-100 text-amber-700' },
        { value: 'dirty', label: 'Dirty', color: 'bg-rose-100 text-rose-700' },
        { value: 'maintenance', label: 'Maint.', color: 'bg-orange-100 text-orange-700' },
    ]

    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Housekeeping</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage daily cleaning, inspections, and room statuses</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="pl-9" />
                    </div>
                    <Button onClick={() => setFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap">
                        <Plus className="w-4 h-4 mr-2" />Assign Task
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" /> Tasks for {new Date(date).toLocaleDateString('en-GB')}</CardTitle>
                    <CardDescription>Click on task status to quickly update progress</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
                    ) : tasks.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">No tasks scheduled for this day</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="border-b bg-slate-50/50">
                                        <th className="p-3 font-medium text-slate-500">Room</th>
                                        <th className="p-3 font-medium text-slate-500">Task Type</th>
                                        <th className="p-3 font-medium text-slate-500">Priority</th>
                                        <th className="p-3 font-medium text-slate-500">Assignee</th>
                                        <th className="p-3 font-medium text-slate-500">Status</th>
                                        <th className="p-3 font-medium text-slate-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks.map(task => (
                                        <tr key={task.id} className={`border-b hover:bg-slate-50/50 transition-colors ${task.status === 'completed' ? 'opacity-60 bg-slate-50/80 hover:bg-slate-50/80' : ''}`}>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800">{task.room?.room_number}</div>
                                                <div className="text-xs text-slate-500">{task.room?.room_type?.name} • Room is <span className="font-medium capitalize">{task.room?.status?.replace('_', ' ')}</span></div>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="outline" className="capitalize">{task.task_type.replace('_', ' ')}</Badge>
                                            </td>
                                            <td className="p-3">
                                                <Badge className={`capitalize ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : task.priority === 'low' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                                                    {task.priority}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                {task.assignee ? (
                                                    <div className="flex items-center gap-2"><User className="w-3 h-3 text-slate-400" />{task.assignee.first_name}</div>
                                                ) : <span className="text-slate-400 italic">Unassigned</span>}
                                            </td>
                                            <td className="p-3">
                                                <Select value={task.status} onValueChange={(v) => handleStatusUpdate(task.id, v, task.room_id)}>
                                                    <SelectTrigger className={`h-8 text-xs font-medium w-32 ${task.status === 'completed' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : task.status === 'in_progress' ? 'border-blue-200 text-blue-700 bg-blue-50' : ''}`}>
                                                        <div className="flex items-center gap-2">
                                                            {statusIcon(task.status)}
                                                            <span className="capitalize">{task.status.replace('_', ' ')}</span>
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                                        <SelectItem value="completed">Completed</SelectItem>
                                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="h-8 w-8 text-slate-400 hover:text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Assign Housekeeping Task</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Room *</Label>
                            <Select value={form.room_id} onValueChange={v => setForm({ ...form, room_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                                <SelectContent className="max-h-64">
                                    {rooms.map(r => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.room_number} <span className="text-slate-400 text-xs ml-2">({r.room_type?.name} - {r.status})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Task Type *</Label>
                                <Select value={form.task_type} onValueChange={(v: any) => setForm({ ...form, task_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cleaning">Cleaning</SelectItem>
                                        <SelectItem value="inspection">Inspection</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="turndown">Turndown</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Priority *</Label>
                                <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Assignee</Label>
                            <Select value={form.assigned_to || 'unassigned'} onValueChange={v => setForm({ ...form, assigned_to: v === 'unassigned' ? null : v })}>
                                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned (Open list)</SelectItem>
                                    {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Special requests, deep clean needed..." />
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={formLoading || !form.room_id} className="bg-indigo-600 hover:bg-indigo-700">
                                {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Task
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
