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
import { Search, Loader2, FileText, Printer, Calendar, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface FolioHistoryItem {
    id: string;
    folio_number: string;
    folio_seq: number;
    total_amount: number;
    paid_amount: number;
    balance: number;
    status: string;
    closed_at: string | null;
    reservation_id: string;
    guest_name?: string;
    room_number?: string;
}

interface FolioDetail {
    id: string;
    folio_number: string | null;
    folio_seq: number;
    total_amount: number;
    paid_amount: number;
    balance: number;
    status: string;
    closed_at: string | null;
    items: any[];
    payments: any[];
}

export default function FolioHistoryPage() {
    const [loading, setLoading] = useState(true);
    const [histories, setHistories] = useState<FolioHistoryItem[]>([]);
    const [selectedFolio, setSelectedFolio] = useState<FolioDetail | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [searchDateFrom, setSearchDateFrom] = useState('');
    const [searchDateTo, setSearchDateTo] = useState('');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        let query = supabase
            .from('folios')
            .select(`
                id, folio_number, folio_seq, total_amount, paid_amount, balance, status, closed_at, reservation_id,
                reservation:reservations(
                    id,
                    guest:guests(first_name, last_name),
                    room:rooms(room_number)
                )
            `)
            .eq('status', 'closed')
            .order('closed_at', { ascending: false })
            .limit(100);

        if (searchDateFrom) {
            query = query.gte('closed_at', `${searchDateFrom}T00:00:00`);
        }
        if (searchDateTo) {
            query = query.lte('closed_at', `${searchDateTo}T23:59:59`);
        }

        const { data, error } = await query;

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        const enriched = (data || []).map((f: any) => ({
            ...f,
            guest_name: f.reservation?.guest 
                ? `${f.reservation.guest.first_name} ${f.reservation.guest.last_name}`
                : 'Unknown',
            room_number: f.reservation?.room?.room_number || '-'
        }));

        if (search) {
            const searchLower = search.toLowerCase();
            const filtered = enriched.filter((h: FolioHistoryItem) =>
                h.folio_number?.toLowerCase().includes(searchLower) ||
                h.guest_name?.toLowerCase().includes(searchLower) ||
                h.room_number?.toLowerCase().includes(searchLower)
            );
            setHistories(filtered);
        } else {
            setHistories(enriched);
        }

        setLoading(false);
    };

    const viewDetail = async (folio: FolioHistoryItem) => {
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

        setSelectedFolio({
            ...folioData,
            items: itemsData || [],
            payments: paymentsData || []
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
                <title>Folio #${selectedFolio.folio_number || selectedFolio.folio_seq}</title>
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
                <h1>Folio History</h1>
                <p><strong>Folio #:</strong> ${selectedFolio.folio_number || `Seq ${selectedFolio.folio_seq}`}</p>
                <p><strong>Status:</strong> ${selectedFolio.status}</p>
                <p><strong>Closed:</strong> ${selectedFolio.closed_at ? format(new Date(selectedFolio.closed_at), 'dd/MM/yyyy HH:mm') : '-'}</p>
                
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
                        ${itemsHtml}
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
                        ${paymentsHtml}
                    </tbody>
                </table>

                <table style="margin-top: 30px;">
                    <tr>
                        <td colspan="3" style="text-align: right;"><strong>Total Charges:</strong></td>
                        <td style="text-align: right;">${Number(selectedFolio.total_amount).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td colspan="3" style="text-align: right;"><strong>Total Paid:</strong></td>
                        <td style="text-align: right;">(${Number(selectedFolio.paid_amount).toLocaleString()})</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;"><strong>Balance:</strong></td>
                        <td style="text-align: right;" class="balance">${Number(selectedFolio.balance).toLocaleString()}</td>
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
                <h1 className="text-2xl font-bold text-slate-900">Folio History</h1>
                <p className="text-sm text-slate-500 mt-1">View closed and historical folios</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" /> Search Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Search</Label>
                            <Input
                                placeholder="Guest name, folio number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
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
                        <div className="flex items-end gap-2">
                            <Button onClick={fetchHistory} disabled={loading}>
                                <Search className="w-4 h-4 mr-2" /> Search
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5" /> Historical Folios
                        </div>
                        <Badge variant="secondary">{histories.length} folios</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : histories.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                            <p>No folio history found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Folio</TableHead>
                                    <TableHead>Guest / Room</TableHead>
                                    <TableHead>Closed Date</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {histories.map((folio) => (
                                    <TableRow key={folio.id}>
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
                                            {folio.closed_at 
                                                ? format(new Date(folio.closed_at), 'dd/MM/yyyy HH:mm')
                                                : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            ฿{Number(folio.total_amount || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600">
                                            (฿{Number(folio.paid_amount || 0).toLocaleString()})
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${folio.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ฿{Number(folio.balance || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={folio.status === 'closed' ? 'default' : 'secondary'}>
                                                {folio.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => viewDetail(folio)}
                                                >
                                                    View
                                                </Button>
                                            </div>
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
                                Folio #{selectedFolio?.folio_number || `Seq ${selectedFolio?.folio_seq}`}
                            </DialogTitle>
                            <Button variant="outline" size="sm" onClick={printFolio}>
                                <Printer className="w-4 h-4 mr-2" /> Print
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    {selectedFolio && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">Total Charges</p>
                                    <p className="text-xl font-bold">฿{Number(selectedFolio.total_amount || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-lg">
                                    <p className="text-sm text-green-600">Total Paid</p>
                                    <p className="text-xl font-bold text-green-600">฿{Number(selectedFolio.paid_amount || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">Balance</p>
                                    <p className={`text-xl font-bold ${selectedFolio.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ฿{Number(selectedFolio.balance || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">Status</p>
                                    <Badge>{selectedFolio.status}</Badge>
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
                                        {selectedFolio.items?.map((item: any) => (
                                            <TableRow key={item.id} style={{ opacity: item.is_voided ? 0.5 : 1, textDecoration: item.is_voided ? 'line-through' : 'none' }}>
                                                <TableCell>{format(new Date(item.item_date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell className="font-mono">{item.tran_code}</TableCell>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell className="text-right">฿{Number(item.amount).toLocaleString()}</TableCell>
                                                <TableCell>{getPayfBadge(item.payf, item.is_voided)}</TableCell>
                                            </TableRow>
                                        ))}
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