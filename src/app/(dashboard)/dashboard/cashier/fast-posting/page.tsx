'use client';

import { useState, useEffect } from 'react';
import { searchGuests } from '@/lib/actions/guests';
import { getOrCreateReservationFolios, postFolioTransaction } from '@/lib/actions/folios';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, User, Calendar, BedDouble, CreditCard, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionCode {
    id: string;
    code: string;
    description: string;
    default_vat_rate: number;
    default_serv_rate: number;
    vat_type: string;
    vat_inclusive: boolean;
    is_payment_code?: boolean;
    is_active?: boolean;
}

interface Guest {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
}

interface Folio {
    id: string;
    folio_seq: number;
    status: string;
}

export default function FastPostingPage() {
    const [guestSearch, setGuestSearch] = useState('');
    const [guestResults, setGuestResults] = useState<Guest[]>([]);
    const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
    const [reservations, setReservations] = useState<any[]>([]);
    const [selectedReservation, setSelectedReservation] = useState<any>(null);
    const [folios, setFolios] = useState<Folio[]>([]);
    const [selectedFolio, setSelectedFolio] = useState<Folio | null>(null);
    const [transactionCodes, setTransactionCodes] = useState<TransactionCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [postingCode, setPostingCode] = useState<string | null>(null);

    useEffect(() => {
        loadTransactionCodes();
    }, []);

    const loadTransactionCodes = async () => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await supabase
            .from('revenue_transaction_codes')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');
        if (data) setTransactionCodes(data);
    };

    const handleGuestSearch = async () => {
        if (guestSearch.length < 2) return;
        setLoading(true);
        const results = await searchGuests(guestSearch);
        setGuestResults(results);
        setLoading(false);
    };

    const selectGuest = async (guest: Guest) => {
        setSelectedGuest(guest);
        setGuestSearch('');
        setGuestResults([]);
        
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data } = await supabase
            .from('reservations')
            .select(`
                id, reservation_number, check_in_date, check_out_date, 
                status, room_type_id, adults, children,
                room:rooms(id, room_number),
                room_type:room_types(id, code, name)
            `)
            .eq('guest_id', guest.id)
            .in('status', ['reserved', 'checked_in'])
            .order('check_in_date', { ascending: false });
        
        setReservations(data || []);
    };

    const selectReservation = async (res: any) => {
        setSelectedReservation(res);
        
        const folioData = await getOrCreateReservationFolios(res.id);
        if (folioData.success && folioData.data) {
            setFolios(folioData.data);
            if (folioData.data.length > 0) {
                setSelectedFolio(folioData.data[0]);
            }
        }
    };

    const handleQuickPost = async (tranCode: TransactionCode) => {
        if (!selectedFolio) {
            toast.error('Please select a folio first');
            return;
        }

        if (selectedFolio.status !== 'open') {
            toast.error('Folio is not open. Cannot post charges.');
            return;
        }

        setPosting(true);
        setPostingCode(tranCode.code);

        const today = new Date().toISOString().split('T')[0];
        
        const result = await postFolioTransaction({
            folio_id: selectedFolio.id,
            tran_code: tranCode.code,
            description: tranCode.description,
            amount: 0,
            quantity: 1,
            item_date: today,
        });

        setPosting(false);
        setPostingCode(null);

        if (result.success) {
            toast.success(`Posted: ${tranCode.description}`);
        } else {
            toast.error(result.error || 'Failed to post');
        }
    };

    const clearSelection = () => {
        setSelectedGuest(null);
        setSelectedReservation(null);
        setReservations([]);
        setFolios([]);
        setSelectedFolio(null);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Fast Posting</h1>
                    <p className="text-sm text-slate-500 mt-1">Quick charge posting for in-house guests</p>
                </div>
                {selectedGuest && (
                    <Button variant="outline" onClick={clearSelection}>
                        <RefreshCw className="w-4 h-4 mr-2" /> New Guest
                    </Button>
                )}
            </div>

            {!selectedGuest ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5" /> Find Guest
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Search by name, phone, or passport..."
                                value={guestSearch}
                                onChange={(e) => setGuestSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGuestSearch()}
                            />
                            <Button onClick={handleGuestSearch} disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </Button>
                        </div>

                        {guestResults.length > 0 && (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {guestResults.map((guest) => (
                                    <button
                                        key={guest.id}
                                        onClick={() => selectGuest(guest)}
                                        className="w-full p-3 text-left rounded-lg border hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                                    >
                                        <div className="font-medium">
                                            {guest.first_name} {guest.last_name}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {guest.email || guest.phone || 'No contact info'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {guestResults.length === 0 && guestSearch.length >= 2 && !loading && (
                            <p className="text-center text-slate-500 py-4">No guests found</p>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Guest</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">
                                            {selectedGuest.first_name} {selectedGuest.last_name}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {selectedGuest.email || selectedGuest.phone}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Calendar className="w-5 h-5" /> Reservations
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {reservations.length === 0 ? (
                                    <p className="text-slate-500 text-sm">No active reservations</p>
                                ) : (
                                    reservations.map((res) => (
                                        <button
                                            key={res.id}
                                            onClick={() => selectReservation(res)}
                                            className={`w-full p-3 text-left rounded-lg border transition-all ${
                                                selectedReservation?.id === res.id
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'hover:border-indigo-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">
                                                    {res.room?.room_number || 'Unassigned'}
                                                </span>
                                                <Badge variant={res.status === 'checked_in' ? 'default' : 'secondary'}>
                                                    {res.status}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-slate-500 mt-1">
                                                {res.room_type?.name || 'Room Type'} • {res.adults}A {res.children > 0 ? `${res.children}C` : ''}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                {res.check_in_date} → {res.check_out_date}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {folios.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Folios</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {folios.map((folio) => (
                                        <button
                                            key={folio.id}
                                            onClick={() => setSelectedFolio(folio)}
                                            className={`w-full p-3 text-left rounded-lg border transition-all ${
                                                selectedFolio?.id === folio.id
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'hover:border-indigo-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">Folio {folio.folio_seq}</span>
                                                <Badge variant={folio.status === 'open' ? 'default' : 'secondary'}>
                                                    {folio.status}
                                                </Badge>
                                            </div>
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5" /> Quick Post
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!selectedReservation ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <BedDouble className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                        <p>Select a reservation to start posting</p>
                                    </div>
                                ) : !selectedFolio ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <p>Select a folio to post charges</p>
                                    </div>
                                ) : selectedFolio.status !== 'open' ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <p>Folio is {selectedFolio.status}. Cannot post charges.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-500">
                                            Click a button to post a charge to Folio {selectedFolio.folio_seq}
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {transactionCodes
                                                .filter(tc => !tc.is_payment_code)
                                                .map((tran) => (
                                                    <button
                                                        key={tran.id}
                                                        onClick={() => handleQuickPost(tran)}
                                                        disabled={posting}
                                                        className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group disabled:opacity-50"
                                                    >
                                                        <div className="font-semibold text-slate-800 group-hover:text-indigo-700">
                                                            {tran.code}
                                                        </div>
                                                        <div className="text-sm text-slate-500 mt-1">
                                                            {tran.description}
                                                        </div>
                                                        {postingCode === tran.code && (
                                                            <div className="mt-2">
                                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                        </div>
                                        {transactionCodes.filter(tc => !tc.is_payment_code).length === 0 && (
                                            <div className="text-center py-8 text-slate-500">
                                                <p>No transaction codes configured</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}