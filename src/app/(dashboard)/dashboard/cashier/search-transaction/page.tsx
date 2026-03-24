'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Calendar, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Folio {
    id: string;
    folio_seq: number;
    folio_number: string | null;
    reservation_id: string;
}

interface GuestName {
    first_name: string;
    last_name: string;
}

interface RoomInfo {
    room_number: string;
}

interface ReservationData {
    id: string;
    guest: GuestName[];
    room: RoomInfo[];
}

interface Transaction {
    id: string;
    tran_code: string;
    description: string;
    amount: number;
    quantity: number;
    item_date: string;
    reference: string;
    payf: string;
    folio?: Folio;
    folio_seq?: number;
    folio_number?: string;
    reservation_id?: string;
    guest_name?: string;
    room_number?: string;
    created_at: string;
}

export default function SearchTransactionPage() {
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [searchCode, setSearchCode] = useState('');
    const [searchDateFrom, setSearchDateFrom] = useState('');
    const [searchDateTo, setSearchDateTo] = useState('');
    const [searchGuest, setSearchGuest] = useState('');
    const [searchReservation, setSearchReservation] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchCode && !searchDateFrom && !searchDateTo && !searchGuest && !searchReservation) {
            toast.error('Please enter at least one search criteria');
            return;
        }

        setLoading(true);
        setHasSearched(true);

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        let query = supabase
            .from('folio_items')
            .select(`
                id, tran_code, description, amount, quantity, item_date, reference, payf, created_at,
                folio:folios(id, folio_seq, folio_number, reservation_id)
            `)
            .order('item_date', { ascending: false })
            .limit(100);

        if (searchCode) {
            query = query.ilike('tran_code', `%${searchCode}%`);
        }

        if (searchDateFrom) {
            query = query.gte('item_date', searchDateFrom);
        }

        if (searchDateTo) {
            query = query.lte('item_date', searchDateTo);
        }

        if (searchReservation) {
            query = query.ilike('folio.reservation_id', `%${searchReservation}%`);
        }

        const { data, error } = await query;

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        let results = data || [];

        if (searchGuest) {
            const { data: guestData } = await supabase
                .from('guests')
                .select('id')
                .or(`first_name.ilike.%${searchGuest}%,last_name.ilike.%${searchGuest}%`)
                .limit(50);

            if (guestData && guestData.length > 0) {
                const guestIds = guestData.map(g => g.id);
                
                const { data: resData } = await supabase
                    .from('reservations')
                    .select('id')
                    .in('guest_id', guestIds)
                    .limit(50);

                if (resData && resData.length > 0) {
                    const resIds = resData.map(r => r.id);
                    results = results.filter(t => {
                        const folio = t.folio as unknown as Folio | null;
                        return folio && resIds.includes(folio.reservation_id);
                    });
                } else {
                    results = [];
                }
            } else {
                results = [];
            }
        }

        const enrichedResults = await Promise.all(
            results.map(async (t: any) => {
                let guestName = '';
                let roomNumber = '';
                const folio = t.folio as unknown as Folio | null;

                if (folio?.reservation_id) {
                    const { data: resData } = await supabase
                        .from('reservations')
                        .select(`
                            id,
                            guest:guests(first_name, last_name),
                            room:rooms(room_number)
                        `)
                        .eq('id', folio.reservation_id)
                        .single();

                    if (resData) {
                        const res = resData as unknown as ReservationData;
                        guestName = `${res.guest?.[0]?.first_name || ''} ${res.guest?.[0]?.last_name || ''}`.trim();
                        roomNumber = res.room?.[0]?.room_number || '';
                    }
                }

                return {
                    ...t,
                    folio_seq: folio?.folio_seq,
                    folio_number: folio?.folio_number,
                    reservation_id: folio?.reservation_id,
                    guest_name: guestName,
                    room_number: roomNumber,
                };
            })
        );

        setTransactions(enrichedResults);
        setLoading(false);
    };

    const clearSearch = () => {
        setSearchCode('');
        setSearchDateFrom('');
        setSearchDateTo('');
        setSearchGuest('');
        setSearchReservation('');
        setTransactions([]);
        setHasSearched(false);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatAmount = (amount: number, payf: string) => {
        if (payf === 'P' || payf === 'C') {
            return `(${Math.abs(amount).toLocaleString()})`;
        }
        return amount.toLocaleString();
    };

    const getPayfBadge = (payf: string) => {
        switch (payf) {
            case 'I': return <Badge variant="default">Item</Badge>;
            case 'P': return <Badge variant="secondary">Paid</Badge>;
            case 'C': return <Badge variant="destructive">Credit</Badge>;
            case 'W': return <Badge variant="outline">Void</Badge>;
            default: return <Badge variant="outline">{payf}</Badge>;
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Search Transaction</h1>
                <p className="text-sm text-slate-500 mt-1">Search folio transactions by various criteria</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" /> Search Criteria
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Transaction Code</Label>
                            <Input
                                placeholder="e.g. ROOM, MINIBAR..."
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Date From</Label>
                            <Input
                                type="date"
                                value={searchDateFrom}
                                onChange={(e) => setSearchDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Date To</Label>
                            <Input
                                type="date"
                                value={searchDateTo}
                                onChange={(e) => setSearchDateTo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Guest Name</Label>
                            <Input
                                placeholder="Search by guest name..."
                                value={searchGuest}
                                onChange={(e) => setSearchGuest(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Reservation ID</Label>
                            <Input
                                placeholder="Reservation ID..."
                                value={searchReservation}
                                onChange={(e) => setSearchReservation(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSearch} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            Search
                        </Button>
                        <Button variant="outline" onClick={clearSearch}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {hasSearched && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5" /> Results
                            </div>
                            <Badge variant="secondary">{transactions.length} transactions</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <p>No transactions found</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Guest / Room</TableHead>
                                        <TableHead>Folio</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((tran) => (
                                        <TableRow key={tran.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {formatDate(tran.item_date)}
                                            </TableCell>
                                            <TableCell className="font-mono font-medium">
                                                {tran.tran_code}
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">
                                                {tran.description}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    <div className="font-medium">{tran.guest_name || '-'}</div>
                                                    <div className="text-slate-500">{tran.room_number || '-'}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    <div>Folio {tran.folio_seq || '-'}</div>
                                                    {tran.folio_number && (
                                                        <div className="text-slate-500">#{tran.folio_number}</div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className={`text-right font-mono font-medium ${
                                                tran.payf === 'P' || tran.payf === 'C' ? 'text-blue-600' : ''
                                            }`}>
                                                ฿{formatAmount(tran.amount, tran.payf)}
                                            </TableCell>
                                            <TableCell>
                                                {getPayfBadge(tran.payf)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}