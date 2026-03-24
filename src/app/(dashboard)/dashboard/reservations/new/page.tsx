'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { checkAvailability, createReservation } from '@/lib/actions/reservations'
import { searchGuests, createGuest } from '@/lib/actions/guests'
import { getCorporateAllotments, checkAllotmentAvailability, pickFromAllotment } from '@/lib/actions/allotments'
import type { Room, Guest, RoomType, BookingSource, Market } from '@/lib/types/database'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ArrowLeft, ArrowRight, Search, Plus, Loader2, Check, BedDouble, CalendarDays, User, CreditCard, Building2 } from 'lucide-react'
import { ReturnGuestBadge } from '@/components/return-guest-badge'
import { toast } from 'sonner'

const STEPS = ['Dates & Room', 'Select Room', 'Guest Info', 'Confirm']

export default function NewBookingPage() {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)

    // Step 1: Dates & Room Type
    const [checkIn, setCheckIn] = useState('')
    const [checkOut, setCheckOut] = useState('')
    const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('')
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([])

    // Step 2: Room Selection
    const [availableRooms, setAvailableRooms] = useState<Room[]>([])
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
    const [searchingRooms, setSearchingRooms] = useState(false)

    // Step 3: Guest
    const [guestSearch, setGuestSearch] = useState('')
    const [guestResults, setGuestResults] = useState<Guest[]>([])
    const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
    const [showNewGuest, setShowNewGuest] = useState(false)
    const [newGuest, setNewGuest] = useState({ first_name: '', last_name: '', phone: '', email: '' })

    // Booking details
    const [adults, setAdults] = useState(1)
    const [children, setChildren] = useState(0)
    const [rate, setRate] = useState(0)
    const [sourceId, setSourceId] = useState('')
    const [marketId, setMarketId] = useState('')
    const [agentId, setAgentId] = useState('')
    const [companyId, setCompanyId] = useState('')
    const [vipLevel, setVipLevel] = useState('')
    const [arrivalFlight, setArrivalFlight] = useState('')
    const [arrivalTime, setArrivalTime] = useState('')
    const [departureFlight, setDepartureFlight] = useState('')
    const [departureTime, setDepartureTime] = useState('')
    const [notes, setNotes] = useState('')
    const [sources, setSources] = useState<BookingSource[]>([])
    const [markets, setMarkets] = useState<Market[]>([])
    const [companies, setCompanies] = useState<any[]>([])
    const [paymentCodes, setPaymentCodes] = useState<{code: string, description: string}[]>([])

    const [calculatingRate, setCalculatingRate] = useState(false)
    const [ratePlans, setRatePlans] = useState<any[]>([])
    const [selectedRatePlanId, setSelectedRatePlanId] = useState('')
    const [totalEstimate, setTotalEstimate] = useState(0)

    // Allotment
    const [allotments, setAllotments] = useState<any[]>([])
    const [selectedAllotment, setSelectedAllotment] = useState<any>(null)
    const [availableAllotments, setAvailableAllotments] = useState<any[]>([])
    const [allotmentDialogOpen, setAllotmentDialogOpen] = useState(false)
    const [checkingAllotment, setCheckingAllotment] = useState(false)

    // Deposit / Advance Payment
    const [collectDeposit, setCollectDeposit] = useState(false)
    const [depositAmount, setDepositAmount] = useState(0)
    const [depositMethod, setDepositMethod] = useState('CASH')
    const [depositRef, setDepositRef] = useState('')

    // Load lookup data
    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        supabase.from('room_types').select('*').order('name').then(({ data }) => setRoomTypes((data || []) as RoomType[]))
        supabase.from('booking_sources').select('*').order('name').then(({ data }) => setSources((data || []) as BookingSource[]))
        supabase.from('markets').select('*').order('name').then(({ data }) => setMarkets((data || []) as Market[]))
        supabase.from('companies').select('*').order('name').then(({ data }) => setCompanies(data || []))
        supabase.from('revenue_transaction_codes').select('*').order('code').then(({ data }) => {
            if (data) setPaymentCodes(data)
        })
        // Load allotments
        getCorporateAllotments().then(res => {
            if (res.success) setAllotments(res.data || [])
        })
    }, [])

    // Fetch rate plans when room type changes
    useEffect(() => {
        if (!selectedRoomTypeId) {
            setRatePlans([])
            setSelectedRatePlanId('')
            return
        }
        import('@/lib/actions/rate-plans').then(m => {
            m.getActiveRatePlansForRoomType(selectedRoomTypeId).then(res => {
                if (res.success && res.data) {
                    setRatePlans(res.data)
                    if (res.data.length > 0) setSelectedRatePlanId(res.data[0].id)
                }
            })
        })
    }, [selectedRoomTypeId])

    // Calculate dynamic price when dates or rate plan change
    useEffect(() => {
        if (checkIn && checkOut && selectedRatePlanId && new Date(checkOut) > new Date(checkIn)) {
            setCalculatingRate(true)
            import('@/lib/actions/rate-plans').then(m => {
                m.calculateStayPrice(selectedRatePlanId, checkIn, checkOut).then(res => {
                    if (res.success) {
                        setRate(res.adr!)
                        setTotalEstimate(res.total!)
                    }
                    setCalculatingRate(false)
                })
            })
        } else {
            setTotalEstimate(0)
        }
    }, [checkIn, checkOut, selectedRatePlanId])

    // Check allotment availability when company/agent, dates, or room type changes
    const checkAllotmentAvailabilityForSelection = async () => {
        if (!selectedRoomTypeId || !checkIn || !checkOut) return;
        
        setCheckingAllotment(true);
        const res = await checkAllotmentAvailability(selectedRoomTypeId, checkIn, checkOut, 1);
        if (res.success && res.data) {
            // Filter by selected company/agent if applicable
            let filtered = res.data;
            if (companyId) {
                filtered = filtered.filter((a: any) => a.company_name === companies.find(c => c.id === companyId)?.name);
            }
            if (agentId) {
                filtered = filtered.filter((a: any) => a.company_name === companies.find(c => c.id === agentId)?.name);
            }
            setAvailableAllotments(filtered);
        } else {
            setAvailableAllotments([]);
        }
        setCheckingAllotment(false);
    };

    const selectAllotment = (allot: any) => {
        setSelectedAllotment(allot);
        // Apply the allotment rate
        if (allot.daily && allot.daily.length > 0) {
            const avgRate = allot.daily.reduce((sum: number, d: any) => sum + (d.total_rooms > 0 ? d.total_rooms : 0), 0);
            // Use the first day's rate or calculate average
            const firstDay = allot.daily[0];
            if (firstDay) {
                setRate(Number(firstDay.base_rate) || rate);
            }
        }
        setAllotmentDialogOpen(false);
        toast.success(`Allotment ${allot.allot_code} selected`);
    };

    const clearAllotment = () => {
        setSelectedAllotment(null);
    };

    // Search availability when moving to step 2
    const searchAvailability = async () => {
        console.log('searchAvailability clicked', { checkIn, checkOut })
        if (!checkIn || !checkOut) { toast.error('Please select dates'); return }
        
        // Normalize dates to midnight for comparison
        const checkInDate = new Date(checkIn + 'T00:00:00')
        const checkOutDate = new Date(checkOut + 'T00:00:00')
        const diffTime = checkOutDate.getTime() - checkInDate.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        console.log('Date comparison:', { checkIn, checkOut, diffDays })
        
        // Require at least 1 night stay (check-out must be after check-in)
        if (diffDays < 1) { 
            toast.error('Check-out must be at least 1 day after check-in'); 
            return 
        }
        if (!selectedRoomTypeId) { toast.error('Please select a room type'); return }

        setSearchingRooms(true)
        console.log('Calling checkAvailability with:', { checkIn, checkOut, selectedRoomTypeId })
        try {
            const rooms = await checkAvailability(checkIn, checkOut, selectedRoomTypeId)
            console.log('checkAvailability result:', rooms)
            setAvailableRooms(rooms)
            if (rooms.length === 0) {
                toast.info('No rooms available for selected dates')
            } else {
                toast.success(`${rooms.length} rooms available`)
            }
            setStep(1)
        } catch (err: any) {
            console.error('checkAvailability error:', err)
            toast.error('Error searching availability: ' + (err.message || 'Unknown error'))
        } finally {
            setSearchingRooms(false)
        }
    }

    // Search guests
    const handleGuestSearch = async () => {
        if (guestSearch.length < 2) return
        const results = await searchGuests(guestSearch)
        setGuestResults(results)
    }

    // Create new guest
    const handleCreateGuest = async () => {
        if (!newGuest.first_name || !newGuest.last_name) { toast.error('Name is required'); return }
        setLoading(true)
        const result = await createGuest(newGuest)
        setLoading(false)
        if (result.success && result.data) {
            setSelectedGuest(result.data)
            setShowNewGuest(false)
            toast.success('Guest created')
        } else {
            toast.error(result.error || 'Error')
        }
    }

    // Submit reservation
    const handleSubmit = async () => {
        console.log('handleSubmit called')
        if (!selectedGuest) { toast.error('Please select a guest'); return }
        if (!selectedRoomTypeId) { toast.error('Please select a room type'); return }
        setLoading(true)
        console.log('Creating reservation with data:', {
            guest_id: selectedGuest.id,
            room_id: selectedRoom?.id || null,
            room_type_id: selectedRoomTypeId,
            check_in_date: checkIn,
            check_out_date: checkOut,
        })
        try {
            const result = await createReservation({
                guest_id: selectedGuest.id,
                room_id: selectedRoom?.id || null,
                room_type_id: selectedRoomTypeId,
                rate_plan_id: selectedRatePlanId,
                check_in_date: checkIn,
                check_out_date: checkOut,
                adults,
                children,
                rate,
                status: 'reserved',
                source_id: sourceId || null,
                market_id: marketId || null,
                agent_id: agentId || null,
                company_id: companyId || null,
                vip_level: vipLevel || null,
                arrival_flight: arrivalFlight || null,
                arrival_time: arrivalTime || null,
                departure_flight: departureFlight || null,
                departure_time: departureTime || null,
                notes,
                allotment_code: selectedAllotment?.allot_code || null,
            })
            console.log('createReservation result:', result)
            if (result.success) {
                // Save deposit if collected
                if (collectDeposit && depositAmount > 0 && result.data?.id) {
                    const supabase = createBrowserClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                    )
                    await supabase.from('group_deposits').insert({
                        reservation_id: result.data.id,
                        tran_date: new Date().toISOString().split('T')[0],
                        tran_code: depositMethod,
                        description: 'Advance Payment - Booking Deposit',
                        amount: depositAmount,
                        original_amount: depositAmount,
                        payment_method: depositMethod,
                        reference: depositRef,
                        status: 'applied',
                    })
                    toast.success(`Reservation created! Deposit of ฿${depositAmount.toLocaleString()} recorded.`)
                } else {
                    toast.success(`Reservation ${result.data?.reservation_number} created!`)
                }
                router.push('/dashboard/reservations')
            } else {
                toast.error(result.error || 'Error creating reservation')
            }
        } catch (err: any) {
            console.error('createReservation exception:', err)
            toast.error('Error: ' + (err.message || 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">New Booking</h1>
                <p className="text-sm text-slate-500 mt-1">Create a new reservation</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                            {i < step ? <Check className="w-4 h-4" /> : i + 1}
                        </div>
                        <span className={`text-sm hidden sm:inline ${i === step ? 'text-indigo-600 font-medium' : 'text-slate-400'}`}>{s}</span>
                        {i < STEPS.length - 1 && <div className={`w-8 h-px ${i < step ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                    </div>
                ))}
            </div>

            {/* Step 0: Dates & Room Type */}
            {step === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" />Select Dates & Room Type</CardTitle>
                        <div className="text-xs text-slate-400">
                            RoomTypes: {roomTypes.length} | Sources: {sources.length} | Markets: {markets.length}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Check-in Date <span className="text-red-500">*</span></Label>
                                <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div className="space-y-2">
                                <Label>Check-out Date <span className="text-red-500">*</span></Label>
                                <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} min={checkIn || new Date().toISOString().split('T')[0]} />
                            </div>
                        </div>
                        {nights > 0 && <p className="text-sm text-indigo-600 font-medium">{nights} night{nights > 1 ? 's' : ''}</p>}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Room Type <span className="text-red-500">*</span></Label>
                                <Select value={selectedRoomTypeId} onValueChange={(v) => { setSelectedRoomTypeId(v); const rt = roomTypes.find(r => r.id === v); if (rt) setRate(Number(rt.base_price)) }}>
                                    <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                                    <SelectContent>
                                        {roomTypes.map(rt => (
                                            <SelectItem key={rt.id} value={rt.id}>{rt.code} — {rt.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Rate Plan <span className="text-red-500">*</span></Label>
                                <Select value={selectedRatePlanId} onValueChange={setSelectedRatePlanId} disabled={!selectedRoomTypeId || ratePlans.length === 0}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={!selectedRoomTypeId ? 'Select Room Type first' : ratePlans.length === 0 ? 'No active rate plans' : 'Select rate plan'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ratePlans.map(rp => (
                                            <SelectItem key={rp.id} value={rp.id}>{rp.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Adults</Label>
                                <Input type="number" min={1} max={10} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Children</Label>
                                <Input type="number" min={0} max={10} value={children} onChange={(e) => setChildren(Number(e.target.value))} />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Estimated Total</Label>
                                <div className="h-10 flex items-center px-3 border rounded-md bg-slate-50 text-indigo-700 font-semibold">
                                    {calculatingRate ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : `฿${totalEstimate.toLocaleString()} (ADR: ฿${rate.toLocaleString()})`}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 gap-2">
                            <div className="text-xs text-slate-400 flex items-center">
                                RT: {selectedRoomTypeId ? '✓' : '✗'} | RP: {selectedRatePlanId ? '✓' : '✗'}
                            </div>
                            <Button onClick={searchAvailability} disabled={searchingRooms || !selectedRoomTypeId} className="bg-indigo-600 hover:bg-indigo-700">
                                {searchingRooms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                Search Availability
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 1: Select Room */}
            {step === 1 && (
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="w-5 h-5" />Select Room ({availableRooms.length} available)</CardTitle></CardHeader>
                    <CardContent>
                        {availableRooms.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">No rooms available for the selected dates</div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {availableRooms.map(room => {
                                    const rt = room.room_type as { code: string; name: string; base_price: number } | undefined
                                    const bld = room.building as { name: string } | undefined
                                    return (
                                        <button key={room.id} onClick={() => { setSelectedRoom(room); if (rt && !rate) setRate(Number(rt.base_price)) }}
                                            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${selectedRoom?.id === room.id ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-200'
                                                }`}>
                                            <div className="font-bold text-lg text-slate-800">{room.room_number}</div>
                                            <div className="text-xs text-slate-500 mt-1">{rt?.name}</div>
                                            <div className="text-xs text-slate-400">{bld?.name}</div>
                                            <div className="text-sm font-semibold text-indigo-600 mt-2">฿{rt ? Number(rt.base_price).toLocaleString() : '-'}/night</div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                        <div className="flex justify-between mt-6">
                            <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => { setSelectedRoom(null); setStep(2) }}>Skip (No Room)</Button>
                                <Button onClick={() => setStep(2)} disabled={!selectedRoom} className="bg-indigo-600 hover:bg-indigo-700">
                                    Next <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Guest Info */}
            {step === 2 && (
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Guest Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {selectedGuest ? (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-emerald-800">{selectedGuest.first_name} {selectedGuest.last_name}</p>
                                            <ReturnGuestBadge guestId={selectedGuest.id} />
                                        </div>
                                        <p className="text-sm text-emerald-600">{selectedGuest.email || selectedGuest.phone || 'No contact info'}</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setSelectedGuest(null)}>Change</Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-2">
                                    <Input placeholder="Search guest by name or passport..." value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleGuestSearch() }} />
                                    <Button variant="outline" onClick={handleGuestSearch}><Search className="h-4 w-4" /></Button>
                                    <Button variant="outline" onClick={() => setShowNewGuest(!showNewGuest)}><Plus className="h-4 w-4" /></Button>
                                </div>
                                {guestResults.length > 0 && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {guestResults.map(g => (
                                            <button key={g.id} onClick={() => setSelectedGuest(g)}
                                                className="w-full p-3 text-left rounded-lg border hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                                                <span className="font-medium">{g.first_name} {g.last_name}</span>
                                                <span className="text-sm text-slate-400 ml-2">{g.email || g.phone}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showNewGuest && (
                                    <div className="p-4 border rounded-lg space-y-3 bg-slate-50">
                                        <p className="font-medium text-slate-700">New Guest</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><Label>First Name *</Label><Input value={newGuest.first_name} onChange={(e) => setNewGuest({ ...newGuest, first_name: e.target.value })} /></div>
                                            <div><Label>Last Name *</Label><Input value={newGuest.last_name} onChange={(e) => setNewGuest({ ...newGuest, last_name: e.target.value })} /></div>
                                            <div><Label>Phone</Label><Input value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} /></div>
                                            <div><Label>Email</Label><Input type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} /></div>
                                        </div>
                                        <Button size="sm" onClick={handleCreateGuest} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create Guest
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                        {/* Booking sources & market */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label>Booking Source</Label>
                                <Select value={sourceId} onValueChange={setSourceId}>
                                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                                    <SelectContent>{sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Market</Label>
                                <Select value={marketId} onValueChange={setMarketId}>
                                    <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                                    <SelectContent>{markets.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Agent & Company */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label>Travel Agent</Label>
                                <Select value={agentId} onValueChange={setAgentId}>
                                    <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                                    <SelectContent>
                                        {companies.filter(c => ['agent', 'ota'].includes(c.company_type)).map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.company_type})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Company (Corporate)</Label>
                                <Select value={companyId} onValueChange={setCompanyId}>
                                    <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                                    <SelectContent>
                                        {companies.filter(c => ['company', 'corporate'].includes(c.company_type)).map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.company_type})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Allotment Selection */}
                        <div className="pt-4 border-t">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Allotment (for contracted rates)</Label>
                                    {!selectedAllotment && (
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => {
                                                checkAllotmentAvailabilityForSelection();
                                                setAllotmentDialogOpen(true);
                                            }}
                                            disabled={!selectedRoomTypeId || !checkIn || !checkOut}
                                        >
                                            <Building2 className="w-4 h-4 mr-2" /> 
                                            {checkingAllotment ? 'Checking...' : 'Select Allotment'}
                                        </Button>
                                    )}
                                </div>
                                {selectedAllotment && (
                                    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                        <div>
                                            <p className="font-medium text-indigo-800">{selectedAllotment.allot_code}</p>
                                            <p className="text-sm text-indigo-600">{selectedAllotment.company_name}</p>
                                            <p className="text-xs text-indigo-500">
                                                Min {selectedAllotment.min_available} rooms available for selected dates
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={clearAllotment}>×</Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* VIP & Flight Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label>VIP Level</Label>
                                <Select value={vipLevel} onValueChange={setVipLevel}>
                                    <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VIP">VIP</SelectItem>
                                        <SelectItem value="VVIP">VVIP</SelectItem>
                                        <SelectItem value="Regular">Regular</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Arrival Flight</Label>
                                <Input value={arrivalFlight} onChange={(e) => setArrivalFlight(e.target.value)} placeholder="e.g. TG401" />
                            </div>
                            <div className="space-y-2">
                                <Label>Arrival Time</Label>
                                <Input value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} placeholder="e.g. 14:30" />
                            </div>
                            <div className="space-y-2">
                                <Label>Departure Flight</Label>
                                <Input value={departureFlight} onChange={(e) => setDepartureFlight(e.target.value)} placeholder="e.g. TG402" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special requests..." rows={3} />
                        </div>
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                            <Button onClick={() => setStep(3)} disabled={!selectedGuest} className="bg-indigo-600 hover:bg-indigo-700">
                                Review <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Review & Confirm</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                                <p className="text-sm font-medium text-slate-500">Stay</p>
                                <p className="text-slate-800">{checkIn && new Date(checkIn).toLocaleDateString('en-GB')} → {checkOut && new Date(checkOut).toLocaleDateString('en-GB')}</p>
                                <p className="text-sm text-slate-500">{nights} night{nights > 1 ? 's' : ''} • {adults}A {children > 0 ? `${children}C` : ''}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                                <p className="text-sm font-medium text-slate-500">Guest</p>
                                <p className="text-slate-800 font-medium">{selectedGuest?.first_name} {selectedGuest?.last_name}</p>
                                <p className="text-sm text-slate-500">{selectedGuest?.email || selectedGuest?.phone || '-'}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                                <p className="text-sm font-medium text-slate-500">Room</p>
                                <p className="text-slate-800">{selectedRoom?.room_number || <span className="italic text-slate-400">Unassigned</span>}</p>
                                <p className="text-sm text-slate-500">{roomTypes.find(rt => rt.id === selectedRoomTypeId)?.name}</p>
                            </div>
                            <div className="p-4 bg-indigo-50 rounded-lg space-y-2">
                                <p className="text-sm font-medium text-indigo-500">Total Estimate</p>
                                <p className="text-2xl font-bold text-indigo-700">฿{(rate * nights).toLocaleString()}</p>
                                <p className="text-sm text-indigo-400">฿{rate.toLocaleString()} × {nights} night{nights > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        {notes && (
                            <div className="p-4 bg-amber-50 rounded-lg">
                                <p className="text-sm font-medium text-amber-600">Notes</p>
                                <p className="text-sm text-amber-800">{notes}</p>
                            </div>
                        )}
                        
                        {/* Deposit / Advance Payment Section */}
                        <div className="p-4 border-2 border-slate-200 rounded-lg space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="collectDeposit" checked={collectDeposit} onChange={(e) => {
                                        setCollectDeposit(e.target.checked)
                                        if (e.target.checked && depositAmount === 0) {
                                            setDepositAmount(Math.round(rate * nights * 0.3)) // Default 30% deposit
                                        }
                                    }} className="rounded" />
                                    <Label htmlFor="collectDeposit" className="font-medium">Collect Deposit / Advance Payment</Label>
                                </div>
                            </div>
                            
                            {collectDeposit && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                    <div className="space-y-2">
                                        <Label>Deposit Amount</Label>
                                        <Input type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value))} />
                                        <p className="text-xs text-slate-400">Recommend: ฿{Math.round(rate * nights * 0.3).toLocaleString()} (30%)</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Payment Method</Label>
                                        <Select value={depositMethod} onValueChange={setDepositMethod}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {paymentCodes.filter(c => ['CASH', 'CRDC', 'DEPST', 'ADV', 'TRAN'].includes(c.code)).map(pc => (
                                                    <SelectItem key={pc.code} value={pc.code}>{pc.code} - {pc.description}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Reference No.</Label>
                                        <Input value={depositRef} onChange={(e) => setDepositRef(e.target.value)} placeholder="Card last 4, Slip no." />
                                    </div>
                                </div>
                            )}
                            
                            {collectDeposit && depositAmount > 0 && (
                                <div className="p-3 bg-emerald-50 rounded-lg flex justify-between items-center">
                                    <span className="text-sm text-emerald-700">Deposit to collect:</span>
                                    <span className="text-xl font-bold text-emerald-700">฿{depositAmount.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                            <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Confirm Booking
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Allotment Selection Dialog */}
            <Dialog open={allotmentDialogOpen} onOpenChange={setAllotmentDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Select Allotment</DialogTitle>
                        <DialogDescription>
                            Choose an allotment contract for contracted rates. Only allotments with availability for your selected dates are shown.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {availableAllotments.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                {checkingAllotment ? (
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                        <span className="ml-2">Checking availability...</span>
                                    </div>
                                ) : (
                                    <div>
                                        <p>No allotments available for the selected dates.</p>
                                        <p className="text-sm mt-2">Try selecting different dates or room type.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {availableAllotments.map((allot) => (
                                    <button
                                        key={allot.allotment_id}
                                        onClick={() => selectAllotment(allot)}
                                        className="w-full p-4 text-left rounded-lg border hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-slate-800">{allot.allot_code}</p>
                                                <p className="text-sm text-slate-600">{allot.company_name}</p>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={allot.min_available >= 3 ? 'default' : 'secondary'}>
                                                    {allot.min_available} rooms avail
                                                </Badge>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {allot.total_days} nights
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
