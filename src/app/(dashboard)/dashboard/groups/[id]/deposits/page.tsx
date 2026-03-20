'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getGroupById, getGroupDeposits, addGroupDeposit } from '@/lib/actions/groups';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Plus, Wallet, DollarSign, CreditCard, Banknote, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function GroupDepositsPage() {
    const params = useParams();
    const groupId = params.id as string;
    const router = useRouter();
    
    const [group, setGroup] = useState<any>(null);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);

    const [formData, setFormData] = useState({
        tran_date: new Date().toISOString().split('T')[0],
        tran_code: 'DEP',
        description: '',
        amount: 0,
        payment_method: 'cash',
        reference: ''
    });

    useEffect(() => {
        loadData();
    }, [groupId]);

    async function loadData() {
        try {
            const [groupData, depositsData] = await Promise.all([
                getGroupById(groupId),
                getGroupDeposits(groupId)
            ]);
            
            setGroup(groupData);
            setDeposits(depositsData);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        
        const depositData = {
            group_id: groupId,
            tran_date: formData.tran_date,
            tran_code: formData.tran_code,
            description: formData.description || 'Deposit',
            amount: parseFloat(formData.amount.toString()) || 0,
            original_amount: parseFloat(formData.amount.toString()) || 0,
            payment_method: formData.payment_method,
            reference: formData.reference || null,
            status: 'pending'
        };

        const result = await addGroupDeposit(depositData);
        if (result.success) {
            toast.success('Deposit added');
            setShowDialog(false);
            setFormData({
                tran_date: new Date().toISOString().split('T')[0],
                tran_code: 'DEP',
                description: '',
                amount: 0,
                payment_method: 'cash',
                reference: ''
            });
            loadData();
        } else {
            toast.error(result.error || 'Failed to add deposit');
        }
    }

    const pendingDeposits = deposits.filter(d => d.status === 'pending');
    const appliedDeposits = deposits.filter(d => d.status === 'applied');
    const transferredDeposits = deposits.filter(d => d.status === 'transferred');
    const totalAmount = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);

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
                        <h2 className="text-2xl font-bold">Deposits</h2>
                        <p className="text-sm text-muted-foreground">{group?.name}</p>
                    </div>
                </div>
                <Button onClick={() => setShowDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Deposit
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">฿{totalAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-yellow-600" /> Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{pendingDeposits.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4 text-blue-600" /> Applied
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{appliedDeposits.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600" /> Transferred
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{transferredDeposits.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Deposits Table */}
            <Card>
                <CardContent className="p-0">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b bg-muted/50">
                            <tr className="border-b">
                                <th className="h-12 px-4 text-left font-medium">Date</th>
                                <th className="h-12 px-4 text-left font-medium">Code</th>
                                <th className="h-12 px-4 text-left font-medium">Description</th>
                                <th className="h-12 px-4 text-left font-medium">Payment</th>
                                <th className="h-12 px-4 text-left font-medium">Reference</th>
                                <th className="h-12 px-4 text-right font-medium">Amount</th>
                                <th className="h-12 px-4 text-center font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deposits.length > 0 ? (
                                deposits.map((deposit) => (
                                    <tr key={deposit.id} className="border-b hover:bg-muted/50">
                                        <td className="p-4">
                                            {format(new Date(deposit.tran_date), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-xs">{deposit.tran_code}</span>
                                        </td>
                                        <td className="p-4">{deposit.description}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1">
                                                {deposit.payment_method === 'cash' && <Banknote className="h-4 w-4" />}
                                                {deposit.payment_method === 'credit_card' && <CreditCard className="h-4 w-4" />}
                                                {deposit.payment_method === 'bank_transfer' && <ArrowRightLeft className="h-4 w-4" />}
                                                <span className="text-xs">{deposit.payment_method}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">{deposit.reference || '-'}</td>
                                        <td className="p-4 text-right font-medium text-green-600">
                                            ฿{deposit.amount?.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                deposit.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                deposit.status === 'applied' ? 'bg-blue-100 text-blue-800' :
                                                deposit.status === 'transferred' ? 'bg-green-100 text-green-800' :
                                                deposit.status === 'refunded' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {deposit.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                        No deposits yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Add Deposit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Deposit</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tran_date">Date</Label>
                                    <Input
                                        id="tran_date"
                                        type="date"
                                        value={formData.tran_date}
                                        onChange={(e) => setFormData({ ...formData, tran_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tran_code">Code</Label>
                                    <Input
                                        id="tran_code"
                                        value={formData.tran_code}
                                        onChange={(e) => setFormData({ ...formData, tran_code: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Deposit for group booking"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount *</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    min={0}
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="payment_method">Payment Method</Label>
                                <select
                                    id="payment_method"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.payment_method}
                                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="credit_card">Credit Card</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reference">Reference</Label>
                                <Input
                                    id="reference"
                                    value={formData.reference}
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    placeholder="Receipt number, card last 4 digits, etc."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                            <Button type="submit">Add Deposit</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
