'use client';

import { useState } from 'react';
import { Suspense } from 'react';
import { getPropertyId } from '@/lib/supabase/server';
import { getGroupById, getGroupMasterFolio, getGroupSummary } from '@/lib/actions/groups';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Users, Calendar, Building2, CreditCard, Receipt, BedDouble, UserCheck, Wallet, Calculator, FileText, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PageProps {
    params: { id: string };
}

async function GroupOverview({ groupId }: { groupId: string }) {
    const group = await getGroupById(groupId);
    const masterFolio = await getGroupMasterFolio(groupId);
    const summary = await getGroupSummary(groupId);

    return (
        <div className="space-y-6">
            {/* Header Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Expected Rooms</h3>
                        <BedDouble className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{group.expected_rooms || 0}</div>
                        <p className="text-xs text-muted-foreground">Picked: {group.picked_up_rooms || 0}</p>
                    </div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Guests</h3>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{summary.guests.total}</div>
                        <p className="text-xs text-muted-foreground">Checked In: {summary.guests.checkedIn}</p>
                    </div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Bookings</h3>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{summary.bookings.active}</div>
                        <p className="text-xs text-muted-foreground">Total Revenue: ฿{summary.bookings.totalRevenue.toLocaleString()}</p>
                    </div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Master Folio</h3>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold text-indigo-600">฿{masterFolio.balance?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Main Information */}
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Users className="w-5 h-5" /> Rooming List
                        </h3>
                        <Link href={`/dashboard/groups/${groupId}/rooming`}>
                            <Button variant="outline" size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Add Guest
                            </Button>
                        </Link>
                    </div>

                    <div className="overflow-auto border rounded-md">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b bg-muted/50">
                                <tr className="border-b">
                                    <td className="h-10 px-4 font-medium">Guest</td>
                                    <td className="h-10 px-4 font-medium">Room</td>
                                    <td className="h-10 px-4 font-medium">Arrival</td>
                                    <td className="h-10 px-4 font-medium">Status</td>
                                    <td className="h-10 px-4 font-medium">Folio</td>
                                </tr>
                            </thead>
                            <tbody>
                                {group.reservations && group.reservations.length > 0 ? (
                                    group.reservations.slice(0, 10).map((res: any) => (
                                        <tr key={res.id} className="border-b">
                                            <td className="p-4">{res.guest_name}</td>
                                            <td className="p-4">-</td>
                                            <td className="p-4">{format(new Date(res.check_in), 'MMM dd')}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                    res.status === 'checked_in' ? 'bg-green-100 text-green-800' :
                                                    res.status === 'reserved' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {res.status}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <Link href={`/dashboard/reservations/${res.id}`} className="text-indigo-600 hover:text-indigo-800 text-xs">View</Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No reservations picked up yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Master Folio & Blocks */}
                <div className="col-span-3 space-y-4">
                    <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-indigo-600" /> Master Folio
                            </h3>
                            <Link href={`/dashboard/groups/${groupId}/folio`}>
                                <Button variant="outline" size="sm">View All</Button>
                            </Link>
                        </div>
                        <div className="text-3xl font-bold font-mono text-indigo-700 mb-4">
                            ฿ {masterFolio.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                        </div>
                        <ul className="space-y-4 mb-4 max-h-48 overflow-y-auto">
                            {masterFolio.transactions && masterFolio.transactions.length > 0 ? (
                                masterFolio.transactions.slice(0, 5).map((tx: any) => (
                                    <li key={tx.id} className="flex justify-between items-center border-b pb-2 last:border-0 text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{tx.description}</span>
                                            <span className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'MMM dd')} - {tx.routing_reason || 'Direct'}</span>
                                        </div>
                                        <span className={`font-mono ${tx.type === 'payment' ? 'text-green-600' : tx.type === 'charge' ? 'text-red-500' : ''}`}>
                                            {tx.type === 'payment' ? '-' : '+'}{tx.amount}
                                        </span>
                                    </li>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
                            )}
                        </ul>
                    </div>

                    <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-lg">Room Blocks (Allotment)</h3>
                            <Link href={`/dashboard/groups/${groupId}/bookings`}>
                                <Button variant="outline" size="sm">Manage</Button>
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {group.group_blocks && group.group_blocks.length > 0 ? (
                                group.group_blocks.map((block: any) => (
                                    <div key={block.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                                        <span>{block.room_types?.name || 'Room Type'}</span>
                                        <span className="text-muted-foreground text-xs">Rate: ฿{block.rate}</span>
                                        <span className="font-medium">{block.picked_up_rooms} / {block.agreed_rooms} Rooms</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-2">No blocks created yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function GroupDetailPage({ params }: PageProps) {
    const groupId = params.id;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center space-x-4 mb-4">
                <Link href="/dashboard/groups" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex flex-col">
                    <Suspense fallback={<div>Loading...</div>}>
                        <GroupHeader groupId={groupId} />
                    </Suspense>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="bookings">Bookings</TabsTrigger>
                    <TabsTrigger value="rooming">Rooming List</TabsTrigger>
                    <TabsTrigger value="checkin">Check-in</TabsTrigger>
                    <TabsTrigger value="folio">Master Folio</TabsTrigger>
                    <TabsTrigger value="deposits">Deposits</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <Suspense fallback={<div>Loading...</div>}>
                        <GroupOverview groupId={groupId} />
                    </Suspense>
                </TabsContent>

                <TabsContent value="bookings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Group Bookings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link href={`/dashboard/groups/${groupId}/bookings`}>
                                <Button>Manage Bookings</Button>
                            </Link>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rooming">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rooming List</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link href={`/dashboard/groups/${groupId}/rooming`}>
                                <Button>Manage Rooming List</Button>
                            </Link>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="checkin">
                    <Card>
                        <CardHeader>
                            <CardTitle>Group Check-in</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link href={`/dashboard/groups/${groupId}/checkin`}>
                                <Button>Check-in Management</Button>
                            </Link>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="folio">
                    <Card>
                        <CardHeader>
                            <CardTitle>Master Folio</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link href={`/dashboard/groups/${groupId}/folio`}>
                                <Button>Manage Master Folio</Button>
                            </Link>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="deposits">
                    <Card>
                        <CardHeader>
                            <CardTitle>Deposits</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link href={`/dashboard/groups/${groupId}/deposits`}>
                                <Button>Manage Deposits</Button>
                            </Link>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

async function GroupHeader({ groupId }: { groupId: string }) {
    const group = await getGroupById(groupId);
    
    return (
        <>
            <h2 className="text-2xl font-bold tracking-tight">Group: {group.name}</h2>
            <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Building2 className="w-3 h-3" /> {group.company_name || 'No Company'}  |  
                <Calendar className="w-3 h-3" /> {format(new Date(group.arrival_date), 'MMM dd')} - {format(new Date(group.departure_date), 'MMM dd')} |
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    group.status === 'in_house' ? 'bg-green-100 text-green-800' :
                    group.status === 'definite' ? 'bg-blue-100 text-blue-800' :
                    group.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                }`}>
                    {group.status?.replace('_', ' ').toUpperCase()}
                </span>
            </span>
        </>
    );
}
