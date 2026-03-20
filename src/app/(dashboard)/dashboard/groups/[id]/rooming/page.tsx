'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getGroupById, getGroupGuests, addGuestToGroup, updateGroupGuest, deleteGroupGuest, assignRoomToGuest } from '@/lib/actions/groups';
import { getRooms } from '@/lib/actions/rooms';
import { getRoomTypes } from '@/lib/actions/room-types';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit, User, DoorOpen, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function GroupRoomingPage() {
    const params = useParams();
    const groupId = params.id as string;
    const router = useRouter();
    
    const [guests, setGuests] = useState<any[]>([]);
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingGuest, setEditingGuest] = useState<any>(null);
    const [rooms, setRooms] = useState<any[]>([]);
    const [roomTypes, setRoomTypes] = useState<any[]>([]);
    const [assigningRoom, setAssigningRoom] = useState<any>(null);
    const [selectedGuests, setSelectedGuests] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        first_name: '',
        last_name: '',
        room_type_id: '',
        arrival_date: '',
        departure_date: '',
        pax_adult: 1,
        pax_child: 0,
        rate_amount: 0,
        rate_code: '',
        phone: '',
        email: '',
        passport_number: '',
        arrival_flight: '',
        arrival_time: '',
        departure_flight: '',
        departure_time: '',
        remark: ''
    });

    useEffect(() => {
        loadData();
    }, [groupId]);

    async function loadData() {
        try {
            const [groupData, guestsData, roomsData, rtData] = await Promise.all([
                getGroupById(groupId),
                getGroupGuests(groupId),
                getRooms(1, 200, ''),
                getRoomTypes(1, 100, '')
            ]);
            
            setGroup(groupData);
            setGuests(guestsData);
            setRooms(roomsData?.data || []);
            setRoomTypes(rtData?.data || []);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        
        const guestData = {
            group_id: groupId,
            room_type_id: formData.room_type_id || null,
            arrival_date: formData.arrival_date || group?.arrival_date,
            departure_date: formData.departure_date || group?.departure_date,
            pax_adult: parseInt(formData.pax_adult.toString()) || 1,
            pax_child: parseInt(formData.pax_child.toString()) || 0,
            rate_amount: parseFloat(formData.rate_amount.toString()) || 0,
            rate_code: formData.rate_code || null,
            title: formData.title || null,
            first_name: formData.first_name || null,
            last_name: formData.last_name || null,
            phone: formData.phone || null,
            email: formData.email || null,
            passport_number: formData.passport_number || null,
            arrival_flight: formData.arrival_flight || null,
            arrival_time: formData.arrival_time || null,
            departure_flight: formData.departure_flight || null,
            departure_time: formData.departure_time || null,
            remark: formData.remark || null,
            status: 'pending'
        };

        let result;
        if (editingGuest) {
            result = await updateGroupGuest(editingGuest.id, guestData, groupId);
        } else {
            result = await addGuestToGroup(guestData);
        }

        if (result.success) {
            toast.success(editingGuest ? 'Guest updated' : 'Guest added');
            setShowDialog(false);
            setEditingGuest(null);
            resetForm();
            loadData();
        } else {
            toast.error(result.error || 'Failed to save guest');
        }
    }

    async function handleDelete(guestId: string) {
        if (!confirm('Are you sure you want to delete this guest?')) return;

        const result = await deleteGroupGuest(guestId, groupId);
        if (result.success) {
            toast.success('Guest deleted');
            loadData();
        } else {
            toast.error(result.error || 'Failed to delete guest');
        }
    }

    async function handleAssignRoom(guestId: string, roomId: string) {
        const result = await assignRoomToGuest(guestId, roomId || null, groupId);
        if (result.success) {
            toast.success('Room assigned');
            setAssigningRoom(null);
            loadData();
        } else {
            toast.error(result.error || 'Failed to assign room');
        }
    }

    function resetForm() {
        setFormData({
            title: '',
            first_name: '',
            last_name: '',
            room_type_id: '',
            arrival_date: group?.arrival_date || '',
            departure_date: group?.departure_date || '',
            pax_adult: 1,
            pax_child: 0,
            rate_amount: 0,
            rate_code: '',
            phone: '',
            email: '',
            passport_number: '',
            arrival_flight: '',
            arrival_time: '',
            departure_flight: '',
            departure_time: '',
            remark: ''
        });
    }

    function openEditDialog(guest: any) {
        setEditingGuest(guest);
        setFormData({
            title: guest.title || '',
            first_name: guest.first_name || '',
            last_name: guest.last_name || '',
            room_type_id: guest.room_type_id || '',
            arrival_date: guest.arrival_date,
            departure_date: guest.departure_date,
            pax_adult: guest.pax_adult,
            pax_child: guest.pax_child,
            rate_amount: guest.rate_amount,
            rate_code: guest.rate_code || '',
            phone: guest.phone || '',
            email: guest.email || '',
            passport_number: guest.passport_number || '',
            arrival_flight: guest.arrival_flight || '',
            arrival_time: guest.arrival_time || '',
            departure_flight: guest.departure_flight || '',
            departure_time: guest.departure_time || '',
            remark: guest.remark || ''
        });
        setShowDialog(true);
    }

    const pendingGuests = guests.filter(g => g.status === 'pending');
    const confirmedGuests = guests.filter(g => g.status === 'confirmed');
    const checkedInGuests = guests.filter(g => g.status === 'checked_in');
    const checkedOutGuests = guests.filter(g => g.status === 'checked_out');

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
                        <h2 className="text-2xl font-bold">Rooming List</h2>
                        <p className="text-sm text-muted-foreground">{group?.name}</p>
                    </div>
                </div>
                <Button onClick={() => { resetForm(); setEditingGuest(null); setShowDialog(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Guest
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{guests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{pendingGuests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{confirmedGuests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Checked In</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{checkedInGuests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-600">{checkedOutGuests.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Guests Table */}
            <Card>
                <CardContent className="p-0">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b bg-muted/50">
                            <tr className="border-b">
                                <th className="h-12 px-4 text-left font-medium">Guest Name</th>
                                <th className="h-12 px-4 text-left font-medium">Room</th>
                                <th className="h-12 px-4 text-left font-medium">Room Type</th>
                                <th className="h-12 px-4 text-left font-medium">Arrival</th>
                                <th className="h-12 px-4 text-left font-medium">Departure</th>
                                <th className="h-12 px-4 text-center font-medium">Pax</th>
                                <th className="h-12 px-4 text-right font-medium">Rate</th>
                                <th className="h-12 px-4 text-center font-medium">Status</th>
                                <th className="h-12 px-4 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {guests.length > 0 ? (
                                guests.map((guest) => (
                                    <tr key={guest.id} className="border-b hover:bg-muted/50">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">
                                                    {guest.title} {guest.first_name} {guest.last_name}
                                                </span>
                                            </div>
                                            {guest.phone && <span className="text-xs text-muted-foreground">{guest.phone}</span>}
                                        </td>
                                        <td className="p-4">
                                            {assigningRoom?.id === guest.id ? (
                                                <select
                                                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                                                    value={guest.room_id || ''}
                                                    onChange={(e) => handleAssignRoom(guest.id, e.target.value)}
                                                    onBlur={() => setAssigningRoom(null)}
                                                    autoFocus
                                                >
                                                    <option value="">Select Room</option>
                                                    {rooms.filter(r => r.status === 'available' || r.id === guest.room_id).map((room) => (
                                                        <option key={room.id} value={room.id}>{room.room_number}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => setAssigningRoom(guest)}
                                                >
                                                    <DoorOpen className="h-4 w-4 mr-1" />
                                                    {guest.room_number || 'Assign'}
                                                </Button>
                                            )}
                                        </td>
                                        <td className="p-4">{guest.room_types?.name || '-'}</td>
                                        <td className="p-4">{format(new Date(guest.arrival_date), 'MMM dd')}</td>
                                        <td className="p-4">{format(new Date(guest.departure_date), 'MMM dd')}</td>
                                        <td className="p-4 text-center">
                                            {guest.pax_adult}A {guest.pax_child > 0 ? `${guest.pax_child}C` : ''}
                                        </td>
                                        <td className="p-4 text-right">฿{guest.rate_amount?.toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                guest.status === 'checked_in' ? 'bg-green-100 text-green-800' :
                                                guest.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                                guest.status === 'checked_out' ? 'bg-gray-100 text-gray-800' :
                                                guest.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {guest.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(guest)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(guest.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                        No guests in rooming list yet. Generate from Bookings or add manually.
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
                        <DialogTitle>{editingGuest ? 'Edit Guest' : 'Add Guest'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title</Label>
                                    <select
                                        id="title"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    >
                                        <option value="">Select</option>
                                        <option value="Mr.">Mr.</option>
                                        <option value="Mrs.">Mrs.</option>
                                        <option value="Ms.">Ms.</option>
                                        <option value="Miss">Miss</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="first_name">First Name *</Label>
                                    <Input
                                        id="first_name"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last_name">Last Name *</Label>
                                    <Input
                                        id="last_name"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

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
                                            <option key={rt.id} value={rt.id}>{rt.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="rate_amount">Rate</Label>
                                    <Input
                                        id="rate_amount"
                                        type="number"
                                        value={formData.rate_amount}
                                        onChange={(e) => setFormData({ ...formData, rate_amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="arrival_date">Arrival Date</Label>
                                    <Input
                                        id="arrival_date"
                                        type="date"
                                        value={formData.arrival_date}
                                        onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="departure_date">Departure Date</Label>
                                    <Input
                                        id="departure_date"
                                        type="date"
                                        value={formData.departure_date}
                                        onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="arrival_flight">Arrival Flight</Label>
                                    <Input
                                        id="arrival_flight"
                                        value={formData.arrival_flight}
                                        onChange={(e) => setFormData({ ...formData, arrival_flight: e.target.value })}
                                        placeholder="Flight number"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="arrival_time">Arrival Time</Label>
                                    <Input
                                        id="arrival_time"
                                        value={formData.arrival_time}
                                        onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                                        placeholder="e.g. 14:30"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="departure_flight">Departure Flight</Label>
                                    <Input
                                        id="departure_flight"
                                        value={formData.departure_flight}
                                        onChange={(e) => setFormData({ ...formData, departure_flight: e.target.value })}
                                        placeholder="Flight number"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="departure_time">Departure Time</Label>
                                    <Input
                                        id="departure_time"
                                        value={formData.departure_time}
                                        onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                                        placeholder="e.g. 11:00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="passport_number">Passport Number</Label>
                                <Input
                                    id="passport_number"
                                    value={formData.passport_number}
                                    onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="remark">Remark</Label>
                                <Textarea
                                    id="remark"
                                    value={formData.remark}
                                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                                    rows={2}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                            <Button type="submit">{editingGuest ? 'Update' : 'Add'} Guest</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
