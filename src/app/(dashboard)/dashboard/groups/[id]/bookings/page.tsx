'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getGroupById, getGroupBookings, createGroupBooking, updateGroupBooking, deleteGroupBooking, generateRoomingList } from '@/lib/actions/groups';
import { getRoomTypes } from '@/lib/actions/room-types';
import { getNamedEntities as getMarkets } from '@/lib/actions/generic-crud';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit, RefreshCw, BedDouble, Users, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function GroupBookingsPage() {
    const params = useParams();
    const groupId = params.id as string;
    const router = useRouter();
    
    const [bookings, setBookings] = useState<any[]>([]);
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingBooking, setEditingBooking] = useState<any>(null);
    const [roomTypes, setRoomTypes] = useState<any[]>([]);
    const [markets, setMarkets] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        room_type_id: '',
        arrival_date: '',
        departure_date: '',
        room_qty: 1,
        pax_adult: 1,
        pax_child: 0,
        rate_amount: 0,
        rate_code: '',
        commission_percent: 0,
        booktype: '',
        allot_code: '',
        remark: ''
    });

    useEffect(() => {
        loadData();
    }, [groupId]);

    async function loadData() {
        try {
            const [groupData, bookingsData, rtData, marketData] = await Promise.all([
                getGroupById(groupId),
                getGroupBookings(groupId),
                getRoomTypes(1, 100, ''),
                getMarkets('markets', 1, 100, '')
            ]);
            
            setGroup(groupData);
            setBookings(bookingsData);
            setRoomTypes(rtData?.data || []);
            setMarkets(marketData?.data || []);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        
        const bookingData = {
            group_id: groupId,
            room_type_id: formData.room_type_id || null,
            arrival_date: formData.arrival_date,
            departure_date: formData.departure_date,
            room_qty: parseInt(formData.room_qty.toString()) || 1,
            pax_adult: parseInt(formData.pax_adult.toString()) || 1,
            pax_child: parseInt(formData.pax_child.toString()) || 0,
            rate_amount: parseFloat(formData.rate_amount.toString()) || 0,
            rate_code: formData.rate_code || null,
            commission_percent: parseFloat(formData.commission_percent.toString()) || 0,
            booktype: formData.booktype || null,
            allot_code: formData.allot_code || null,
            remark: formData.remark || null,
            status: 'active'
        };

        let result;
        if (editingBooking) {
            result = await updateGroupBooking(editingBooking.id, bookingData, groupId);
        } else {
            result = await createGroupBooking(bookingData);
        }

        if (result.success) {
            toast.success(editingBooking ? 'Booking updated' : 'Booking created');
            setShowDialog(false);
            setEditingBooking(null);
            resetForm();
            loadData();
        } else {
            toast.error(result.error || 'Failed to save booking');
        }
    }

    async function handleDelete(bookingId: string) {
        if (!confirm('Are you sure you want to delete this booking?')) return;

        const result = await deleteGroupBooking(bookingId, groupId);
        if (result.success) {
            toast.success('Booking deleted');
            loadData();
        } else {
            toast.error(result.error || 'Failed to delete booking');
        }
    }

    async function handleGenerateRoomingList() {
        const result = await generateRoomingList(groupId);
        if (result.success) {
            toast.success(`Generated ${result.count} guest entries`);
            loadData();
        } else {
            toast.error(result.error || 'Failed to generate rooming list');
        }
    }

    function resetForm() {
        setFormData({
            room_type_id: '',
            arrival_date: group?.arrival_date || '',
            departure_date: group?.departure_date || '',
            room_qty: 1,
            pax_adult: 1,
            pax_child: 0,
            rate_amount: 0,
            rate_code: '',
            commission_percent: 0,
            booktype: '',
            allot_code: '',
            remark: ''
        });
    }

    function openEditDialog(booking: any) {
        setEditingBooking(booking);
        setFormData({
            room_type_id: booking.room_type_id || '',
            arrival_date: booking.arrival_date,
            departure_date: booking.departure_date,
            room_qty: booking.room_qty,
            pax_adult: booking.pax_adult,
            pax_child: booking.pax_child,
            rate_amount: booking.rate_amount,
            rate_code: booking.rate_code || '',
            commission_percent: booking.commission_percent || 0,
            booktype: booking.booktype || '',
            allot_code: booking.allot_code || '',
            remark: booking.remark || ''
        });
        setShowDialog(true);
    }

    function calculateNights(arrival: string, departure: string) {
        const start = new Date(arrival);
        const end = new Date(departure);
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

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
                        <h2 className="text-2xl font-bold">Group Bookings</h2>
                        <p className="text-sm text-muted-foreground">{group?.name}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleGenerateRoomingList}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Generate Rooming List
                    </Button>
                    <Button onClick={() => { resetForm(); setEditingBooking(null); setShowDialog(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Add Booking
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{bookings.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {bookings.reduce((sum, b) => sum + (b.room_qty || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Pax</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {bookings.reduce((sum, b) => sum + (b.pax_adult || 0) + (b.pax_child || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Est. Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            ฿{bookings.reduce((sum, b) => {
                                const nights = calculateNights(b.arrival_date, b.departure_date);
                                return sum + ((b.rate_amount || 0) * (b.room_qty || 0) * nights);
                            }, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bookings Table */}
            <Card>
                <CardContent className="p-0">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b bg-muted/50">
                            <tr className="border-b">
                                <th className="h-12 px-4 text-left font-medium">Room Type</th>
                                <th className="h-12 px-4 text-left font-medium">Arrival</th>
                                <th className="h-12 px-4 text-left font-medium">Departure</th>
                                <th className="h-12 px-4 text-center font-medium">Rooms</th>
                                <th className="h-12 px-4 text-center font-medium">Pax</th>
                                <th className="h-12 px-4 text-right font-medium">Rate</th>
                                <th className="h-12 px-4 text-right font-medium">Revenue</th>
                                <th className="h-12 px-4 text-center font-medium">Status</th>
                                <th className="h-12 px-4 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.length > 0 ? (
                                bookings.map((booking) => {
                                    const nights = calculateNights(booking.arrival_date, booking.departure_date);
                                    const revenue = (booking.rate_amount || 0) * (booking.room_qty || 0) * nights;
                                    return (
                                        <tr key={booking.id} className="border-b hover:bg-muted/50">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <BedDouble className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{booking.room_types?.name || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">{format(new Date(booking.arrival_date), 'MMM dd, yyyy')}</td>
                                            <td className="p-4">{format(new Date(booking.departure_date), 'MMM dd, yyyy')}</td>
                                            <td className="p-4 text-center">{booking.room_qty}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {(booking.pax_adult || 0) + (booking.pax_child || 0)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">฿{booking.rate_amount?.toLocaleString()}</td>
                                            <td className="p-4 text-right font-medium text-green-600">฿{revenue.toLocaleString()}</td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                    booking.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    booking.status === 'checked_in' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(booking)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(booking.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                        No bookings yet. Click "Add Booking" to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingBooking ? 'Edit Booking' : 'Add Booking'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="room_type_id">Room Type</Label>
                                    <select
                                        id="room_type_id"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.room_type_id}
                                        onChange={(e) => setFormData({ ...formData, room_type_id: e.target.value })}
                                    >
                                        <option value="">Select Room Type</option>
                                        {roomTypes.map((rt) => (
                                            <option key={rt.id} value={rt.id}>{rt.name} ({rt.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="booktype">Booking Type</Label>
                                    <Input
                                        id="booktype"
                                        value={formData.booktype}
                                        onChange={(e) => setFormData({ ...formData, booktype: e.target.value })}
                                        placeholder="e.g. FIT, GROUP"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="arrival_date">Arrival Date *</Label>
                                    <Input
                                        id="arrival_date"
                                        type="date"
                                        value={formData.arrival_date}
                                        onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="departure_date">Departure Date *</Label>
                                    <Input
                                        id="departure_date"
                                        type="date"
                                        value={formData.departure_date}
                                        onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="room_qty">Room Qty</Label>
                                    <Input
                                        id="room_qty"
                                        type="number"
                                        min={1}
                                        value={formData.room_qty}
                                        onChange={(e) => setFormData({ ...formData, room_qty: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pax_adult">Adults</Label>
                                    <Input
                                        id="pax_adult"
                                        type="number"
                                        min={0}
                                        value={formData.pax_adult}
                                        onChange={(e) => setFormData({ ...formData, pax_adult: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pax_child">Children</Label>
                                    <Input
                                        id="pax_child"
                                        type="number"
                                        min={0}
                                        value={formData.pax_child}
                                        onChange={(e) => setFormData({ ...formData, pax_child: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="rate_amount">Rate per Room</Label>
                                    <Input
                                        id="rate_amount"
                                        type="number"
                                        min={0}
                                        value={formData.rate_amount}
                                        onChange={(e) => setFormData({ ...formData, rate_amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="rate_code">Rate Code</Label>
                                    <Input
                                        id="rate_code"
                                        value={formData.rate_code}
                                        onChange={(e) => setFormData({ ...formData, rate_code: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="commission_percent">Commission %</Label>
                                    <Input
                                        id="commission_percent"
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={formData.commission_percent}
                                        onChange={(e) => setFormData({ ...formData, commission_percent: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="allot_code">Allotment Code</Label>
                                    <Input
                                        id="allot_code"
                                        value={formData.allot_code}
                                        onChange={(e) => setFormData({ ...formData, allot_code: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="remark">Remark</Label>
                                <Textarea
                                    id="remark"
                                    value={formData.remark}
                                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                            <Button type="submit">{editingBooking ? 'Update' : 'Create'} Booking</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
