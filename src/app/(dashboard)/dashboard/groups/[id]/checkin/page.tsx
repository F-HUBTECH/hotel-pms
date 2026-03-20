'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getGroupById, getGroupGuests, checkInGroupGuest, checkInGroupAll, checkInGroupPartial, checkOutGroupGuest } from '@/lib/actions/groups';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, UserCheck, UserX, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function GroupCheckinPage() {
    const params = useParams();
    const groupId = params.id as string;
    const router = useRouter();
    
    const [guests, setGuests] = useState<any[]>([]);
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        loadData();
    }, [groupId]);

    async function loadData() {
        try {
            const [groupData, guestsData] = await Promise.all([
                getGroupById(groupId),
                getGroupGuests(groupId)
            ]);
            
            setGroup(groupData);
            setGuests(guestsData);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handleCheckInGuest(guestId: string) {
        const result = await checkInGroupGuest(guestId, groupId);
        if (result.success) {
            toast.success('Guest checked in');
            loadData();
        } else {
            toast.error(result.error || 'Failed to check in');
        }
    }

    async function handleCheckOutGuest(guestId: string) {
        const result = await checkOutGroupGuest(guestId, groupId);
        if (result.success) {
            toast.success('Guest checked out');
            loadData();
        } else {
            toast.error(result.error || 'Failed to check out');
        }
    }

    async function handleCheckInAll() {
        if (!confirm(`Check in all ${pendingGuests.length} pending guests?`)) return;

        const result = await checkInGroupAll(groupId);
        if (result.success) {
            toast.success('All guests checked in');
            loadData();
        } else {
            toast.error(result.error || 'Failed to check in');
        }
    }

    async function handleCheckInSelected() {
        if (selectedGuests.length === 0) {
            toast.error('Please select guests to check in');
            return;
        }

        const result = await checkInGroupPartial(groupId, selectedGuests);
        if (result.success) {
            toast.success(`${selectedGuests.length} guests checked in`);
            setSelectedGuests([]);
            loadData();
        } else {
            toast.error(result.error || 'Failed to check in');
        }
    }

    function toggleSelectGuest(guestId: string) {
        setSelectedGuests(prev => 
            prev.includes(guestId)
                ? prev.filter(id => id !== guestId)
                : [...prev, guestId]
        );
    }

    function toggleSelectAll() {
        if (selectedGuests.length === filteredGuests.length) {
            setSelectedGuests([]);
        } else {
            setSelectedGuests(filteredGuests.map(g => g.id));
        }
    }

    const pendingGuests = guests.filter(g => g.status === 'pending' || g.status === 'confirmed');
    const checkedInGuests = guests.filter(g => g.status === 'checked_in');
    const checkedOutGuests = guests.filter(g => g.status === 'checked_out');

    const filteredGuests = guests.filter(g => {
        if (filter === 'all') return true;
        if (filter === 'pending') return g.status === 'pending' || g.status === 'confirmed';
        if (filter === 'checked_in') return g.status === 'checked_in';
        if (filter === 'checked_out') return g.status === 'checked_out';
        return true;
    });

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
                        <h2 className="text-2xl font-bold">Group Check-in</h2>
                        <p className="text-sm text-muted-foreground">{group?.name}</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-600" /> Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{pendingGuests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-green-600" /> Checked In
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{checkedInGuests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-600" /> Total Guests
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{guests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <UserX className="h-4 w-4 text-gray-600" /> Checked Out
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-600">{checkedOutGuests.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <Button onClick={handleCheckInAll} disabled={pendingGuests.length === 0}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Check In All ({pendingGuests.length})
                </Button>
                <Button 
                    variant="outline" 
                    onClick={handleCheckInSelected} 
                    disabled={selectedGuests.length === 0}
                >
                    <UserCheck className="w-4 h-4 mr-2" /> Check In Selected ({selectedGuests.length})
                </Button>
            </div>

            {/* Filter */}
            <div className="flex gap-2">
                <Button 
                    variant={filter === 'all' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilter('all')}
                >
                    All
                </Button>
                <Button 
                    variant={filter === 'pending' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilter('pending')}
                >
                    Pending ({pendingGuests.length})
                </Button>
                <Button 
                    variant={filter === 'checked_in' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilter('checked_in')}
                >
                    Checked In ({checkedInGuests.length})
                </Button>
                <Button 
                    variant={filter === 'checked_out' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilter('checked_out')}
                >
                    Checked Out ({checkedOutGuests.length})
                </Button>
            </div>

            {/* Guests Table */}
            <Card>
                <CardContent className="p-0">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b bg-muted/50">
                            <tr className="border-b">
                                <th className="h-12 px-4 w-10">
                                    <Checkbox 
                                        checked={selectedGuests.length === filteredGuests.length && filteredGuests.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="h-12 px-4 text-left font-medium">Guest Name</th>
                                <th className="h-12 px-4 text-left font-medium">Room</th>
                                <th className="h-12 px-4 text-left font-medium">Arrival</th>
                                <th className="h-12 px-4 text-left font-medium">Departure</th>
                                <th className="h-12 px-4 text-left font-medium">Check-in</th>
                                <th className="h-12 px-4 text-center font-medium">Status</th>
                                <th className="h-12 px-4 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGuests.length > 0 ? (
                                filteredGuests.map((guest) => (
                                    <tr key={guest.id} className="border-b hover:bg-muted/50">
                                        <td className="p-4">
                                            <Checkbox 
                                                checked={selectedGuests.includes(guest.id)}
                                                onCheckedChange={() => toggleSelectGuest(guest.id)}
                                                disabled={guest.status === 'checked_in' || guest.status === 'checked_out'}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <span className="font-medium">
                                                {guest.title} {guest.first_name} {guest.last_name}
                                            </span>
                                            {guest.phone && <span className="block text-xs text-muted-foreground">{guest.phone}</span>}
                                        </td>
                                        <td className="p-4">
                                            {guest.room_number || '-'}
                                        </td>
                                        <td className="p-4">{format(new Date(guest.arrival_date), 'MMM dd, yyyy')}</td>
                                        <td className="p-4">{format(new Date(guest.departure_date), 'MMM dd, yyyy')}</td>
                                        <td className="p-4">
                                            {guest.check_in_date ? (
                                                <span className="text-sm">
                                                    {format(new Date(guest.check_in_date), 'MMM dd')} {guest.check_in_time}
                                                </span>
                                            ) : '-'}
                                        </td>
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
                                            {guest.status === 'pending' || guest.status === 'confirmed' ? (
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => handleCheckInGuest(guest.id)}
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-1" /> Check In
                                                </Button>
                                            ) : guest.status === 'checked_in' ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => handleCheckOutGuest(guest.id)}
                                                >
                                                    <XCircle className="w-4 h-4 mr-1" /> Check Out
                                                </Button>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                        No guests found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
