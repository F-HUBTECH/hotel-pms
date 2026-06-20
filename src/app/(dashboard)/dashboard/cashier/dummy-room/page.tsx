'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { searchGuests } from '@/lib/actions/guests';
import { postFolioTransaction } from '@/lib/actions/folios';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Plus, Loader2, Trash2, Printer, Receipt, 
    DollarSign, Calendar, FileText, ArrowRightLeft, RefreshCw,
    Search, User, BedDouble
} from 'lucide-react';
import { toast } from 'sonner';

interface DummyTransaction {
    id: string;
    tran_date: string;
    tran_code: string;
    description: string;
    amount: number;
    reference: string | null;
    remark: string | null;
    status: string;
    created_at: string;
    folio_id?: string | null;
}

interface TransactionCode {
    code: string;
    description: string;
    default_vat_rate: number;
    default_serv_rate: number;
    vat_type: string;
    vat_inclusive: boolean;
}

interface Guest {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
}

interface Reservation {
    id: string;
    reservation_number: string;
    check_in_date: string;
    check_out_date: string;
    status: string;
    room: rooms;
    room_type: room_types;
}

interface rooms {
    id: string;
    room_number: string;
}

interface room_types {
    id: string;
    code: string;
    name: string;
}

interface Folio {
    id: string;
    folio_seq: number;
    status: string;
}

export default function DummyRoomFolioPage() {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<DummyTransaction[]>([]);
    const [tranCodes, setTranCodes] = useState<TransactionCode[]>([]);
    const [postOpen, setPostOpen] = useState(false);
    const [postLoading, setPostLoading] = useState(false);
    const [postingTranCode, setPostingTranCode] = useState('');
    const [postingDescription, setPostingDescription] = useState('');
    const [postingAmount, setPostingAmount] = useState(0);
    const [postingDate, setPostingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [postingReference, setPostingReference] = useState('');
    const [postingRemark, setPostingRemark] = useState('');

    const [transferOpen, setTransferOpen] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferTarget, setTransferTarget] = useState<DummyTransaction | null>(null);
    const [guestSearch, setGuestSearch] = useState('');
    const [guestResults, setGuestResults] = useState<Guest[]>([]);
    const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [folios, setFolios] = useState<Folio[]>([]);
    const [selectedFolioId, setSelectedFolioId] = useState<string>('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: tcData } = await supabase
            .from('revenue_transaction_codes')
            .select('code, description, default_vat_rate, default_serv_rate, vat_type, vat_inclusive')
            .eq('is_active', true)
            .eq('allow_manual_post', true)
            .order('sort_order');

        if (tcData) setTranCodes(tcData);

        const { data: dummyData } = await supabase
            .from('dummy_transactions')
            .select('*')
            .eq('status', 'active')
            .order('tran_date', { ascending: false });

        setTransactions(dummyData || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePostTransaction = async () => {
        if (!postingTranCode || !postingDescription || postingAmount <= 0) {
            toast.error('Please fill in all required fields');
            return;
        }

        setPostLoading(true);

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('dummy_transactions')
            .insert({
                tran_date: postingDate,
                tran_code: postingTranCode,
                description: postingDescription,
                amount: postingAmount,
                reference: postingReference || null,
                remark: postingRemark || null,
                status: 'active',
                created_by: user?.id
            });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Transaction posted successfully');
            setPostingTranCode('');
            setPostingDescription('');
            setPostingAmount(0);
            setPostingReference('');
            setPostingRemark('');
            setPostOpen(false);
            fetchData();
        }

        setPostLoading(false);
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;
        
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { error } = await supabase
            .from('dummy_transactions')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Transaction deleted');
            fetchData();
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

        const rowsHtml = transactions.map(t => `
            <tr>
                <td>${format(new Date(t.tran_date), 'dd/MM/yyyy')}</td>
                <td>${t.tran_code}</td>
                <td>${t.description}</td>
                <td style="text-align: right">${Number(t.amount).toLocaleString()}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dummy Room Folio</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; }
                    .total { font-weight: bold; font-size: 1.2em; }
                </style>
            </head>
            <body>
                <h1>Dummy Room Folio</h1>
                <p><strong>Date:</strong> ${format(new Date(), 'dd/MM/yyyy')}</p>
                <p><strong>Reference:</strong> DUMMY-ROOM</p>
                
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
                        ${rowsHtml || '<tr><td colspan="4">No transactions</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr class="total">
                            <td colspan="3" style="text-align: right;">Total:</td>
                            <td style="text-align: right;">฿${totalAmount.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <script>window.print();</script>
            </body>
            </html>
        `);
    };

    const selectTranCode = (code: string) => {
        setPostingTranCode(code);
        const tc = tranCodes.find(t => t.code === code);
        if (tc) {
            setPostingDescription(tc.description);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <Badge>CHRG</Badge>;
            case 'transferred': return <Badge className="bg-blue-100 text-blue-700">TRANSFERRED</Badge>;
            case 'cancelled': return <Badge variant="destructive">CANCELLED</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const openTransferDialog = (tran: DummyTransaction) => {
        setTransferTarget(tran);
        setGuestSearch('');
        setGuestResults([]);
        setSelectedGuest(null);
        setReservations([]);
        setSelectedReservation(null);
        setFolios([]);
        setSelectedFolioId('');
        setTransferOpen(true);
    };

    const handleGuestSearch = async () => {
        if (guestSearch.length < 2) return;
        setTransferLoading(true);
        const results = await searchGuests(guestSearch);
        setGuestResults(results);
        setTransferLoading(false);
    };

    const selectGuestForTransfer = async (guest: Guest) => {
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
        
        setReservations((data as any) || []);
    };

    const selectReservationForTransfer = async (res: Reservation) => {
        setSelectedReservation(res);
        
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data } = await supabase
            .from('folios')
            .select('id, folio_seq, status')
            .eq('reservation_id', res.id)
            .eq('status', 'open')
            .order('folio_seq');
        
        setFolios(data || []);
    };

    const handleTransferToFolio = async () => {
        if (!transferTarget || !selectedFolioId) {
            toast.error('Please select a target folio');
            return;
        }

        setTransferLoading(true);

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user } } = await supabase.auth.getUser();

        const result = await postFolioTransaction({
            folio_id: selectedFolioId,
            tran_code: transferTarget.tran_code,
            description: transferTarget.description,
            amount: transferTarget.amount,
            quantity: 1,
            item_date: transferTarget.tran_date,
            reference: transferTarget.reference,
            remark: `Transferred from Dummy Room Folio. Original: ${transferTarget.remark || 'N/A'}`,
        });

        if (result.success && result.data?.item_id) {
            await supabase
                .from('folio_transfer_logs')
                .insert({
                    item_id: result.data.item_id,
                    source_folio_id: null,
                    target_folio_id: selectedFolioId,
                    tran_code: transferTarget.tran_code,
                    description: transferTarget.description,
                    amount: transferTarget.amount,
                    tran_date: transferTarget.tran_date,
                    transferred_by: user?.id,
                    remark: `Transferred from Dummy Room Folio. Original remark: ${transferTarget.remark || 'N/A'}`,
                    transfer_type: 'dummy_to_folio'
                });

            await supabase
                .from('dummy_transactions')
                .update({ 
                    status: 'transferred',
                    folio_id: selectedFolioId
                })
                .eq('id', transferTarget.id);

            toast.success('Transaction transferred successfully');
            setTransferOpen(false);
            fetchData();
        } else {
            toast.error(result.error || 'Failed to transfer transaction');
        }

        setTransferLoading(false);
    };

    const activeTransactions = transactions.filter(t => t.status === 'active');

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dummy Room Folio</h1>
                    <p className="text-sm text-slate-500 mt-1">Post charges without a specific reservation</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <Button onClick={() => setPostOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" /> Post Charge
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeTransactions.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-600">
                            ฿{activeTransactions.reduce((sum, t) => sum + Number(t.amount), 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Date</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">{format(new Date(), 'dd/MM/yyyy')}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" /> Transactions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : activeTransactions.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                            <p>No transactions yet</p>
                            <p className="text-sm mt-1">Click "Post Charge" to add a new transaction</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeTransactions.map((tran) => (
                                    <TableRow key={tran.id}>
                                        <TableCell>{format(new Date(tran.tran_date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="font-mono">{tran.tran_code}</TableCell>
                                        <TableCell>{tran.description}</TableCell>
                                        <TableCell>{tran.reference || '-'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ฿{Number(tran.amount).toLocaleString()}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(tran.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={() => openTransferDialog(tran)}
                                                    title="Transfer to folio"
                                                >
                                                    <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={() => handleDeleteTransaction(tran.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
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

            {/* Post Charge Dialog */}
            <Dialog open={postOpen} onOpenChange={setPostOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Post Charge - Dummy Room</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Transaction Code *</Label>
                            <Select value={postingTranCode} onValueChange={selectTranCode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select code" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tranCodes.map((tc) => (
                                        <SelectItem key={tc.code} value={tc.code}>
                                            {tc.code} - {tc.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Description *</Label>
                            <Input 
                                value={postingDescription} 
                                onChange={(e) => setPostingDescription(e.target.value)}
                                placeholder="Transaction description"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Amount *</Label>
                            <Input 
                                type="number"
                                min={0}
                                value={postingAmount} 
                                onChange={(e) => setPostingAmount(Number(e.target.value))}
                                placeholder="0.00"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input 
                                type="date"
                                value={postingDate} 
                                onChange={(e) => setPostingDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Reference</Label>
                            <Input 
                                value={postingReference} 
                                onChange={(e) => setPostingReference(e.target.value)}
                                placeholder="Reference number (optional)"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Remark</Label>
                            <Input 
                                value={postingRemark} 
                                onChange={(e) => setPostingRemark(e.target.value)}
                                placeholder="Internal notes (optional)"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setPostOpen(false)}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={handlePostTransaction}
                                disabled={postLoading || !postingTranCode || !postingDescription || postingAmount <= 0}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {postLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Post Charge
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Transfer Dialog */}
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Transfer to Guest Folio</DialogTitle>
                        <DialogDescription>
                            Transfer this charge to a real guest&apos;s folio
                        </DialogDescription>
                    </DialogHeader>
                    
                    {transferTarget && (
                        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-4">
                            <div className="text-sm text-indigo-600 mb-1">Transaction to transfer:</div>
                            <div className="font-medium text-indigo-900">{transferTarget.description}</div>
                            <div className="text-lg font-bold text-indigo-700">
                                ฿{Number(transferTarget.amount).toLocaleString()}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {!selectedGuest ? (
                            <div className="space-y-2">
                                <Label>Search Guest *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Search by name, phone, or email..."
                                        value={guestSearch}
                                        onChange={(e) => setGuestSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGuestSearch()}
                                    />
                                    <Button onClick={handleGuestSearch} disabled={transferLoading}>
                                        {transferLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    </Button>
                                </div>
                                {guestResults.length > 0 && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                                        {guestResults.map((guest) => (
                                            <button
                                                key={guest.id}
                                                onClick={() => selectGuestForTransfer(guest)}
                                                className="w-full p-3 text-left rounded-lg border hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                    <span className="font-medium">
                                                        {guest.first_name} {guest.last_name}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-500 ml-6">
                                                    {guest.email || guest.phone || 'No contact'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : !selectedReservation ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Select Reservation *</Label>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedGuest(null)}>
                                        Change Guest
                                    </Button>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg mb-2">
                                    <div className="font-medium">{selectedGuest.first_name} {selectedGuest.last_name}</div>
                                </div>
                                {reservations.length === 0 ? (
                                    <p className="text-slate-500 text-sm py-4 text-center">No active reservations found</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {reservations.map((res) => (
                                            <button
                                                key={res.id}
                                                onClick={() => selectReservationForTransfer(res)}
                                                className="w-full p-3 text-left rounded-lg border hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <BedDouble className="w-4 h-4 text-slate-400" />
                                                        <span className="font-medium">
                                                            {res.room?.room_number || 'N/A'}
                                                        </span>
                                                        <span className="text-slate-500 text-sm">
                                                            ({res.room_type?.name || 'N/A'})
                                                        </span>
                                                    </div>
                                                    <Badge>{res.status}</Badge>
                                                </div>
                                                <div className="text-sm text-slate-500 mt-1">
                                                    {format(new Date(res.check_in_date), 'dd/MM/yyyy')} - {format(new Date(res.check_out_date), 'dd/MM/yyyy')}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : !selectedFolioId ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Select Folio *</Label>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedReservation(null)}>
                                        Change Reservation
                                    </Button>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg mb-2">
                                    <div className="font-medium">
                                        {selectedReservation.room?.room_number || 'N/A'} - {selectedReservation.room_type?.name || 'N/A'}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        {format(new Date(selectedReservation.check_in_date), 'dd/MM/yyyy')} - {format(new Date(selectedReservation.check_out_date), 'dd/MM/yyyy')}
                                    </div>
                                </div>
                                {folios.length === 0 ? (
                                    <p className="text-slate-500 text-sm py-4 text-center">No open folios available</p>
                                ) : (
                                    <div className="space-y-2">
                                        {folios.map((folio) => (
                                            <button
                                                key={folio.id}
                                                onClick={() => setSelectedFolioId(folio.id)}
                                                className={`w-full p-3 text-left rounded-lg border transition-all ${
                                                    selectedFolioId === folio.id 
                                                        ? 'border-indigo-500 bg-indigo-50' 
                                                        : 'hover:border-indigo-300 hover:bg-indigo-50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">Folio {folio.folio_seq}</span>
                                                    <Badge variant="outline">{folio.status}</Badge>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                    <div className="text-sm text-green-600 mb-1">Ready to transfer to:</div>
                                    <div className="font-medium text-green-900">
                                        {selectedGuest?.first_name} {selectedGuest?.last_name}
                                    </div>
                                    <div className="text-sm text-green-700">
                                        Room {selectedReservation.room?.room_number} - Folio {folios.find(f => f.id === selectedFolioId)?.folio_seq}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setTransferOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={handleTransferToFolio} 
                                        disabled={transferLoading}
                                        className="bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        {transferLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Transfer
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}