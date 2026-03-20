import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Users, Mail, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { UserRole } from '@/lib/types/database'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateUserRole } from '@/lib/actions/users'

export default async function UserGroupsPage() {
    const supabase = await createClient()

    // Fetch all profiles
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: false })

    if (error) {
        return <div>Error loading users: {error.message}</div>
    }

    const { data: { user } } = await supabase.auth.getUser()
    const isSuperAdmin = profiles?.find((p: any) => p.id === user?.id)?.role === 'super_admin'

    const RoleBadge = ({ role }: { role: UserRole }) => {
        const variants = {
            super_admin: 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100',
            admin: 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-100',
            manager: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
            staff: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100'
        }
        return <Badge variant="outline" className={variants[role]}>{role.replace('_', ' ').toUpperCase()}</Badge>
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-500" />
                        User Management
                    </h1>
                    <p className="text-slate-500 mt-1">Control staff access levels and system permissions</p>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Full Name</th>
                                <th className="px-6 py-4 font-medium">Email Address</th>
                                <th className="px-6 py-4 font-medium">Active Role</th>
                                <th className="px-6 py-4 font-medium">Last Updated</th>
                                {isSuperAdmin && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {profiles?.map((profile: any) => (
                                <tr key={profile.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {profile.full_name || 'Unregistered'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4" />
                                            {profile.email}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <RoleBadge role={profile.role as UserRole} />
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            {format(new Date(profile.updated_at), 'MMM dd, yyyy HH:mm')}
                                        </div>
                                    </td>
                                    {isSuperAdmin && (
                                        <td className="px-6 py-4 text-right">
                                            {profile.id !== user?.id && (
                                                <form action={async (formData) => {
                                                    'use server'
                                                    const newRole = formData.get('role') as UserRole
                                                    await updateUserRole(profile.id, newRole)
                                                }}>
                                                    <Select name="role" defaultValue={profile.role}>
                                                        <SelectTrigger className="w-[140px] ml-auto h-8 text-xs">
                                                            <SelectValue placeholder="Change Role" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="manager">Manager</SelectItem>
                                                            <SelectItem value="staff">Staff</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <button type="submit" className="hidden" id={`submit-${profile.id}`}></button>
                                                </form>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
