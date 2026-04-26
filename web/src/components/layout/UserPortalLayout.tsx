import type React from 'react'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import {
    Blocks,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    KeyRound,
    LogOut,
    Menu,
    ScrollText,
    Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
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

export function UserPortalLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const logout = useUserPortalAuthStore((state) => state.logout)
    const user = useUserPortalAuthStore((state) => state.user)
    const portalNavItems: PortalNavItem[] = [
        { label: t('portal.nav.models'), href: ROUTES.USER_MODELS, icon: Blocks },
        { label: t('portal.nav.wallet'), href: ROUTES.USER_DASHBOARD, icon: Wallet },
        { label: t('portal.nav.keys'), href: ROUTES.USER_KEYS, icon: KeyRound },
        { label: t('portal.nav.logs'), href: ROUTES.USER_LOGS, icon: ScrollText },
    ]

    const currentPath = location.pathname
    const account = user?.email || user?.phone || `#${user?.id ?? ''}`
    const activeNavItem = portalNavItems.find((item) => item.href === currentPath) || portalNavItems[0]

    const handleLogout = () => {
        logout()
        navigate(ROUTES.USER_LOGIN)
    }

    const renderNavigationLinks = (isCompact = false, onNavigate?: () => void) => (
        portalNavItems.map((item) => {
            const isActive = currentPath === item.href

            return (
                <Link
                    key={item.href}
                    to={item.href}
                    onClick={onNavigate}
                    className={cn(
                        'group flex items-center rounded-lg transition-all duration-200',
                        isCompact ? 'mx-2 my-1 px-4 py-3' : 'mx-2 my-1 px-6 py-3',
                        isActive
                            ? 'bg-white/15 text-white backdrop-blur-sm shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                            : 'text-white/90 hover:bg-white/10',
                        collapsed && !isCompact ? 'justify-center' : '',
                    )}
                >
                    <div className="flex h-5 w-5 items-center justify-center">
                        <item.icon
                            className={cn(
                                'h-5 w-5 transition-all duration-300 ease-in-out',
                                isActive ? 'text-white' : 'text-white/90',
                                'group-hover:scale-125 group-hover:rotate-6 group-hover:animate-bounce-subtle',
                            )}
                        />
                    </div>
                    <span
                        className={cn(
                            'ml-3 whitespace-nowrap font-medium transition-all duration-300 ease-in-out',
                            isActive ? 'text-white' : 'text-white/90',
                            collapsed && !isCompact ? 'w-0 overflow-hidden opacity-0' : 'w-auto opacity-100',
                        )}
                    >
                        {item.label}
                    </span>
                </Link>
            )
        })
    )

    const sidebarParticles = (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 25 }).map((_, index) => (
                <div
                    key={index}
                    className="sidebar-particle absolute rounded-full bg-white/10 dark:bg-white/5"
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
    )

    return (
        <div className="flex h-dvh bg-background">
            <aside
                className={cn(
                    'relative hidden h-full overflow-hidden lg:flex flex-col transition-all duration-300 ease-in-out',
                    'bg-gradient-to-b from-[#6A6DE6] to-[#8A8DF7] dark:from-[#4A4DA0] dark:to-[#5155A5]',
                    collapsed ? 'w-20' : 'w-64',
                )}
            >
                {sidebarParticles}

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
                                <div className="text-base font-semibold text-white">{t('portal.nav.console')}</div>
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
                            const isActive = currentPath === item.href
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
                                <div className="text-xs text-white/70">{t('portal.nav.currentAccount')}</div>
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
                                    {t('portal.nav.logout')}
                                </span>
                            </Button>
                        </TooltipTrigger>
                        {collapsed && <TooltipContent side="right">{t('portal.nav.logout')}</TooltipContent>}
                    </Tooltip>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.12),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(244,246,255,0.92)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.18),_transparent_28%),linear-gradient(180deg,_rgba(17,24,39,0.98)_0%,_rgba(10,15,28,0.98)_100%)]">
                <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 lg:hidden">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#6A6DE6] text-white shadow-lg shadow-indigo-500/20">
                                {activeNavItem && <activeNavItem.icon className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-foreground">{activeNavItem?.label}</div>
                                <div className="truncate text-xs text-muted-foreground">{account}</div>
                            </div>
                        </div>
                        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-2xl bg-white/80 dark:bg-white/5">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">{t('portal.nav.console')}</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[86vw] max-w-[340px] border-0 bg-gradient-to-b from-[#6A6DE6] to-[#8A8DF7] p-0 text-white dark:from-[#4A4DA0] dark:to-[#5155A5]">
                                {sidebarParticles}
                                <SheetHeader className="relative z-10 border-b border-white/20 p-5 text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white shadow-lg backdrop-blur-sm">
                                            <CreditCard className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <SheetDescription className="text-xs font-medium text-white/70">AI Proxy</SheetDescription>
                                            <SheetTitle className="text-base font-semibold text-white">{t('portal.nav.console')}</SheetTitle>
                                        </div>
                                    </div>
                                </SheetHeader>
                                <div className="relative z-10 flex-1 overflow-y-auto py-3">
                                    {renderNavigationLinks(true, () => setMobileMenuOpen(false))}
                                </div>
                                <div className="relative z-10 space-y-3 border-t border-white/20 p-4">
                                    <div className="rounded-xl bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                                        <div className="text-xs text-white/70">{t('portal.nav.currentAccount')}</div>
                                        <div className="truncate text-sm font-medium">{account}</div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-black/20">
                                            <ThemeToggle />
                                        </div>
                                        <LanguageSelector variant="minimal" />
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={handleLogout}
                                        className="group flex w-full items-center justify-start rounded-lg bg-white px-4 py-3 text-[#6A6DE6] transition-all duration-200 hover:bg-gray-100 dark:text-[#4A4DA0]"
                                    >
                                        <LogOut className="mr-3 h-5 w-5" />
                                        {t('portal.nav.logout')}
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </header>
                <div className="flex-1 overflow-auto">
                    <div className="min-h-full p-3 sm:p-5 lg:p-6">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    )
}
