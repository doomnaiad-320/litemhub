import { Outlet, useLocation, useNavigate } from 'react-router'
import {
    CreditCard,
    KeyRound,
    Layers3,
    LogOut,
    ScrollText,
    Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageSelector } from '@/components/common/LanguageSelector'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'

const portalNavItems = [
    { label: '钱包', href: '/dashboard', icon: Wallet },
    { label: '分组', href: '/groups', icon: Layers3 },
    { label: 'Key 管理', href: '/keys', icon: KeyRound },
    { label: '流水', href: '/logs', icon: ScrollText },
]

export function UserPortalLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const logout = useUserPortalAuthStore((state) => state.logout)
    const user = useUserPortalAuthStore((state) => state.user)

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const account = user?.email || user?.phone || `#${user?.id ?? ''}`

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.12),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(244,246,255,0.92)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.18),_transparent_28%),linear-gradient(180deg,_rgba(17,24,39,0.98)_0%,_rgba(10,15,28,0.98)_100%)]">
            <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.4)] transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6A6DE6] to-[#8A8DF7] text-white shadow-lg">
                                <CreditCard className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-muted-foreground">AI Proxy</div>
                                <div className="text-base font-semibold tracking-tight">用户控制台</div>
                            </div>
                        </button>

                        <nav className="hidden items-center gap-2 lg:flex">
                            {portalNavItems.map((item) => {
                                const isActive = location.pathname === item.href
                                return (
                                    <button
                                        key={item.href}
                                        type="button"
                                        onClick={() => navigate(item.href)}
                                        className={cn(
                                            'flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition',
                                            isActive
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </button>
                                )
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden rounded-2xl border border-white/70 bg-white/70 px-4 py-2 text-right shadow-[0_18px_36px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5 sm:block">
                            <div className="text-xs text-muted-foreground">当前账号</div>
                            <div className="max-w-[220px] truncate text-sm font-medium">{account}</div>
                        </div>
                        <ThemeToggle />
                        <LanguageSelector variant="minimal" />
                        <Button variant="outline" className="rounded-2xl" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                            退出
                        </Button>
                    </div>
                </div>

                <div className="border-t border-border/60 px-4 py-2 lg:hidden">
                    <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
                        {portalNavItems.map((item) => {
                            const isActive = location.pathname === item.href
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={() => navigate(item.href)}
                                    className={cn(
                                        'flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm transition',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
                <Outlet />
            </main>
        </div>
    )
}
