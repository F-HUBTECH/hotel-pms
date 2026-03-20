'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getReservation, checkIn, checkOut, cancelReservation } from '@/lib/actions/reservations'
import { getFolio, postFolioTransaction, voidTransaction } from '@/lib/actions/folios'
import { getReservationPaymentsAction, processPaymentAction } from '@/lib/actions/payments'
import type { Reservation, Folio, FolioTransaction, ReservationStatus } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, LogIn, LogOut, Ban, Plus, Trash2, Loader2, CalendarDays, User, BedDouble, DollarSign, FileText, CreditCard, Printer } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

function statusBadge(status: ReservationStatus) {
    const m: Record<string, string> = {
        reserved: 'bg-blue-100 text-blue-700', checked_in: 'bg-emerald-100 text-emerald-700',
        checked_out: 'bg-slate-100 text-slate-600', cancelled: 'bg-red-100 text-red-700', no_show: 'bg-amber-100 text-amber-700',
    }
    return <Badge className={`${m[status]} text-xs`}>{status.replace('_', ' ').toUpperCase()}</Badge>
}

export default function ReservationDetailPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [reservation, setReservation] = useState<Reservation | null>(null)
    const [folio, setFolio] = useState<Folio | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [addItemOpen, setAddItemOpen] = useState(false)
    const [itemDesc, setItemDesc] = useState('')
    const [itemAmount, setItemAmount] = useState(0)
    const [itemType, setItemType] = useState<'service' | 'room_charge' | 'tax'>('service')

    // Payments
    const [payments, setPayments] = useState<any[]>([])
    const [totalPaid, setTotalPaid] = useState(0)
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [paymentLoading, setPaymentLoading] = useState(false)
    const [paymentForm, setPaymentForm] = useState({ amount: 0, payment_method: 'credit_card', reference_number: '', notes: '' })

    const fetchData = useCallback(async () => {
        setLoading(true)
        const [res, folRes, payRes] = await Promise.all([getReservation(id), getFolio(id), getReservationPaymentsAction(id)])
        setReservation(res)
        setFolio(folRes.success ? folRes.data ?? null : null)
        if (payRes.success) {
            setPayments(payRes.payments || [])
            setTotalPaid(payRes.totalPaid || 0)
        }
        setLoading(false)
    }, [id])

    useEffect(() => { fetchData() }, [fetchData])

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
    if (!reservation) return <div className="text-center py-20 text-slate-400">Reservation not found</div>

    const guest = reservation.guest as { first_name: string; last_name: string; email?: string; phone?: string } | undefined
    const room = reservation.room as { room_number: string } | undefined
    const roomType = reservation.room_type as { code: string; name: string; base_price?: number } | undefined
    const source = reservation.source as { name: string } | undefined
    const market = reservation.market as { name: string } | undefined
    const nights = Math.max(1, Math.ceil((new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / 86400000))
    const items = (folio?.items || []) as any[]

    const handleAction = async (action: 'checkin' | 'checkout' | 'cancel') => {
        setActionLoading(true)
        const result = action === 'checkin' ? await checkIn(id) : action === 'checkout' ? await checkOut(id) : await cancelReservation(id)
        setActionLoading(false)
        if (result.success) { toast.success(action === 'checkin' ? 'Checked in' : action === 'checkout' ? 'Checked out' : 'Cancelled'); fetchData() }
        else toast.error(result.error || 'Error')
    }

    const handleAddItem = async () => {
        if (!folio || !itemDesc) return
        setActionLoading(true)
        const r = await postFolioTransaction({
            folio_id: folio.id,
            tran_code: itemType === 'service' ? 'MISC' : itemType.toUpperCase(),
            description: itemDesc,
            amount: itemAmount,
            quantity: 1,
            item_date: new Date().toISOString().split('T')[0],
            reference: '',
            remark: ''
        })
        setActionLoading(false)
        if (r.success) { toast.success('Charge added'); setAddItemOpen(false); setItemDesc(''); setItemAmount(0); setItemType('service'); fetchData() }
        else toast.error(r.error || 'Error')
    }

    const handleRemoveItem = async (itemId: string) => {
        if (!folio) return
        // Void/delete transaction
        const r = await voidTransaction(itemId, 'Removed via reservation detail page')
        if (r.success) { toast.success('Transaction removed'); fetchData() } else toast.error(r.error || 'Error')
    }

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        setPaymentLoading(true)
        const res = await processPaymentAction({
            reservation_id: id,
            amount: paymentForm.amount,
            payment_method: paymentForm.payment_method as any,
            reference_number: paymentForm.reference_number,
            notes: paymentForm.notes
        })
        setPaymentLoading(false)
        if (res.success) {
            toast.success('Payment recorded successfully')
            setPaymentOpen(false)
            setPaymentForm({ amount: 0, payment_method: 'credit_card', reference_number: '', notes: '' })
            fetchData()
        } else {
            toast.error(res.error || 'Failed to process payment')
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/reservations"><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 font-mono">{reservation.reservation_number}</h1>
                            {statusBadge(reservation.status)}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Created {new Date(reservation.created_at).toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {reservation.status === 'reserved' && (
                        <Button onClick={() => handleAction('checkin')} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}Check In
                        </Button>
                    )}
                    {reservation.status === 'checked_in' && (
                        <Button onClick={() => handleAction('checkout')} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700">
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}Check Out
                        </Button>
                    )}
                    {['reserved', 'checked_in'].includes(reservation.status) && (
                        <Button variant="outline" onClick={() => handleAction('cancel')} disabled={actionLoading} className="text-red-600 hover:bg-red-50">
                            <Ban className="mr-2 h-4 w-4" />Cancel
                        </Button>
                    )}
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-blue-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Stay</p>
                                <p className="text-sm font-medium">{new Date(reservation.check_in_date).toLocaleDateString('en-GB')} → {new Date(reservation.check_out_date).toLocaleDateString('en-GB')}</p>
                                <p className="text-xs text-slate-400">{nights} night{nights > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><User className="w-5 h-5 text-violet-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Guest</p>
                                <p className="text-sm font-medium">{guest ? `${guest.first_name} ${guest.last_name}` : '-'}</p>
                                <p className="text-xs text-slate-400">{guest?.email || guest?.phone || '-'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><BedDouble className="w-5 h-5 text-amber-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Room</p>
                                <p className="text-sm font-medium">{room?.room_number || <span className="italic text-slate-400">Unassigned</span>}</p>
                                <p className="text-xs text-slate-400">{roomType?.name}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Rate</p>
                                <p className="text-sm font-medium">฿{Number(reservation.rate).toLocaleString()}/night</p>
                                <p className="text-xs text-slate-400">{reservation.adults}A {reservation.children > 0 ? `${reservation.children}C` : ''} • {source?.name || '-'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {reservation.notes && (
                <Card><CardContent className="p-4"><p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Notes:</span> {reservation.notes}</p></CardContent></Card>
            )}

            {/* Folio Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Folio / Billing</CardTitle>
                    <div className="flex gap-2">
                        {folio && (
                            <Link href={`/dashboard/reservations/${id}/invoice`}>
                                <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"><Printer className="mr-2 h-4 w-4" />Print Folio</Button>
                            </Link>
                        )}
                        {folio && folio.status === 'open' && (
                            <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)}><Plus className="mr-1 h-3 w-3" />Add Charge</Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!folio ? (
                        <p className="text-slate-400 text-sm">No folio created yet</p>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-4">
                                <Badge variant={folio.status === 'open' ? 'default' : 'secondary'}>{folio.status.toUpperCase()}</Badge>
                                <span className="text-2xl font-bold text-slate-800">Balance: ฿{Number(folio.balance || folio.total_amount).toLocaleString()}</span>
                            </div>
                            <Separator className="mb-4" />
                            {items.length === 0 ? (
                                <p className="text-sm text-slate-400 py-4 text-center">No transactions yet</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b"><th className="text-left p-2 text-slate-500">Date</th><th className="text-left p-2 text-slate-500">Type</th><th className="text-left p-2 text-slate-500">Description</th><th className="text-right p-2 text-slate-500">Debit (฿)</th><th className="text-right p-2 text-slate-500">Credit (฿)</th><th className="w-10"></th></tr></thead>
                                    <tbody>
                                        {items.map((item: any) => (
                                            <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-2 text-slate-400 text-xs">{new Date(item.posted_at || item.item_date).toLocaleString('en-GB')}</td>
                                                <td className="p-2 text-slate-700 capitalize">{(item.transaction_type || 'Custom').replace('_', ' ')}</td>
                                                <td className="p-2 text-slate-700">{item.description}</td>
                                                <td className="p-2 text-right font-medium text-slate-700">{Number(item.debit || item.amount).toLocaleString()}</td>
                                                <td className="p-2 text-right font-medium text-emerald-600">{Number(item.credit || 0).toLocaleString()}</td>
                                                <td className="p-2">{folio.status === 'open' && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500" onClick={() => handleRemoveItem(item.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2">
                                            <td colSpan={3} className="p-2 text-right font-medium text-slate-500">Total Charges / Payments</td>
                                            <td className="p-2 text-right font-bold text-slate-700">฿{items.reduce((sum, i: any) => sum + Number(i.debit || i.amount || 0), 0).toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold text-emerald-600">฿{items.reduce((sum, i: any) => sum + Number(i.credit || 0), 0).toLocaleString()}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Add item dialog */}
            <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Type *</Label>
                            <Select value={itemType} onValueChange={(v: any) => setItemType(v)}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="service">Service / POS</SelectItem>
                                    <SelectItem value="room_charge">Room Charge</SelectItem>
                                    <SelectItem value="tax">Tax Adjustment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Description *</Label><Input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder="e.g. Mini bar, Laundry..." /></div>
                        <div className="space-y-2"><Label>Amount (฿)</Label><Input type="number" min={0} value={itemAmount} onChange={(e) => setItemAmount(Number(e.target.value))} /></div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddItem} disabled={actionLoading || !itemDesc} className="bg-indigo-600 hover:bg-indigo-700">
                                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Charge
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payments Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Payments</CardTitle>
                    <Button size="sm" onClick={() => setPaymentOpen(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-1 h-3 w-3" />Record Payment</Button>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-sm text-slate-500">Total Paid:</span>
                        <span className="text-xl font-bold text-emerald-600">฿{Number(totalPaid).toLocaleString()}</span>
                    </div>
                    {payments.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">No payments recorded</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead><tr className="border-b"><th className="text-left p-2 text-slate-500">Date</th><th className="text-left p-2 text-slate-500">Method</th><th className="text-left p-2 text-slate-500">Reference</th><th className="text-right p-2 text-slate-500">Amount</th></tr></thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id} className="border-b last:border-0">
                                        <td className="p-2 text-slate-400 text-xs">{new Date(p.created_at).toLocaleString('en-GB')}</td>
                                        <td className="p-2 text-slate-700 capitalize">{p.payment_method.replace('_', ' ')}</td>
                                        <td className="p-2 text-slate-500">{p.reference_number || '-'}</td>
                                        <td className="p-2 text-right font-medium text-emerald-600">฿{Number(p.amount).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {/* Record Payment dialog */}
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                    <form onSubmit={handleRecordPayment} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Amount (฿) *</Label>
                            <Input type="number" min={1} step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Method *</Label>
                            <Select value={paymentForm.payment_method} onValueChange={(v: any) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="credit_card">Credit Card</SelectItem>
                                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Reference Number</Label>
                            <Input value={paymentForm.reference_number} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} placeholder="Transaction ID, Cheque No..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={paymentLoading || !paymentForm.amount} className="bg-emerald-600 hover:bg-emerald-700">
                                {paymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Process Payment
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
