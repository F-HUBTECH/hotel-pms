'use client';

import { useState, useEffect } from 'react';
import { getCorporateAllotments, getCorporateAllotmentById, createCorporateAllotment, updateCorporateAllotment, deleteCorporateAllotment, addAllotmentRoomType, updateAllotmentRoomType, deleteAllotmentRoomType, getAllotmentDaily, syncAllotmentDaily, getAllotmentPickups, cancelAllotmentPickup } from '@/lib/actions/allotments';
import { getRoomTypes } from '@/lib/actions/rooms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Building2, Calendar, RefreshCw, Loader2, ChevronLeft, X, Save, TrendingUp, TrendingDown, Bed } from 'lucide-react';
import { toast } from 'sonner';

interface AllotmentRoomType {
    id: string;
    room_type_id: string;
    agreed_rooms: number;
    base_rate: number;
    room_type?: any;
}

interface DailyAllotment {
    id: string;
    allott_date: string;
    total_rooms: number;
    used_rooms: number;
    available_rooms: number;
    room_type_id: string;
    room_type?: any;
}

interface Pickup {
    id: string;
    reservation_id: string;
    pickup_date: string;
    rooms_picked: number;
    rate: number;
    status: string;
    reservation?: any;
}

export default function AllotmentsPage() {
    const [allotments, setAllotments] = useState<any[]>([]);
    const [roomTypes, setRoomTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAllotment, setEditingAllotment] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    const [selectedAllotment, setSelectedAllotment] = useState<any>(null);
    const [allotmentRoomTypes, setAllotmentRoomTypes] = useState<AllotmentRoomType[]>([]);
    const [dailyData, setDailyData] = useState<DailyAllotment[]>([]);
    const [pickups, setPickups] = useState<Pickup[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [roomTypeDialogOpen, setRoomTypeDialogOpen] = useState(false);
    const [editingRoomType, setEditingRoomType] = useState<AllotmentRoomType | null>(null);
    const [detailTab, setDetailTab] = useState('overview');

    const [rtForm, setRtForm] = useState({
        room_type_id: '',
        agreed_rooms: 0,
        base_rate: 0,
    });

    const [form, setForm] = useState({
        allot_code: '',
        company_name: '',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        valid_from: '',
        valid_to: '',
        room_type_id: '',
        agreed_rooms: 0,
        base_rate: 0,
        is_active: true,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [allotRes, roomTypeRes] = await Promise.all([
            getCorporateAllotments(),
            getRoomTypes(1, 100, '')
        ]);
        if (allotRes.success) setAllotments(allotRes.data || []);
        if (roomTypeRes?.data) setRoomTypes(roomTypeRes.data);
        setLoading(false);
    };

    const fetchAllotmentDetail = async (allot: any) => {
        setLoadingDetail(true);
        setSelectedAllotment(allot);
        
        const [detailRes, pickupsRes] = await Promise.all([
            getCorporateAllotmentById(allot.id),
            getAllotmentPickups(allot.id)
        ]);

        if (detailRes.success && detailRes.data) {
            setAllotmentRoomTypes(detailRes.data.allotment_room_types || []);
            
            if (detailRes.data.valid_from && detailRes.data.valid_to) {
                const dailyRes = await getAllotmentDaily(
                    allot.id,
                    detailRes.data.valid_from,
                    detailRes.data.valid_to
                );
                if (dailyRes.success) {
                    setDailyData(dailyRes.data || []);
                }
            }
        }

        if (pickupsRes.success) {
            setPickups(pickupsRes.data || []);
        }

        setLoadingDetail(false);
        setDetailDialogOpen(true);
    };

    const openNewDialog = () => {
        setEditingAllotment(null);
        setForm({
            allot_code: '',
            company_name: '',
            contact_person: '',
            contact_email: '',
            contact_phone: '',
            valid_from: '',
            valid_to: '',
            room_type_id: '',
            agreed_rooms: 0,
            base_rate: 0,
            is_active: true,
        });
        setDialogOpen(true);
    };

    const openEditDialog = (allot: any) => {
        setEditingAllotment(allot);
        setForm({
            allot_code: allot.allot_code || '',
            company_name: allot.company_name || '',
            contact_person: allot.contact_person || '',
            contact_email: allot.contact_email || '',
            contact_phone: allot.contact_phone || '',
            valid_from: allot.valid_from || '',
            valid_to: allot.valid_to || '',
            room_type_id: allot.room_type_id || '',
            agreed_rooms: allot.agreed_rooms || 0,
            base_rate: allot.base_rate || 0,
            is_active: allot.is_active ?? true,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);

        if (editingAllotment) {
            const res = await updateCorporateAllotment(editingAllotment.id, form);
            if (res.success) {
                toast.success('Allotment updated');
                fetchData();
                setDialogOpen(false);
            } else {
                toast.error(res.error || 'Failed to update');
            }
        } else {
            const res = await createCorporateAllotment(form);
            if (res.success && res.data) {
                if (form.room_type_id && form.agreed_rooms > 0) {
                    await addAllotmentRoomType(res.data.id, {
                        room_type_id: form.room_type_id,
                        agreed_rooms: form.agreed_rooms,
                        base_rate: form.base_rate,
                    });
                }
                toast.success('Allotment created');
                fetchData();
                setDialogOpen(false);
            } else {
                toast.error(res.error || 'Failed to create');
            }
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this allotment?')) return;
        const res = await deleteCorporateAllotment(id);
        if (res.success) {
            toast.success('Allotment deleted');
            fetchData();
        } else {
            toast.error(res.error || 'Failed to delete');
        }
    };

    const handleAddRoomType = async () => {
        if (!selectedAllotment || !rtForm.room_type_id || rtForm.agreed_rooms <= 0) {
            toast.error('Please fill in all required fields');
            return;
        }

        const res = await addAllotmentRoomType(selectedAllotment.id, rtForm);
        if (res.success) {
            toast.success('Room type added');
            await syncAllotmentDaily(
                selectedAllotment.id,
                rtForm.room_type_id,
                selectedAllotment.valid_from,
                selectedAllotment.valid_to,
                rtForm.agreed_rooms
            );
            fetchAllotmentDetail(selectedAllotment);
            fetchData();
            setRoomTypeDialogOpen(false);
            setRtForm({ room_type_id: '', agreed_rooms: 0, base_rate: 0 });
        } else {
            toast.error(res.error || 'Failed to add room type');
        }
    };

    const handleUpdateRoomType = async () => {
        if (!editingRoomType) return;

        const res = await updateAllotmentRoomType(editingRoomType.id, {
            agreed_rooms: rtForm.agreed_rooms,
            base_rate: rtForm.base_rate,
        });

        if (res.success) {
            toast.success('Room type updated');
            await syncAllotmentDaily(
                selectedAllotment.id,
                editingRoomType.room_type_id,
                selectedAllotment.valid_from,
                selectedAllotment.valid_to,
                rtForm.agreed_rooms
            );
            fetchAllotmentDetail(selectedAllotment);
            setRoomTypeDialogOpen(false);
            setEditingRoomType(null);
        } else {
            toast.error(res.error || 'Failed to update room type');
        }
    };

    const handleDeleteRoomType = async (rtId: string, roomTypeId: string) => {
        if (!confirm('Are you sure you want to remove this room type?')) return;

        const res = await deleteAllotmentRoomType(rtId);
        if (res.success) {
            toast.success('Room type removed');
            fetchAllotmentDetail(selectedAllotment);
            fetchData();
        } else {
            toast.error(res.error || 'Failed to remove room type');
        }
    };

    const handleCancelPickup = async (pickupId: string) => {
        if (!confirm('Are you sure you want to cancel this pickup?')) return;

        const res = await cancelAllotmentPickup(pickupId);
        if (res.success) {
            toast.success('Pickup cancelled');
            fetchAllotmentDetail(selectedAllotment);
        } else {
            toast.error(res.error || 'Failed to cancel pickup');
        }
    };

    const openRoomTypeDialog = (rt?: AllotmentRoomType) => {
        if (rt) {
            setEditingRoomType(rt);
            setRtForm({
                room_type_id: rt.room_type_id,
                agreed_rooms: rt.agreed_rooms,
                base_rate: rt.base_rate,
            });
        } else {
            setEditingRoomType(null);
            setRtForm({ room_type_id: '', agreed_rooms: 0, base_rate: 0 });
        }
        setRoomTypeDialogOpen(true);
    };

    const getRoomTypeName = (id: string) => {
        const rt = roomTypes.find(r => r.id === id);
        return rt?.name || rt?.code || 'Unknown';
    };

    const formatDate = (date: string) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getDailyForRoomType = (roomTypeId: string) => {
        return dailyData.filter(d => d.room_type_id === roomTypeId);
    };

    const totalAgreed = allotmentRoomTypes.reduce((sum, rt) => sum + rt.agreed_rooms, 0);
    const totalUsed = dailyData.reduce((sum, d) => sum + d.used_rooms, 0);
    const totalAvailable = dailyData.reduce((sum, d) => sum + d.available_rooms, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Corporate Allotments</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage room allotments for tour agencies and corporate partners</p>
                </div>
                <Button onClick={openNewDialog} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> New Allotment
                </Button>
            </div>

            {allotments.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No Allotments Yet</h3>
                        <p className="text-slate-500 mb-4">Create your first corporate allotment to reserve rooms for tour agencies.</p>
                        <Button onClick={openNewDialog}>
                            <Plus className="w-4 h-4 mr-2" /> Create Allotment
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Valid Period</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allotments.map((allot) => (
                                    <TableRow key={allot.id}>
                                        <TableCell className="font-medium">
                                            <button 
                                                onClick={() => fetchAllotmentDetail(allot)}
                                                className="text-indigo-600 hover:text-indigo-800 hover:underline"
                                            >
                                                {allot.allot_code}
                                            </button>
                                        </TableCell>
                                        <TableCell>{allot.company_name}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div>{allot.contact_person}</div>
                                                <div className="text-slate-500">{allot.contact_email}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-sm">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                {allot.valid_from} - {allot.valid_to}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">฿{Number(allot.base_rate || 0).toLocaleString()}</div>
                                            <div className="text-xs text-slate-500">per night</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={allot.is_active ? 'default' : 'secondary'}>
                                                {allot.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(allot)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(allot.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingAllotment ? 'Edit Allotment' : 'New Allotment'}</DialogTitle>
                        <DialogDescription>
                            {editingAllotment ? 'Update the allotment details' : 'Create a new corporate room allotment'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Allotment Code *</Label>
                            <Input
                                value={form.allot_code}
                                onChange={(e) => setForm({ ...form, allot_code: e.target.value.toUpperCase() })}
                                placeholder="e.g. TA-2024-001"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Company Name *</Label>
                            <Input
                                value={form.company_name}
                                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                placeholder="e.g. ABC Tour Co."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Person</Label>
                            <Input
                                value={form.contact_person}
                                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                                placeholder="Contact name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={form.contact_email}
                                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                                placeholder="email@company.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                                value={form.contact_phone}
                                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                                placeholder="Phone number"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Room Type</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                value={form.room_type_id}
                                onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}
                            >
                                <option value="">Select room type</option>
                                {roomTypes.map((rt) => (
                                    <option key={rt.id} value={rt.id}>{rt.name} ({rt.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Valid From *</Label>
                            <Input
                                type="date"
                                value={form.valid_from}
                                onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valid To *</Label>
                            <Input
                                type="date"
                                value={form.valid_to}
                                onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Agreed Rooms</Label>
                            <Input
                                type="number"
                                value={form.agreed_rooms}
                                onChange={(e) => setForm({ ...form, agreed_rooms: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Base Rate (per room/night)</Label>
                            <Input
                                type="number"
                                value={form.base_rate}
                                onChange={(e) => setForm({ ...form, base_rate: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingAllotment ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl">{selectedAllotment?.allot_code}</DialogTitle>
                                <DialogDescription>{selectedAllotment?.company_name}</DialogDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setDetailDialogOpen(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    {loadingDetail ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="text-2xl font-bold">{totalAgreed}</div>
                                        <div className="text-sm text-slate-500">Total Agreed</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="text-2xl font-bold text-orange-600">{totalUsed}</div>
                                        <div className="text-sm text-slate-500">Rooms Used</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="text-2xl font-bold text-green-600">{totalAvailable}</div>
                                        <div className="text-sm text-slate-500">Available</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="text-2xl font-bold">{allotmentRoomTypes.length}</div>
                                        <div className="text-sm text-slate-500">Room Types</div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Tabs value={detailTab} onValueChange={setDetailTab}>
                                <TabsList>
                                    <TabsTrigger value="overview">Room Types</TabsTrigger>
                                    <TabsTrigger value="daily">Daily Availability</TabsTrigger>
                                    <TabsTrigger value="pickups">Pickup History</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <div className="flex justify-end">
                                        <Button size="sm" onClick={() => openRoomTypeDialog()}>
                                            <Plus className="w-4 h-4 mr-2" /> Add Room Type
                                        </Button>
                                    </div>
                                    <Card>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Room Type</TableHead>
                                                        <TableHead>Agreed Rooms</TableHead>
                                                        <TableHead>Base Rate</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {allotmentRoomTypes.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                                No room types added yet
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        allotmentRoomTypes.map((rt) => (
                                                            <TableRow key={rt.id}>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex items-center gap-2">
                                                                        <Bed className="w-4 h-4 text-slate-400" />
                                                                        {rt.room_type?.name || getRoomTypeName(rt.room_type_id)}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>{rt.agreed_rooms}</TableCell>
                                                                <TableCell>฿{Number(rt.base_rate || 0).toLocaleString()}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button variant="ghost" size="sm" onClick={() => openRoomTypeDialog(rt)}>
                                                                            <Edit className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRoomType(rt.id, rt.room_type_id)}>
                                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="daily" className="space-y-4">
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b">
                                                            <th className="text-left py-2 px-2 font-medium">Room Type</th>
                                                            {Array.from({ length: Math.min(dailyData.length, 14) }).map((_, i) => (
                                                                <th key={i} className="text-center py-2 px-1 font-medium text-xs">
                                                                    {formatDate(dailyData[i]?.allott_date || '')}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {allotmentRoomTypes.map((rt) => {
                                                            const rtDaily = getDailyForRoomType(rt.room_type_id);
                                                            return (
                                                                <tr key={rt.id} className="border-b">
                                                                    <td className="py-2 px-2 font-medium">
                                                                        {rt.room_type?.name || getRoomTypeName(rt.room_type_id)}
                                                                    </td>
                                                                    {Array.from({ length: Math.min(dailyData.length, 14) }).map((_, i) => {
                                                                        const day = rtDaily[i];
                                                                        return (
                                                                            <td key={i} className="text-center py-2 px-1">
                                                                                {day ? (
                                                                                    <div className={`text-xs ${day.available_rooms > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                                        <div className="font-medium">{day.available_rooms}</div>
                                                                                        <div className="text-slate-400">{day.used_rooms}/{day.total_rooms}</div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-slate-300">-</span>
                                                                                )}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {dailyData.length > 14 && (
                                                <div className="text-center text-sm text-slate-500 mt-2">
                                                    Showing first 14 days. Export for full view.
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="pickups" className="space-y-4">
                                    <Card>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Rooms</TableHead>
                                                        <TableHead>Rate</TableHead>
                                                        <TableHead>Reservation</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {pickups.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                                                No pickups yet
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        pickups.map((pickup) => (
                                                            <TableRow key={pickup.id}>
                                                                <TableCell>{pickup.pickup_date}</TableCell>
                                                                <TableCell>{pickup.rooms_picked}</TableCell>
                                                                <TableCell>฿{Number(pickup.rate || 0).toLocaleString()}</TableCell>
                                                                <TableCell>
                                                                    {pickup.reservation_id ? (
                                                                        <span className="text-indigo-600">#{pickup.reservation_id.slice(0, 8)}</span>
                                                                    ) : '-'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge 
                                                                        variant={pickup.status === 'picked' ? 'default' : 'secondary'}
                                                                    >
                                                                        {pickup.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {pickup.status === 'picked' && (
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="sm" 
                                                                            onClick={() => handleCancelPickup(pickup.id)}
                                                                        >
                                                                            <X className="w-4 h-4 text-red-500" />
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={roomTypeDialogOpen} onOpenChange={setRoomTypeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRoomType ? 'Edit Room Type' : 'Add Room Type'}</DialogTitle>
                        <DialogDescription>
                            {editingRoomType 
                                ? 'Update the agreed rooms and rate for this room type'
                                : 'Add a new room type to this allotment'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Room Type *</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                value={rtForm.room_type_id}
                                onChange={(e) => setRtForm({ ...rtForm, room_type_id: e.target.value })}
                                disabled={!!editingRoomType}
                            >
                                <option value="">Select room type</option>
                                {roomTypes
                                    .filter(rt => !allotmentRoomTypes.some(art => art.room_type_id === rt.id) || rt.id === editingRoomType?.room_type_id)
                                    .map((rt) => (
                                        <option key={rt.id} value={rt.id}>{rt.name} ({rt.code})</option>
                                    ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Agreed Rooms *</Label>
                            <Input
                                type="number"
                                value={rtForm.agreed_rooms}
                                onChange={(e) => setRtForm({ ...rtForm, agreed_rooms: parseInt(e.target.value) || 0 })}
                                min={0}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Base Rate (per room/night)</Label>
                            <Input
                                type="number"
                                value={rtForm.base_rate}
                                onChange={(e) => setRtForm({ ...rtForm, base_rate: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setRoomTypeDialogOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={editingRoomType ? handleUpdateRoomType : handleAddRoomType}
                            disabled={!rtForm.room_type_id || rtForm.agreed_rooms <= 0}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {editingRoomType ? 'Update' : 'Add'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}