import { Suspense } from 'react';
import { getPropertyId } from '@/lib/supabase/server';
import { getGroups } from '@/lib/actions/groups';
import { format } from 'date-fns';
import Link from 'next/link';
import { Plus, Users, Calendar, Building2 } from 'lucide-react';

export default async function GroupsPage() {
    const propertyId = await getPropertyId();
    if (!propertyId) return <div>No property selected</div>;

    const groups = await getGroups(propertyId);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Group Management</h2>
                <div className="flex items-center space-x-2">
                    {/* Will implement New Group Modal in next step */}
                    <Link
                        href="/dashboard/groups/new"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Group Block
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Active Groups</h3>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{groups.filter(g => g.status === 'in_house' || g.status === 'definite').length}</div>
                        <p className="text-xs text-muted-foreground">Currently in house or definite</p>
                    </div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Tentative Blocks</h3>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{groups.filter(g => g.status === 'tentative').length}</div>
                        <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
                    </div>
                </div>
            </div>

            <div className="rounded-md border">
                <div className="w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Code</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Group Name</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Company</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Arrival</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Departure</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {groups.map((group) => (
                                <tr key={group.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <td className="p-4 align-middle font-medium">{group.code}</td>
                                    <td className="p-4 align-middle">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium text-indigo-600 truncate max-w-[200px]">{group.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                        {group.company_name ? (
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Building2 className="h-3 w-3" />
                                                <span className="truncate max-w-[150px]">{group.company_name}</span>
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4 align-middle">{format(new Date(group.arrival_date), 'MMM dd, yyyy')}</td>
                                    <td className="p-4 align-middle">{format(new Date(group.departure_date), 'MMM dd, yyyy')}</td>
                                    <td className="p-4 align-middle">
                                        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 
                                            ${group.status === 'in_house' ? 'bg-green-100 text-green-800 border-transparent' :
                                                group.status === 'definite' ? 'bg-blue-100 text-blue-800 border-transparent' :
                                                    group.status === 'cancelled' ? 'bg-red-100 text-red-800 border-transparent' :
                                                        'bg-yellow-100 text-yellow-800 border-transparent'}`}>
                                            {group.status.replace('_', ' ').toUpperCase()}
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle text-right">
                                        <Link
                                            href={`/dashboard/groups/${group.id}`}
                                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                                            title="View Details"
                                        >
                                            <Users className="h-4 w-4" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {groups.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-4 text-center text-muted-foreground h-24">
                                        No active group blocks found. Setup an allotment to hold rooms for Tour Agencies or Corporate Events.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
