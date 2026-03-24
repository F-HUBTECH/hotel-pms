'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Loader2, FileText, Printer, Calendar, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface FolioInquiryItem {
    id: string;
    folio_number: string | null;
    folio_seq: number;
    total_amount: number;
    paid_amount: number;
    balance: number;
    status: string;
    reservation_id: string;
    guest_name?: string;
    room_number?: string;
    check_in?: string;
    check_out?: string;
}

interface FolioDetail {
    id: string;
    folio_number: string | null;
    folio_seq: number;
    total_amount: number;
    paid_amount: number;
    balance: number;
    status: string;
    items: any[];
    payments: any[];
    reservation?: {
        guest_name?: string;
        room_number?: string;
        check_in?: string;
        check_out?: string;
    };
}

export default function FolioInquiryPage() {
    const [loading, setLoading] = useState(true);
    const [inquiries, setInquiries] = useState<FolioInquiryItem[]>([]);
    const [selectedFolio, setSelectedFolio] = useState<FolioDetail | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [searchType, setSearchType] = useState<'guest' | 'folio' | 'room'>('guest');
    const [searchValue, setSearchValue] = useState('');
    const [folioSeq, setFolioSeq] = useState<string>('');

    useEffect(() => {
        fetchInquiries();
    }, []);

    const fetchInquiries = async () => {
        setLoading(true);
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        let query = supabase
            .from('folios')
            .select(`
                id, folio_number, folio_seq, total_amount, paid_amount, balance, status, reservation_id,
                reservation:reservations(
                    id,
                    check_in_date,
                    check_out_date,
                    guest:guests(first_name, last_name),
                    room:rooms(room_number)
                )
            `)
            .in('status', ['open', 'closed'])
            .order('folio_seq', { ascending: true })
            .limit(200);

        const { data, error } = await query;

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        const enriched = (data || []).map((f: any) => {
            const guest = Array.isArray(f.reservation?.guest) ? f.reservation?.guest[0] : f.reservation?.guest;
            const room = Array.isArray(f.reservation?.room) ? f.reservation?.room[0] : f.reservation?.room;
            return {
                ...f,
                guest_name: guest 
                    ? `${guest.first_name} ${guest.last_name}`
                    : 'Unknown',
                room_number: room?.room_number || '-',
                check_in: f.reservation?.check_in_date,
                check_out: f.reservation?.check_out_date
            };
        });

        setInquiries(enriched);
        setLoading(false);
    };

    const handleSearch = async () => {
        if (!searchValue.trim()) {
            fetchInquiries();
            return;
        }

        setLoading(true);
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        let query = supabase
            .from('folios')
            .select(`
                id, folio_number, folio_seq, total_amount, paid_amount, balance, status, reservation_id,
                reservation:reservations(
                    id,
                    check_in_date,
                    check_out_date,
                    guest:guests(first_name, last_name),
                    room:rooms(room_number)
                )
            `)
            .in('status', ['open', 'closed'])
            .order('folio_seq', { ascending: true })
            .limit(200);

        if (searchType === 'guest' && searchValue) {
            const { data: guests } = await supabase
                .from('guests')
                .select('id')
                .or(`first_name.ilike.%${searchValue}%,last_name.ilike.%${searchValue}%`)
                .limit(50);

            if (guests && guests.length > 0) {
                const guestIds = guests.map(g => g.id);
                const { data: reservations } = await supabase
                    .from('reservations')
                    .select('id')
                    .in('guest_id', guestIds)
                    .limit(50);

                if (reservations && reservations.length > 0) {
                    const resIds = reservations.map(r => r.id);
                    query = query.in('reservation_id', resIds);
                } else {
                    setInquiries([]);
                    setLoading(false);
                    return;
                }
            } else {
                setInquiries([]);
                setLoading(false);
                return;
            }
        } else if (searchType === 'folio' && searchValue) {
            query = query.or(`folio_number.ilike.%${searchValue}%,id.ilike.%${searchValue}%`);
        } else if (searchType === 'room' && searchValue) {
            const { data: rooms } = await supabase
                .from('rooms')
                .select('id')
                .ilike('room_number', `%${searchValue}%`)
                .limit(50);

            if (rooms && rooms.length > 0) {
                const roomIds = rooms.map(r => r.id);
                const { data: reservations } = await supabase
                    .from('reservations')
                    .select('id')
                    .in('room_id', roomIds)
                    .limit(50);

                if (reservations && reservations.length > 0) {
                    const resIds = reservations.map(r => r.id);
                    query = query.in('reservation_id', resIds);
                } else {
                    setInquiries([]);
                    setLoading(false);
                    return;
                }
            } else {
                setInquiries([]);
                setLoading(false);
                return;
            }
        }

        if (folioSeq) {
            query = query.eq('folio_seq', parseInt(folioSeq));
        }

        const { data, error } = await query;

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        const enriched = (data || []).map((f: any) => {
            const guest = Array.isArray(f.reservation?.guest) ? f.reservation?.guest[0] : f.reservation?.guest;
            const room = Array.isArray(f.reservation?.room) ? f.reservation?.room[0] : f.reservation?.room;
            return {
                ...f,
                guest_name: guest 
                    ? `${guest.first_name} ${guest.last_name}`
                    : 'Unknown',
                room_number: room?.room_number || '-',
                check_in: f.reservation?.check_in_date,
                check_out: f.reservation?.check_out_date
            };
        });

        setInquiries(enriched);
        setLoading(false);
    };

    const viewDetail = async (folio: FolioInquiryItem) => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: folioData, error: folioError } = await supabase
            .from('folios')
            .select('*')
            .eq('id', folio.id)
            .single();

        if (folioError) {
            toast.error(folioError.message);
            return;
        }

        const { data: resData } = await supabase
            .from('reservations')
            .select(`
                id,
                check_in_date,
                check_out_date,
                guest:guests(first_name, last_name),
                room:rooms(room_number)
            `)
            .eq('id', folio.reservation_id)
            .single();

        const { data: itemsData } = await supabase
            .from('folio_items')
            .select('*')
            .eq('folio_id', folio.id)
            .order('item_date');

        const { data: paymentsData } = await supabase
            .from('folio_payments')
            .select('*')
            .eq('folio_id', folio.id)
            .order('created_at');

        const guest = resData?.guest ? (Array.isArray(resData.guest) ? resData.guest[0] : resData.guest) : null;
        const room = resData?.room ? (Array.isArray(resData.room) ? resData.room[0] : resData.room) : null;

        setSelectedFolio({
            ...folioData,
            items: itemsData || [],
            payments: paymentsData || [],
            reservation: resData ? {
                guest_name: guest ? `${guest.first_name} ${guest.last_name}` : 'Unknown',
                room_number: room?.room_number || '-',
                check_in: resData.check_in_date,
                check_out: resData.check_out_date
            } : undefined
        });
        setDetailOpen(true);
    };

    const printFolio = () => {
        if (!selectedFolio) return;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const itemsHtml = selectedFolio.items.map((item: any) => `
            <tr style="${item.is_voided ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                <td>${format(new Date(item.item_date), 'dd/MM/yyyy')}</td>
                <td>${item.tran_code}</td>
                <td>${item.description}</td>
                <td style="text-align: right">${Number(item.amount).toLocaleString()}</td>
            </tr>
        `).join('');

        const paymentsHtml = selectedFolio.payments.map((pay: any) => `
            <tr style="color: green;">
                <td>${format(new Date(pay.created_at), 'dd/MM/yyyy')}</td>
                <td>${pay.payment_method}</td>
                <td>PAYMENT</td>
                <td style="text-align: right">(${Number(pay.amount).toLocaleString()})</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Folio Inquiry #${selectedFolio.folio_number || selectedFolio.folio_seq}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; }
                    .total-row { font-weight: bold; border-top: 2px solid #000; }
                    .balance { font-size: 1.2em; color: ${selectedFolio.balance > 0 ? 'red' : 'green'}; }
                </style>
            </head>
            <body>
                <h1>Folio Inquiry</h1>
                <p><strong>Folio #:</strong> ${selectedFolio.folio_number || `Seq ${selectedFolio.folio_seq}`}</p>
                <p><strong>Guest:</strong> ${selectedFolio.reservation?.guest_name || 'Unknown'}</p>
                <p><strong>Room:</strong> ${selectedFolio.reservation?.room_number || '-'}</p>
                <p><strong>Status:</strong> ${selectedFolio.status}</p>
                
                <h2>Transactions</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Code</th>
                            <th>Description</th>
                            <th style="text-align: right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml || '<tr><td colspan="4">No transactions</td></tr>'}
                    </tbody>
                </table>

                <h2>Payments</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Method</th>
                            <th>Description</th>
                            <th style="text-align: right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentsHtml || '<tr><td colspan="4">No payments</td></tr>'}
                    </tbody>
                </table>

                <table style="margin-top: 30px;">
                    <tr>
                        <td colspan="3" style="text-align: right;"><strong>Total Charges:</strong></td>
                        <td style="text-align: right;">${Number(selectedFolio.total_amount || 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td colspan="3" style="text-align: right;"><strong>Total Paid:</strong></td>
                        <td style="text-align: right;">(${Number(selectedFolio.paid_amount || 0).toLocaleString()})</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;"><strong>Balance:</strong></td>
                        <td style="text-align: right;" class="balance">${Number(selectedFolio.balance || 0).toLocaleString()}</td>
                    </tr>
                </table>

                <script>window.print();</script>
            </body>
            </html>
        `);
    };

    const getPayfBadge = (payf: string, isVoided: boolean) => {
        if (isVoided || payf === 'W') return <Badge variant="destructive">VOID</Badge>;
        if (payf === 'P') return <Badge className="bg-blue-100 text-blue-700">PAID</Badge>;
        if (payf === 'C') return <Badge className="bg-green-100 text-green-700">CORR</Badge>;
        if (payf === 'A') return <Badge className="bg-purple-100 text-purple-700">ADV</Badge>;
        return <Badge variant="secondary">CHRG</Badge>;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Folio Inquiry</h1>
                <p className="text-sm text-slate-500 mt-1">Read-only folio transaction lookup</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" /> Search Criteria
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Search By</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                value={searchType}
                                onChange={(e) => setSearchType(e.target.value as any)}
                            >
                                <option value="guest">Guest Name</option>
                                <option value="folio">Folio Number</option>
                                <option value="room">Room Number</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Search Value</Label>
                            <Input
                                placeholder={searchType === 'guest' ? 'Guest name...' : searchType === 'folio' ? 'Folio number...' : 'Room number...'}
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Folio Seq (Optional)</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                value={folioSeq}
                                onChange={(e) => setFolioSeq(e.target.value)}
                            >
                                <option value="">All Folios</option>
                                <option value="1">Folio 1</option>
                                <option value="2">Folio 2</option>
                                <option value="3">Folio 3</option>
                                <option value="4">Folio 4</option>
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            <Button onClick={handleSearch} disabled={loading}>
                                <Search className="w-4 h-4 mr-2" /> Search
                            </Button>
                            <Button variant="outline" onClick={fetchInquiries}>
                                Reset
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Eye className="w-5 h-5" /> Folio List
                        </div>
                        <Badge variant="secondary">{inquiries.length} folios</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : inquiries.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                            <p>No folios found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Folio</TableHead>
                                    <TableHead>Guest / Room</TableHead>
                                    <TableHead>Arrival</TableHead>
                                    <TableHead>Departure</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inquiries.map((folio) => (
                                    <TableRow key={`${folio.id}-${folio.folio_seq}`}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {folio.folio_number || `Folio ${folio.folio_seq}`}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{folio.guest_name}</div>
                                            <div className="text-sm text-slate-500">Room: {folio.room_number}</div>
                                        </TableCell>
                                        <TableCell>
                                            {folio.check_in ? format(new Date(folio.check_in), 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {folio.check_out ? format(new Date(folio.check_out), 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            ฿{Number(folio.total_amount || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${folio.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ฿{Number(folio.balance || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={folio.status === 'open' ? 'default' : 'secondary'}>
                                                {folio.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => viewDetail(folio)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" /> View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>
                                Folio Inquiry #{selectedFolio?.folio_number || `Seq ${selectedFolio?.folio_seq}`}
                            </DialogTitle>
                            <Button variant="outline" size="sm" onClick={printFolio}>
                                <Printer className="w-4 h-4 mr-2" /> Print
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    {selectedFolio && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">Guest</p>
                                    <p className="font-medium">{selectedFolio.reservation?.guest_name || 'Unknown'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">Room</p>
                                    <p className="font-medium">{selectedFolio.reservation?.room_number || '-'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">Total Charges</p>
                                    <p className="text-xl font-bold">฿{Number(selectedFolio.total_amount || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">Balance</p>
                                    <p className={`text-xl font-bold ${selectedFolio.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ฿{Number(selectedFolio.balance || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Transactions</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedFolio.items?.length > 0 ? (
                                            selectedFolio.items.map((item: any) => (
                                                <TableRow key={item.id} style={{ opacity: item.is_voided ? 0.5 : 1, textDecoration: item.is_voided ? 'line-through' : 'none' }}>
                                                    <TableCell>{format(new Date(item.item_date), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell className="font-mono">{item.tran_code}</TableCell>
                                                    <TableCell>{item.description}</TableCell>
                                                    <TableCell className="text-right">฿{Number(item.amount).toLocaleString()}</TableCell>
                                                    <TableCell>{getPayfBadge(item.payf, item.is_voided)}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-slate-500">No transactions</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {selectedFolio.payments?.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-2">Payments</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Method</TableHead>
                                                <TableHead>Reference</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedFolio.payments.map((pay: any) => (
                                                <TableRow key={pay.id} style={{ color: 'green' }}>
                                                    <TableCell>{format(new Date(pay.created_at), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell>{pay.payment_method}</TableCell>
                                                    <TableCell>{pay.reference_number || '-'}</TableCell>
                                                    <TableCell className="text-right">(฿{Number(pay.amount).toLocaleString()})</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}