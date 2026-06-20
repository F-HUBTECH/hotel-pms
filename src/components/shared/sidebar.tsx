'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { navigationGroups } from '@/lib/constants/navigation'
import { Hotel, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { type UserRole } from '@/lib/types/database'

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [collapsed, setCollapsed] = useState(false)
    const [userRole, setUserRole] = useState<UserRole | null>(null)

    useEffect(() => {
        const fetchRole = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                if (data) setUserRole(data.role as UserRole)
            }
        }
        fetchRole()
    }, [])

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <aside
            className={cn(
                'h-screen sticky top-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-out z-30',
                collapsed ? 'w-[68px]' : 'w-[256px]'
            )}
        >
            {/* Brand mark */}
            <div className={cn(
                'flex items-center gap-3 border-b border-sidebar-border transition-all duration-300 ease-out',
                collapsed ? 'h-16 px-3 justify-center' : 'h-16 px-4'
            )}>
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 ring-1 ring-primary/30 shadow-sm shadow-primary/15">
                    <Hotel className="w-5 h-5 text-primary-foreground" strokeWidth={1.75} />
                </div>
                {!collapsed && (
                    <div className="overflow-hidden min-w-0">
                        <h1 className="text-sm font-semibold text-sidebar-foreground tracking-tight truncate">Hotel PMS</h1>
                        <p className="text-[10px] text-sidebar-foreground/40 tracking-wide truncate mt-0.5">Property Management</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
                {navigationGroups
                    .filter((group) => {
                        if (!group.roles) return true
                        if (!userRole) return false
                        return group.roles.includes(userRole)
                    })
                    .map((group) => (
                        <div key={group.title}>
                            {!collapsed ? (
                                <p className="text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/35 mb-2.5 px-3 select-none">
                                    {group.title}
                                </p>
                            ) : (
                                <div className="px-1.5 mb-2">
                                    <div className="h-px bg-sidebar-border" />
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {group.items
                                    .filter((item) => {
                                        if (!item.roles) return true
                                        if (!userRole) return false
                                        return item.roles.includes(userRole)
                                    })
                                    .map((item) => {
                                        const isActive = pathname === item.href
                                        const Icon = item.icon
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ease-out',
                                                    isActive
                                                        ? 'bg-primary/12 text-sidebar-foreground font-medium ring-1 ring-primary/20'
                                                        : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/85 hover:bg-white/[0.04]'
                                                )}
                                                title={collapsed ? item.title : undefined}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'w-4 h-4 shrink-0 transition-colors duration-200 ease-out',
                                                        isActive ? 'text-primary' : 'text-sidebar-foreground/35'
                                                    )}
                                                    strokeWidth={isActive ? 2 : 1.75}
                                                />
                                                {!collapsed && (
                                                    <span className="truncate">{item.title}</span>
                                                )}
                                            </Link>
                                        )
                                    })}
                            </div>
                        </div>
                    ))}
            </nav>

            {/* Footer */}
            <div className={cn(
                'border-t border-sidebar-border transition-all duration-300 ease-out',
                collapsed ? 'p-2 space-y-1.5' : 'p-3 space-y-1.5'
            )}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className={cn(
                        'w-full justify-start text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 ease-out',
                        collapsed && 'justify-center px-0'
                    )}
                >
                    <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="ml-3">Sign Out</span>}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full text-sidebar-foreground/35 hover:text-sidebar-foreground/70 hover:bg-white/[0.04] transition-all duration-200 ease-out"
                >
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </Button>
            </div>
        </aside>
    )
}
