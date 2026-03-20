'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getRatePlanDetails, updateRatePlan, addSeasonalRate, deleteSeasonalRate, saveWeekdayRate, deleteWeekdayRate } from '@/lib/actions/rate-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Save, Plus, Trash2, Loader2, CalendarRange, CalendarDays, Receipt } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function RatePlanDetailPage() {
    const params = useParams()
    const id = params.id as string
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [plan, setPlan] = useState<any>(null)
    const [seasonalRates, setSeasonalRates] = useState<any[]>([])
    const [weekdayRates, setWeekdayRates] = useState<any[]>([])

    // Modal states
    const [seasonalOpen, setSeasonalOpen] = useState(false)
    const [seasonalForm, setSeasonalForm] = useState({ start_date: '', end_date: '', price: 0 })

    const [weekdayOpen, setWeekdayOpen] = useState(false)
    const [weekdayForm, setWeekdayForm] = useState({ weekday: 0, price: 0 })

    const fetchData = useCallback(async () => {
        setLoading(true)
        const res = await getRatePlanDetails(id)
        if (res.success) {
            setPlan(res.data)
            setSeasonalRates(res.seasonalRates || [])
            setWeekdayRates(res.weekdayRates || [])
        } else {
            toast.error('Failed to load rate plan')
            router.push('/dashboard/master/rate-plans')
        }
        setLoading(false)
    }, [id, router])

    useEffect(() => { fetchData() }, [fetchData])

    const handleSavePlan = async () => {
        setSaving(true)
        const res = await updateRatePlan(id, {
            name: plan.name,
            room_type_id: plan.room_type_id,
            base_price: plan.base_price,
            refundable: plan.refundable,
            cancellation_policy: plan.cancellation_policy || '',
            is_active: plan.is_active
        })
        setSaving(false)
        if (res.success) toast.success('Saved successfully')
        else toast.error(res.error || 'Failed to save')
    }

    const handleAddSeasonal = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await addSeasonalRate({ ...seasonalForm, rate_plan_id: id })
        if (res.success) {
            toast.success('Seasonal rate added')
            setSeasonalOpen(false)
            fetchData()
        } else toast.error(res.error || 'Error adding rate')
    }

    const handleSaveWeekday = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await saveWeekdayRate({ ...weekdayForm, rate_plan_id: id })
        if (res.success) {
            toast.success('Weekday rate saved')
            setWeekdayOpen(false)
            fetchData()
        } else toast.error(res.error || 'Error saving rate')
    }

    const handleDelSeasonal = async (sid: string) => {
        const res = await deleteSeasonalRate(sid, id)
        if (res.success) { toast.success('Deleted'); fetchData() }
    }

    const handleDelWeekday = async (wid: string) => {
        const res = await deleteWeekdayRate(wid, id)
        if (res.success) { toast.success('Deleted'); fetchData() }
    }

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
    if (!plan) return null

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/master/rate-plans"><Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
                    <div><h1 className="text-2xl font-bold text-slate-900">{plan.name}</h1><p className="text-sm text-slate-500 mt-1">{plan.room_type?.name} Setup</p></div>
                </div>
                <Button onClick={handleSavePlan} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Configuration */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Base Setup</CardTitle>
                        <CardDescription>General settings and base price fallback</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2"><Label>Plan Name</Label><Input value={plan.name} onChange={e => setPlan({ ...plan, name: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Base Price (฿)</Label><Input type="number" value={plan.base_price} onChange={e => setPlan({ ...plan, base_price: Number(e.target.value) })} /></div>
                        <div className="flex items-center justify-between pt-2 border-t mt-4"><Label>Active</Label><Switch checked={plan.is_active} onCheckedChange={(v: boolean) => setPlan({ ...plan, is_active: v })} /></div>
                        <div className="flex items-center justify-between"><Label>Refundable</Label><Switch checked={plan.refundable} onCheckedChange={(v: boolean) => setPlan({ ...plan, refundable: v })} /></div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-6">
                    {/* Seasonal Rates */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div><CardTitle className="flex items-center gap-2"><CalendarRange className="w-5 h-5" /> Seasonal Rates</CardTitle><CardDescription>Overrides base and weekday prices</CardDescription></div>
                            <Button size="sm" variant="outline" onClick={() => { setSeasonalForm({ start_date: '', end_date: '', price: plan.base_price }); setSeasonalOpen(true) }}><Plus className="w-4 h-4 mr-1" /> Add Season</Button>
                        </CardHeader>
                        <CardContent>
                            {seasonalRates.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No seasonal overrides configured</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b"><th className="text-left py-2">Start Date</th><th className="text-left py-2">End Date</th><th className="text-right py-2">Price</th><th className="w-10"></th></tr></thead>
                                    <tbody>
                                        {seasonalRates.map(s => (
                                            <tr key={s.id} className="border-b last:border-0"><td className="py-2">{new Date(s.start_date).toLocaleDateString('en-GB')}</td><td className="py-2">{new Date(s.end_date).toLocaleDateString('en-GB')}</td><td className="py-2 text-right font-medium text-emerald-600">฿{Number(s.price).toLocaleString()}</td><td className="py-2"><Button variant="ghost" size="icon" onClick={() => handleDelSeasonal(s.id)} className="h-6 w-6 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></Button></td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Weekday Rates */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div><CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Weekday Rates</CardTitle><CardDescription>Overrides base price by day of week</CardDescription></div>
                            <Button size="sm" variant="outline" onClick={() => { setWeekdayForm({ weekday: 5, price: plan.base_price }); setWeekdayOpen(true) }}><Plus className="w-4 h-4 mr-1" /> Override Day</Button>
                        </CardHeader>
                        <CardContent>
                            {weekdayRates.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No weekday overrides configured</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b"><th className="text-left py-2">Day of Week</th><th className="text-right py-2">Price</th><th className="w-10"></th></tr></thead>
                                    <tbody>
                                        {weekdayRates.map(w => (
                                            <tr key={w.id} className="border-b last:border-0"><td className="py-2 font-medium">{WEEKDAYS[w.weekday]}</td><td className="py-2 text-right font-medium text-indigo-600">฿{Number(w.price).toLocaleString()}</td><td className="py-2"><Button variant="ghost" size="icon" onClick={() => handleDelWeekday(w.id)} className="h-6 w-6 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></Button></td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Seasonal Modal */}
            <Dialog open={seasonalOpen} onOpenChange={setSeasonalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Add Seasonal Override</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddSeasonal} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={seasonalForm.start_date} onChange={e => setSeasonalForm({ ...seasonalForm, start_date: e.target.value })} required /></div>
                            <div className="space-y-2"><Label>End Date</Label><Input type="date" value={seasonalForm.end_date} onChange={e => setSeasonalForm({ ...seasonalForm, end_date: e.target.value })} required /></div>
                        </div>
                        <div className="space-y-2"><Label>Override Price (฿)</Label><Input type="number" min={0} value={seasonalForm.price} onChange={e => setSeasonalForm({ ...seasonalForm, price: Number(e.target.value) })} required /></div>
                        <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => setSeasonalOpen(false)}>Cancel</Button><Button type="submit">Save Phase</Button></div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Weekday Modal */}
            <Dialog open={weekdayOpen} onOpenChange={setWeekdayOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Override Weekday Price</DialogTitle></DialogHeader>
                    <form onSubmit={handleSaveWeekday} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Day of Week</Label>
                            <Select value={weekdayForm.weekday.toString()} onValueChange={v => setWeekdayForm({ ...weekdayForm, weekday: Number(v) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{WEEKDAYS.map((day, i) => <SelectItem key={i} value={i.toString()}>{day}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Override Price (฿)</Label><Input type="number" min={0} value={weekdayForm.price} onChange={e => setWeekdayForm({ ...weekdayForm, price: Number(e.target.value) })} required /></div>
                        <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => setWeekdayOpen(false)}>Cancel</Button><Button type="submit">Save Override</Button></div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
