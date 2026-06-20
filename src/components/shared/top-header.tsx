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
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
            <div>
                <p className="text-xs text-muted-foreground font-medium tracking-wide">Welcome back</p>
                <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
                    {profile?.full_name || user?.email || 'User'}
                </h2>
            </div>
            <div className="flex items-center gap-3">
                <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/15 font-medium text-xs px-2.5 py-0.5"
                >
                    {ROLES[role]?.label || 'Staff'}
                </Badge>
                <Avatar className="h-9 w-9 ring-2 ring-primary/15 ring-offset-1 ring-offset-background">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </div>
        </header>
    )
}
