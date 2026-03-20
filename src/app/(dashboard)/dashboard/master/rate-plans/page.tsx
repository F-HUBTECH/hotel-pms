'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRatePlans, createRatePlan, updateRatePlan } from '@/lib/actions/rate-plans'
import { getRoomTypes } from '@/lib/actions/room-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, Search, Loader2, Edit, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function RatePlansPage() {
    const [data, setData] = useState<any[]>([])
    const [roomTypes, setRoomTypes] = useState<any[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    const [formOpen, setFormOpen] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [form, setForm] = useState({ name: '', room_type_id: '', base_price: 0, refundable: true, cancellation_policy: '', is_active: true })
    const pageSize = 10

    const fetchData = useCallback(async () => {
        setLoading(true)
        const [ratesRes, rtRes] = await Promise.all([
            getRatePlans(page, pageSize, search),
            getRoomTypes(1, 100, '') // get all active RTs
        ])
        if (ratesRes.success) { setData(ratesRes.data); setTotal(ratesRes.count) }
        if (rtRes && rtRes.data) { setRoomTypes(rtRes.data) }
        setLoading(false)
    }, [page, search])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setPage(1) }, [search])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormLoading(true)
        const res = await createRatePlan(form)
        setFormLoading(false)
        if (res.success) {
            toast.success('Rate Plan created')
            setFormOpen(false)
            fetchData()
        } else {
            toast.error(res.error || 'Creation failed')
        }
    }

    const openCreate = () => {
        setForm({ name: '', room_type_id: '', base_price: 0, refundable: true, cancellation_policy: '', is_active: true })
        setFormOpen(true)
    }

    const totalPages = Math.ceil(total / pageSize)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Rate Plans</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage room pricing, seasons, and weekday variations</p>
                </div>
                <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" />Add Rate Plan
                </Button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search rate plans..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b bg-slate-50/80">
                                <th className="p-4 font-semibold text-slate-600">Plan Name</th>
                                <th className="p-4 font-semibold text-slate-600">Room Type</th>
                                <th className="p-4 font-semibold text-slate-600 text-right">Base Price</th>
                                <th className="p-4 font-semibold text-slate-600">Status</th>
                                <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400">No rate plans configured</td></tr>
                            ) : (
                                data.map(plan => (
                                    <tr key={plan.id} className="border-b hover:bg-slate-50/50">
                                        <td className="p-4 font-medium text-slate-800">{plan.name}</td>
                                        <td className="p-4 text-slate-600">{plan.room_type?.name}</td>
                                        <td className="p-4 text-right font-medium text-slate-800">฿{Number(plan.base_price).toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${plan.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {plan.is_active ? 'Active' : 'Draft'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right relative">
                                            <Link href={`/dashboard/master/rate-plans/${plan.id}`}>
                                                <Button variant="outline" size="sm" className="h-8">
                                                    <Eye className="w-4 h-4 mr-1.5" /> Configure Rates
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>New Rate Plan</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Plan Name *</Label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard Flexible Rate" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Room Type *</Label>
                            <Select value={form.room_type_id} onValueChange={v => setForm({ ...form, room_type_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select Room Type" /></SelectTrigger>
                                <SelectContent>
                                    {roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Base Price (฿) *</Label>
                            <Input type="number" min={0} value={form.base_price} onChange={e => setForm({ ...form, base_price: Number(e.target.value) })} required />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <Label>Is Refundable?</Label>
                            <Switch checked={form.refundable} onCheckedChange={(v: boolean) => setForm({ ...form, refundable: v })} />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={formLoading || !form.room_type_id} className="bg-indigo-600 hover:bg-indigo-700">
                                {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
