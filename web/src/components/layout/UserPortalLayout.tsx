import type React from 'react'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import {
    ChevronLeft,
    ChevronRight,
    CreditCard,
    KeyRound,
    LogOut,
    ScrollText,
    Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageSelector } from '@/components/common/LanguageSelector'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'
import { ROUTES } from '@/routes/constants'

interface PortalNavItem {
    label: string
    href: string
    icon: React.ComponentType<{ className?: string }>
}

const portalNavItems: PortalNavItem[] = [
    { label: '钱包', href: ROUTES.USER_DASHBOARD, icon: Wallet },
    { label: 'Key', href: ROUTES.USER_KEYS, icon: KeyRound },
    { label: '日志', href: ROUTES.USER_LOGS, icon: ScrollText },
]

export function UserPortalLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const logout = useUserPortalAuthStore((state) => state.logout)
    const user = useUserPortalAuthStore((state) => state.user)

    const currentFirstLevelPath = `/${location.pathname.split('/')[1]}`
    const account = user?.email || user?.phone || `#${user?.id ?? ''}`

    const handleLogout = () => {
        logout()
        navigate(ROUTES.USER_LOGIN)
    }

    return (
        <div className="flex h-screen bg-background">
            <aside
                className={cn(
                    'h-full relative overflow-hidden flex flex-col transition-all duration-300 ease-in-out',
                    'bg-gradient-to-b from-[#6A6DE6] to-[#8A8DF7] dark:from-[#4A4DA0] dark:to-[#5155A5]',
                    collapsed ? 'w-20' : 'w-64',
                )}
            >
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {Array.from({ length: 25 }).map((_, index) => (
                        <div
                            key={index}
                            className="absolute rounded-full bg-white/10 dark:bg-white/5 sidebar-particle"
                            style={{
                                width: `${Math.random() * 6 + 2}px`,
                                height: `${Math.random() * 6 + 2}px`,
                                top: `${Math.random() * 100}%`,
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 5}s`,
                            }}
                        />
                    ))}
                </div>

                <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/20 dark:border-white/10">
                    <div
                        className={cn(
                            'overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0',
                            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                        )}
                    >
                        <div className="flex items-center gap-3 whitespace-nowrap">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white shadow-lg backdrop-blur-sm">
                                <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-white/70">AI Proxy</div>
                                <div className="text-base font-semibold text-white">用户控制台</div>
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            'rounded-full hover:bg-white/10 hover:text-white transition-all flex-shrink-0 w-8 h-8 flex items-center justify-center text-white',
                            collapsed ? 'ml-auto mr-auto' : 'ml-auto',
                        )}
                    >
                        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                    </Button>
                </div>

                <div className="flex-1 py-2 overflow-y-auto relative z-10">
                    <TooltipProvider delayDuration={300}>
                        {portalNavItems.map((item) => {
                            const isActive = currentFirstLevelPath === item.href
                            const content = (
                                <>
                                    <div className="flex items-center justify-center w-5 h-5">
                                        <item.icon
                                            className={cn(
                                                'w-5 h-5 transition-all duration-300 ease-in-out',
                                                isActive ? 'text-white' : 'text-white/90',
                                                'group-hover:scale-125 group-hover:rotate-6 group-hover:animate-bounce-subtle',
                                            )}
                                        />
                                    </div>
                                    <span
                                        className={cn(
                                            'ml-3 font-medium whitespace-nowrap transition-all duration-300 ease-in-out',
                                            isActive ? 'text-white' : 'text-white/90',
                                            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto',
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                </>
                            )

                            return (
                                <Tooltip key={item.href}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            to={item.href}
                                            className={cn(
                                                'group flex items-center px-6 py-3 my-1 mx-2 rounded-lg transition-all duration-200',
                                                isActive
                                                    ? 'bg-white/15 text-white backdrop-blur-sm shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                                                    : 'text-white/90 hover:bg-white/10',
                                                collapsed ? 'justify-center' : '',
                                            )}
                                        >
                                            {content}
                                        </Link>
                                    </TooltipTrigger>
                                    {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                                </Tooltip>
                            )
                        })}
                    </TooltipProvider>
                </div>

                <div className="p-4 border-t border-white/20 dark:border-white/10 relative z-10 space-y-3">
                    {!collapsed && (
                        <>
                            <div className="rounded-xl bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                                <div className="text-xs text-white/70">当前账号</div>
                                <div className="truncate text-sm font-medium">{account}</div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-black/20">
                                    <ThemeToggle />
                                </div>
                                <LanguageSelector variant="minimal" />
                            </div>
                        </>
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="secondary"
                                onClick={handleLogout}
                                className={cn(
                                    'group w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200',
                                    'text-[#6A6DE6] dark:text-[#4A4DA0] bg-white hover:bg-gray-100',
                                    collapsed ? 'justify-center' : 'justify-start',
                                )}
                            >
                                <div className="flex items-center justify-center w-5 h-5">
                                    <LogOut className="w-5 h-5 transition-all duration-300 ease-in-out group-hover:scale-125 group-hover:rotate-6 group-hover:animate-bounce-subtle" />
                                </div>
                                <span
                                    className={cn(
                                        'ml-3 font-medium whitespace-nowrap transition-all duration-300 ease-in-out',
                                        collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto',
                                    )}
                                >
                                    退出
                                </span>
                            </Button>
                        </TooltipTrigger>
                        {collapsed && <TooltipContent side="right">退出</TooltipContent>}
                    </Tooltip>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.12),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(244,246,255,0.92)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.18),_transparent_28%),linear-gradient(180deg,_rgba(17,24,39,0.98)_0%,_rgba(10,15,28,0.98)_100%)]">
                <div className="flex-1 overflow-auto">
                    <div className="min-h-full p-6">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    )
}
