'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { navigationGroups } from '@/lib/constants/navigation'
import { Hotel, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
                'h-screen sticky top-0 bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 z-30',
                collapsed ? 'w-[68px]' : 'w-[260px]'
            )}
        >
            {/* Logo */}
            <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-800">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
                    <Hotel className="w-5 h-5 text-white" />
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <h1 className="text-sm font-bold text-white truncate">Hotel PMS</h1>
                        <p className="text-[10px] text-slate-500 truncate">Property Management</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
                {navigationGroups
                    .filter((group) => {
                        // Filter out entire groups if the user role doesn't match
                        if (!group.roles) return true // available to all
                        if (!userRole) return false // waiting on fetch or unauthorized
                        return group.roles.includes(userRole)
                    })
                    .map((group) => (
                        <div key={group.title}>
                            {!collapsed && (
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-3">
                                    {group.title}
                                </p>
                            )}
                            {collapsed && <Separator className="mb-2 bg-slate-800" />}
                            <div className="space-y-0.5">
                                {group.items
                                    .filter((item) => {
                                        // Filter out precise items if the user role doesn't match
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
                                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                                                    isActive
                                                        ? 'bg-indigo-500/10 text-indigo-400 font-medium'
                                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                                )}
                                                title={collapsed ? item.title : undefined}
                                            >
                                                <Icon className={cn('w-4 h-4 shrink-0', isActive && 'text-indigo-400')} />
                                                {!collapsed && <span className="truncate">{item.title}</span>}
                                            </Link>
                                        )
                                    })}
                            </div>
                        </div>
                    ))}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 space-y-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="ml-3">Sign Out</span>}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full text-slate-500 hover:text-white hover:bg-slate-800"
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
            </div>
        </aside>
    )
}
