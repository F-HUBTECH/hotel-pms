'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getReservation, checkIn, checkOut, cancelReservation, splitRooms, splitRoomsAuto } from '@/lib/actions/reservations'
import { checkAvailability } from '@/lib/actions/reservations'
import { formatDateShort } from '@/lib/utils/date'
import { getFolio, postFolioTransaction, voidTransaction } from '@/lib/actions/folios'
import { getReservationPaymentsAction, processPaymentAction } from '@/lib/actions/payments'
import type { Reservation, Folio, FolioTransaction, ReservationStatus, Room } from '@/lib/types/database'
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

    // Split Rooms
    const [splitOpen, setSplitOpen] = useState(false)
    const [splitLoading, setSplitLoading] = useState(false)
    const [availableRooms, setAvailableRooms] = useState<Room[]>([])
    const [selectedRooms, setSelectedRooms] = useState<string[]>([])

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

    if (loading) return (
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse" role="status" aria-label="Loading reservation details">
            <span className="sr-only">Loading reservation details...</span>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-md bg-slate-100" />
                    <div>
                        <div className="h-7 w-32 bg-slate-100 rounded" />
                        <div className="h-4 w-48 bg-slate-50 rounded mt-2" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-24 bg-slate-100 rounded-md" />
                    <div className="h-9 w-24 bg-slate-100 rounded-md" />
                    <div className="h-9 w-28 bg-slate-100 rounded-md" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-50" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-12 bg-slate-50 rounded" />
                                <div className="h-4 w-24 bg-slate-100 rounded" />
                                <div className="h-3 w-16 bg-slate-50 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-6 rounded-lg border bg-white space-y-4">
                <div className="h-5 w-32 bg-slate-100 rounded" />
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-10 w-full bg-slate-50 rounded" />
                    ))}
                </div>
            </div>
        </div>
    )
    if (!reservation) return (
        <div className="text-center py-20">
            <p className="text-slate-600 font-medium">Reservation not found</p>
            <p className="text-sm text-slate-600 mt-1">The reservation may have been deleted or the ID is incorrect.</p>
            <Link href="/dashboard/reservations" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary hover:text-primary/80">
                <ArrowLeft className="h-4 w-4" />Back to Reservations
            </Link>
        </div>
    )

    const guest = reservation.guest as { first_name: string; last_name: string; email?: string; phone?: string } | undefined
    const room = reservation.room as { room_number: string } | undefined
    const roomType = reservation.room_type as { code: string; name: string; base_price?: number } | undefined
    const source = reservation.source as { name: string } | undefined
    const market = reservation.market as { name: string } | undefined
    const agent = (reservation as any).agent as { name: string; company_type?: string } | undefined
    const company = (reservation as any).company as { name: string; company_type?: string } | undefined
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

    const fetchAvailableRooms = async () => {
        if (!reservation) return
        const rooms = await checkAvailability(
            reservation.check_in_date,
            reservation.check_out_date,
            reservation.room_type_id
        )
        setAvailableRooms(rooms)
        setSelectedRooms([])
    }

    const handleSplitRooms = async () => {
        if (!reservation || selectedRooms.length === 0) return
        setSplitLoading(true)
        
        // Include the current room if already assigned
        const currentRoomId = reservation.room_id
        const allRoomIds = currentRoomId 
            ? [currentRoomId, ...selectedRooms] 
            : selectedRooms
        
        const result = await splitRooms(reservation.id, allRoomIds)
        setSplitLoading(false)
        
        if (result.success) {
            toast.success(`Split into ${allRoomIds.length} rooms`)
            setSplitOpen(false)
            fetchData()
            router.push('/dashboard/reservations')
        } else {
            toast.error(result.error || 'Failed to split rooms')
        }
    }

    const handleSplitRoomsAuto = async () => {
        if (!reservation) return
        setSplitLoading(true)
        const result = await splitRoomsAuto(reservation.id)
        setSplitLoading(false)
        
        if (result.success) {
            toast.success('Rooms split automatically')
            setSplitOpen(false)
            fetchData()
        } else {
            toast.error(result.error || 'Failed to split rooms automatically')
        }
    }

    const toggleRoomSelection = (roomId: string) => {
        setSelectedRooms(prev => 
            prev.includes(roomId) 
                ? prev.filter(id => id !== roomId)
                : [...prev, roomId]
        )
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/reservations"><Button variant="outline" size="icon" aria-label="Back to reservations"><ArrowLeft className="h-4 w-4" /></Button></Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 font-mono">{reservation.reservation_number}</h1>
                            {statusBadge(reservation.status)}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">Created {new Date(reservation.created_at).toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {reservation.status === 'reserved' && (
                        <Button onClick={() => handleAction('checkin')} disabled={actionLoading} className="bg-success hover:bg-success/90 text-success-foreground">
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}Check In
                        </Button>
                    )}
                    {reservation.status === 'checked_in' && (
                        <Button onClick={() => handleAction('checkout')} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}Check Out
                        </Button>
                    )}
                    {['reserved', 'checked_in'].includes(reservation.status) && (
                        <Button variant="destructive" onClick={() => handleAction('cancel')} disabled={actionLoading}>
                            <Ban className="mr-2 h-4 w-4" />Cancel
                        </Button>
                    )}
                    {reservation.status === 'reserved' && (reservation.room_qty || 1) >= 1 && (
                        <Button variant="outline" onClick={() => { setSplitOpen(true); fetchAvailableRooms() }} className="text-violet-600 border-violet-200 hover:bg-violet-50">
                            <BedDouble className="mr-2 h-4 w-4" />Split Rooms
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
                                <p className="text-xs text-slate-600">Stay</p>
                                <p className="text-sm font-medium">{formatDateShort(reservation.check_in_date)} → {formatDateShort(reservation.check_out_date)}</p>
                                <p className="text-xs text-slate-600">{nights} night{nights > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><User className="w-5 h-5 text-violet-600" /></div>
                            <div>
                                <p className="text-xs text-slate-600">Guest</p>
                                <p className="text-sm font-medium">{guest ? `${guest.first_name} ${guest.last_name}` : '-'}</p>
                                <p className="text-xs text-slate-600">{guest?.email || guest?.phone || '-'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><BedDouble className="w-5 h-5 text-amber-600" /></div>
                            <div>
                                <p className="text-xs text-slate-600">Room</p>
                                <p className="text-sm font-medium">{room?.room_number || <span className="italic text-slate-500">Unassigned</span>}</p>
                                <p className="text-xs text-slate-600">{roomType?.name}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                            <div>
                                <p className="text-xs text-slate-600">Rate</p>
                                <p className="text-sm font-medium">฿{Number(reservation.rate).toLocaleString()}/night</p>
                                <p className="text-xs text-slate-600">{reservation.adults}A {reservation.children > 0 ? `${reservation.children}C` : ''} • {source?.name || '-'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Agent / Company / VIP / Flight Info */}
            {(agent || company || reservation.vip_level || reservation.arrival_flight || reservation.departure_flight) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {agent && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center"><User className="w-5 h-5 text-cyan-600" /></div>
                                    <div>
                                        <p className="text-xs text-slate-600">Travel Agent</p>
                                        <p className="text-sm font-medium">{agent.name}</p>
                                        <p className="text-xs text-slate-600">{agent.company_type || 'agent'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {company && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center"><User className="w-5 h-5 text-indigo-600" /></div>
                                    <div>
                                        <p className="text-xs text-slate-600">Company</p>
                                        <p className="text-sm font-medium">{company.name}</p>
                                        <p className="text-xs text-slate-600">{company.company_type || 'company'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {reservation.vip_level && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${reservation.vip_level === 'VVIP' ? 'bg-amber-100' : reservation.vip_level === 'VIP' ? 'bg-yellow-100' : 'bg-slate-100'}`}>
                                        <span className="text-lg font-bold">★</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-600">VIP Level</p>
                                        <p className="text-sm font-bold">{reservation.vip_level}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {(reservation.arrival_flight || reservation.departure_flight) && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-sky-600" /></div>
                                    <div>
                                        <p className="text-xs text-slate-600">Flights</p>
                                        {reservation.arrival_flight && <p className="text-xs text-slate-700">↑ {reservation.arrival_flight}{reservation.arrival_time ? ` ${reservation.arrival_time}` : ''}</p>}
                                        {reservation.departure_flight && <p className="text-xs text-slate-700">↓ {reservation.departure_flight}{reservation.departure_time ? ` ${reservation.departure_time}` : ''}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

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
                                <Button size="sm" variant="outline" className="text-primary border-primary/20 hover:bg-primary/5"><Printer className="mr-2 h-4 w-4" />Print Folio</Button>
                            </Link>
                        )}
                        {folio && folio.status === 'open' && (
                            <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)}><Plus className="mr-1 h-3 w-3" />Add Charge</Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!folio ? (
                        <p className="text-slate-500 text-sm">No folio created yet</p>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-4">
                                <Badge variant={folio.status === 'open' ? 'default' : 'secondary'}>{folio.status.toUpperCase()}</Badge>
                                <span className="text-sm text-slate-600">Total Charges:</span>
                                <span className="text-lg font-semibold text-slate-800">฿{Number(folio.total_amount || 0).toLocaleString()}</span>
                                <span className="text-sm text-slate-600 ml-4">Balance Due:</span>
                                <span className={`text-lg font-bold ${Number(folio.balance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>฿{Number(folio.balance || 0).toLocaleString()}</span>
                            </div>
                            <Separator className="mb-4" />
                            {items.length === 0 ? (
                                <p className="text-sm text-slate-600 py-4 text-center">No transactions yet</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b"><th scope="col" className="text-left p-2 text-slate-500">Date</th><th scope="col" className="text-left p-2 text-slate-500">Type</th><th scope="col" className="text-left p-2 text-slate-500">Description</th><th scope="col" className="text-right p-2 text-slate-500">Debit (฿)</th><th scope="col" className="text-right p-2 text-slate-500">Credit (฿)</th><th scope="col" className="w-10"></th></tr></thead>
                                    <tbody>
                                        {items.map((item: any) => (
                                            <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-2 text-slate-500 text-xs">{new Date(item.posted_at || item.item_date).toLocaleString('en-GB')}</td>
                                                <td className="p-2 text-slate-700 capitalize">{(item.transaction_type || 'Custom').replace('_', ' ')}</td>
                                                <td className="p-2 text-slate-700">{item.description}</td>
                                                <td className="p-2 text-right font-medium text-slate-700">{Number(item.debit || item.amount).toLocaleString()}</td>
                                                <td className="p-2 text-right font-medium text-emerald-600">{Number(item.credit || 0).toLocaleString()}</td>
                                                <td className="p-2">{folio.status === 'open' && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" aria-label={`Remove ${item.description || 'transaction'}`} onClick={() => handleRemoveItem(item.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2">
                                            <td colSpan={3} className="p-2 text-right font-medium text-slate-600">Total Charges / Payments</td>
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
                            <Button onClick={handleAddItem} disabled={actionLoading || !itemDesc}>
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
                    <Button size="sm" onClick={() => setPaymentOpen(true)} className="bg-success hover:bg-success/90 text-success-foreground"><Plus className="mr-1 h-3 w-3" />Record Payment</Button>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-sm text-slate-600">Total Paid:</span>
                        <span className="text-xl font-bold text-emerald-600">฿{Number(totalPaid).toLocaleString()}</span>
                    </div>
                    {payments.length === 0 ? (
                        <p className="text-sm text-slate-600 py-4 text-center">No payments recorded</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead><tr className="border-b"><th scope="col" className="text-left p-2 text-slate-500">Date</th><th scope="col" className="text-left p-2 text-slate-500">Method</th><th scope="col" className="text-left p-2 text-slate-500">Reference</th><th scope="col" className="text-right p-2 text-slate-500">Amount</th></tr></thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id} className="border-b last:border-0">
                                        <td className="p-2 text-slate-500 text-xs">{new Date(p.created_at).toLocaleString('en-GB')}</td>
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
                            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} disabled={paymentLoading}>Cancel</Button>
                            <Button type="submit" disabled={paymentLoading || !paymentForm.amount} className="bg-success hover:bg-success/90 text-success-foreground">
                                {paymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Process Payment
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Split Rooms Dialog */}
            <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Split Rooms</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            This reservation will be split into multiple rooms. Select the additional rooms below.
                        </p>
                        
                        <div className="flex gap-2">
                            <Button onClick={handleSplitRoomsAuto} disabled={splitLoading} variant="outline" className="flex-1">
                                <BedDouble className="mr-2 h-4 w-4" />
                                Auto Split (Auto-assign rooms)
                            </Button>
                        </div>
                        
                        <div className="text-sm text-slate-600 text-center">- OR -</div>
                        
                        <div className="space-y-2">
                            <Label>Select Additional Rooms ({selectedRooms.length} selected)</Label>
                            <div className="border rounded-md max-h-60 overflow-y-auto">
                                {availableRooms.length > 0 ? (
                                    availableRooms.map(room => (
                                        <div 
                                            key={room.id} 
                                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 ${selectedRooms.includes(room.id) ? 'bg-violet-50' : ''}`}
                                            onClick={() => toggleRoomSelection(room.id)}
                                        >
                                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${selectedRooms.includes(room.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                                                {selectedRooms.includes(room.id) && (
                                                    <span className="text-white text-xs">✓</span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{room.room_number}</p>
                                                <p className="text-xs text-slate-600">{(room as any).room_type?.name || 'Room'}</p>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {(room as any).status || 'available'}
                                            </Badge>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-slate-500">
                                        No available rooms for selected dates
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm text-slate-600">Total Rooms:</span>
                            <span className="font-bold text-lg">{(reservation.room_id ? 1 : 0) + selectedRooms.length}</span>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
                            <Button
                                onClick={handleSplitRooms}
                                disabled={splitLoading || selectedRooms.length === 0}
                            >
                                {splitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Split Rooms
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
