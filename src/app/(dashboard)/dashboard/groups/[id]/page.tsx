'use client';

import { use, useState, useEffect, Suspense } from 'react';
import { getGroupById, getGroupMasterFolio, getGroupSummary } from '@/lib/actions/groups';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Users, Calendar, Building2, BedDouble, Calculator, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

interface PageProps {
    params: Promise<{ id: string }>;
}

function GroupHeader({ groupId }: { groupId: string }) {
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getGroupById(groupId).then(setGroup).finally(() => setLoading(false));
    }, [groupId]);

    if (loading) return <div className="h-8 w-32 bg-slate-100 animate-pulse rounded" />;
    if (!group) return null;

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

function GroupOverview({ groupId }: { groupId: string }) {
    const [group, setGroup] = useState<any>(null);
    const [masterFolio, setMasterFolio] = useState<any>(null);
    const [summary, setSummary] = useState<any>({ guests: { total: 0, checkedIn: 0 }, bookings: { total: 0, checkedIn: 0 } });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getGroupById(groupId),
            getGroupMasterFolio(groupId),
            getGroupSummary(groupId)
        ]).then(([g, f, s]) => {
            setGroup(g);
            setMasterFolio(f);
            setSummary(s);
        }).finally(() => setLoading(false));
    }, [groupId]);

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Expected Rooms</h3>
                        <BedDouble className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{group?.expected_rooms || 0}</div>
                        <p className="text-xs text-muted-foreground">Picked: {group?.picked_up_rooms || 0}</p>
                    </div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Guests</h3>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{summary.guests?.total || 0}</div>
                        <p className="text-xs text-muted-foreground">Checked In: {summary.guests?.checkedIn || 0}</p>
                    </div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Bookings</h3>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{summary.bookings?.total || 0}</div>
                        <p className="text-xs text-muted-foreground">Checked In: {summary.bookings?.checkedIn || 0}</p>
                    </div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Balance</h3>
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">฿{(masterFolio?.total_amount || 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Room Blocks</CardTitle>
                </CardHeader>
                <CardContent>
                    {group?.group_blocks?.length > 0 ? (
                        <div className="space-y-2">
                            {group.group_blocks.map((block: any) => (
                                <div key={block.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <BedDouble className="h-4 w-4 text-slate-400" />
                                        <div>
                                            <p className="font-medium">{block.room_types?.name || 'Unknown Room Type'}</p>
                                            <p className="text-xs text-slate-500">{block.block_date}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium">{block.agreed_rooms} rooms</p>
                                        <p className="text-xs text-slate-500">฿{block.rate}/night</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">No room blocks defined yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function GroupDetailPage({ params }: PageProps) {
    const { id: groupId } = use(params);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center space-x-4 mb-4">
                <Link href="/dashboard/groups" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex flex-col">
                    <Suspense fallback={<div className="h-8 w-64 bg-slate-100 animate-pulse rounded" />}>
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
                    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}>
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
                                <Button>Process Check-in</Button>
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
