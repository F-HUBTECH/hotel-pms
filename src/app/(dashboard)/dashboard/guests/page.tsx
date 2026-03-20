'use client'

import { useState, useEffect, useCallback } from 'react'
import { getGuests, createGuest, updateGuest, deleteGuest } from '@/lib/actions/guests'
import type { Guest } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Plus, Pencil, Trash2, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

export default function GuestsPage() {
    const [data, setData] = useState<Guest[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [mode, setMode] = useState<'create' | 'edit'>('create')
    const [editing, setEditing] = useState<Guest | null>(null)
    const [delOpen, setDelOpen] = useState(false)
    const [deleting, setDeleting] = useState<Guest | null>(null)
    const [formLoading, setFormLoading] = useState(false)
    const [formError, setFormError] = useState('')
    const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', passport_number: '', address: '' })
    const pageSize = 10

    const fetchData = useCallback(async () => {
        setLoading(true)
        const r = await getGuests(page, pageSize, search)
        setData(r.data); setTotal(r.count); setLoading(false)
    }, [page, search])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setPage(1) }, [search])

    const openCreate = () => { setMode('create'); setEditing(null); setForm({ first_name: '', last_name: '', phone: '', email: '', passport_number: '', address: '' }); setFormError(''); setFormOpen(true) }
    const openEdit = (g: Guest) => { setMode('edit'); setEditing(g); setForm({ first_name: g.first_name, last_name: g.last_name, phone: g.phone, email: g.email, passport_number: g.passport_number, address: g.address }); setFormError(''); setFormOpen(true) }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setFormLoading(true); setFormError('')
        const r = mode === 'create' ? await createGuest(form) : await updateGuest(editing!.id, form)
        setFormLoading(false)
        if (r.success) { toast.success(mode === 'create' ? 'Guest created' : 'Guest updated'); setFormOpen(false); fetchData() }
        else setFormError(r.error || 'Error')
    }

    const handleDelete = async () => {
        if (!deleting) return
        const r = await deleteGuest(deleting.id)
        if (r.success) { toast.success('Deleted'); fetchData() } else toast.error(r.error!)
    }

    const totalPages = Math.ceil(total / pageSize)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold text-slate-900">Guests</h1><p className="text-sm text-slate-500 mt-1">Guest registry</p></div>
                <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" />Add Guest</Button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search guests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>

            <Card className="border-slate-200">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b bg-slate-50/80">
                                <th className="text-left p-4 font-semibold text-slate-600">Name</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Contact</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Passport</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Actions</th>
                            </tr></thead>
                            <tbody>
                                {loading ? Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b">{Array.from({ length: 4 }).map((_, j) => <td key={j} className="p-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
                                )) : data.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-slate-400">No guests found</td></tr>
                                ) : data.map(g => (
                                    <tr key={g.id} className="border-b hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4"><div className="font-medium text-slate-800">{g.first_name} {g.last_name}</div></td>
                                        <td className="p-4"><div className="text-slate-600">{g.email || '-'}</div><div className="text-xs text-slate-400">{g.phone}</div></td>
                                        <td className="p-4 text-slate-600">{g.passport_number || '-'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => { setDeleting(g); setDelOpen(true) }}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <p className="text-sm text-slate-500">Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total}</p>
                            <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{mode === 'create' ? 'Add Guest' : 'Edit Guest'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                        {formError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{formError}</div>}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
                            <div className="space-y-2"><Label>Last Name *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
                            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                        </div>
                        <div className="space-y-2"><Label>Passport Number</Label><Input value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={formLoading}>Cancel</Button>
                            <Button type="submit" disabled={formLoading} className="bg-indigo-600 hover:bg-indigo-700">{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'create' ? 'Create' : 'Save'}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title="Delete Guest" description={`Delete "${deleting?.first_name} ${deleting?.last_name}"?`} onConfirm={handleDelete} />
        </div>
    )
}
