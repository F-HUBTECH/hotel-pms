import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ROLES } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/types/database'

export async function TopHeader() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let profile = null
    if (user) {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
        profile = data
    }

    const role = (profile?.role || 'staff') as UserRole
    const initials = (profile?.full_name || user?.email || 'U')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    return (
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
            <div>
                <h2 className="text-sm font-medium text-slate-400">Welcome back</h2>
                <p className="text-base font-semibold text-slate-900">
                    {profile?.full_name || user?.email || 'User'}
                </p>
            </div>
            <div className="flex items-center gap-3">
                <Badge
                    variant="secondary"
                    className="bg-indigo-50 text-indigo-600 border-indigo-100 font-medium text-xs"
                >
                    {ROLES[role]?.label || 'Staff'}
                </Badge>
                <Avatar className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-violet-600">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold">
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </div>
        </header>
    )
}
