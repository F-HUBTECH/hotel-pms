'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getGroupById, getGroupMasterFolio, postGroupCharge, postGroupPayment } from '@/lib/actions/groups';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Plus, Receipt, CreditCard, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function GroupFolioPage() {
    const params = useParams();
    const groupId = params.id as string;
    const router = useRouter();
    
    const [group, setGroup] = useState<any>(null);
    const [folio, setFolio] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showChargeDialog, setShowChargeDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);

    const [chargeData, setChargeData] = useState({
        description: '',
        amount: 0,
        item_date: new Date().toISOString().split('T')[0]
    });

    const [paymentData, setPaymentData] = useState({
        description: '',
        amount: 0,
        item_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadData();
    }, [groupId]);

    async function loadData() {
        try {
            const [groupData, folioData] = await Promise.all([
                getGroupById(groupId),
                getGroupMasterFolio(groupId)
            ]);
            
            setGroup(groupData);
            setFolio(folioData);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handlePostCharge(e: React.FormEvent) {
        e.preventDefault();
        
        const result = await postGroupCharge(groupId, chargeData);
        if (result.success) {
            toast.success('Charge posted');
            setShowChargeDialog(false);
            setChargeData({ description: '', amount: 0, item_date: new Date().toISOString().split('T')[0] });
            loadData();
        } else {
            toast.error(result.error || 'Failed to post charge');
        }
    }

    async function handlePostPayment(e: React.FormEvent) {
        e.preventDefault();
        
        const result = await postGroupPayment(groupId, paymentData);
        if (result.success) {
            toast.success('Payment posted');
            setShowPaymentDialog(false);
            setPaymentData({ description: '', amount: 0, item_date: new Date().toISOString().split('T')[0] });
            loadData();
        } else {
            toast.error(result.error || 'Failed to post payment');
        }
    }

    const charges = folio?.transactions?.filter((t: any) => t.type === 'charge') || [];
    const payments = folio?.transactions?.filter((t: any) => t.type === 'payment') || [];
    const totalCharges = charges.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    const totalPayments = payments.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/dashboard/groups/${groupId}`}>
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold">Master Folio</h2>
                        <p className="text-sm text-muted-foreground">{group?.name}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowChargeDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Add Charge
                    </Button>
                    <Button onClick={() => setShowPaymentDialog(true)}>
                        <CreditCard className="w-4 h-4 mr-2" /> Add Payment
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-red-600" /> Total Charges
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">฿{totalCharges.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-green-600" /> Total Payments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">฿{totalPayments.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-indigo-600" /> Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${folio?.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ฿{folio?.balance?.toLocaleString() || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Receipt className="h-4 w-4" /> Transactions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{folio?.transactions?.length || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Charges */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-red-600" /> Charges
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b bg-muted/50">
                                <tr className="border-b">
                                    <th className="h-10 px-4 text-left font-medium">Date</th>
                                    <th className="h-10 px-4 text-left font-medium">Description</th>
                                    <th className="h-10 px-4 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {charges.length > 0 ? (
                                    charges.map((charge: any) => (
                                        <tr key={charge.id} className="border-b">
                                            <td className="p-4">{format(new Date(charge.item_date || charge.created_at), 'MMM dd')}</td>
                                            <td className="p-4">{charge.description}</td>
                                            <td className="p-4 text-right text-red-600 font-medium">
                                                +฿{charge.amount?.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-muted-foreground">
                                            No charges yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Payments */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-green-600" /> Payments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b bg-muted/50">
                                <tr className="border-b">
                                    <th className="h-10 px-4 text-left font-medium">Date</th>
                                    <th className="h-10 px-4 text-left font-medium">Description</th>
                                    <th className="h-10 px-4 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.length > 0 ? (
                                    payments.map((payment: any) => (
                                        <tr key={payment.id} className="border-b">
                                            <td className="p-4">{format(new Date(payment.item_date || payment.created_at), 'MMM dd')}</td>
                                            <td className="p-4">{payment.description}</td>
                                            <td className="p-4 text-right text-green-600 font-medium">
                                                -฿{payment.amount?.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-muted-foreground">
                                            No payments yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            {/* Add Charge Dialog */}
            <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Charge</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePostCharge}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="charge_description">Description *</Label>
                                <Input
                                    id="charge_description"
                                    value={chargeData.description}
                                    onChange={(e) => setChargeData({ ...chargeData, description: e.target.value })}
                                    placeholder="e.g. Room Charge, Dinner, etc."
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="charge_amount">Amount *</Label>
                                <Input
                                    id="charge_amount"
                                    type="number"
                                    min={0}
                                    value={chargeData.amount}
                                    onChange={(e) => setChargeData({ ...chargeData, amount: parseFloat(e.target.value) || 0 })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="charge_date">Date</Label>
                                <Input
                                    id="charge_date"
                                    type="date"
                                    value={chargeData.item_date}
                                    onChange={(e) => setChargeData({ ...chargeData, item_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowChargeDialog(false)}>Cancel</Button>
                            <Button type="submit">Post Charge</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Add Payment Dialog */}
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Payment</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePostPayment}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="payment_description">Description</Label>
                                <Input
                                    id="payment_description"
                                    value={paymentData.description}
                                    onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                                    placeholder="e.g. Cash, Credit Card, etc."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payment_amount">Amount *</Label>
                                <Input
                                    id="payment_amount"
                                    type="number"
                                    min={0}
                                    value={paymentData.amount}
                                    onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payment_date">Date</Label>
                                <Input
                                    id="payment_date"
                                    type="date"
                                    value={paymentData.item_date}
                                    onChange={(e) => setPaymentData({ ...paymentData, item_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
                            <Button type="submit">Post Payment</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
