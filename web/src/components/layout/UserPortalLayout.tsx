import type React from 'react'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import {
    Blocks,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Code2,
    FileText,
    Github,
    Gift,
    KeyRound,
    LogOut,
    Menu,
    ScrollText,
    UserRound,
    Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageSelector } from '@/components/common/LanguageSelector'
import { PublicSiteMenu } from '@/components/common/PublicSiteHeader'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'
import { ROUTES } from '@/routes/constants'
import { UserPortalAnnouncementBanner } from '@/feature/user-portal/components/UserPortalAnnouncementBanner'

interface PortalNavItem {
    label: string
    href: string
    icon: React.ComponentType<{ className?: string }>
}

export function UserPortalLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const logout = useUserPortalAuthStore((state) => state.logout)
    const user = useUserPortalAuthStore((state) => state.user)
    const portalNavItems: PortalNavItem[] = [
        { label: t('portal.nav.wallet'), href: ROUTES.USER_DASHBOARD, icon: Wallet },
        { label: t('portal.nav.models'), href: ROUTES.USER_MODELS, icon: Blocks },
        { label: t('portal.nav.keys'), href: ROUTES.USER_KEYS, icon: KeyRound },
        { label: t('portal.nav.logs'), href: ROUTES.USER_LOGS, icon: ScrollText },
        { label: t('portal.nav.referrals'), href: ROUTES.USER_REFERRALS, icon: Gift },
        { label: t('portal.nav.profile'), href: ROUTES.USER_PROFILE, icon: UserRound },
    ]
    const publicResourceItems: PortalNavItem[] = [
        { label: t('publicModels.nav.models'), href: ROUTES.PUBLIC_MODELS, icon: Blocks },
        { label: t('publicModels.nav.apiDocs'), href: ROUTES.PUBLIC_API_DOCS, icon: Code2 },
        { label: t('publicModels.nav.apiUpdates'), href: ROUTES.PUBLIC_API_UPDATES, icon: ScrollText },
        { label: t('publicModels.nav.blog'), href: ROUTES.PUBLIC_BLOG, icon: FileText },
        { label: t('publicModels.nav.github'), href: ROUTES.PUBLIC_GITHUB, icon: Github },
    ]

    const currentPath = location.pathname
    const account = user?.username || user?.email || `#${user?.id ?? ''}`
    const accountInitial = (user?.username || user?.email || 'U').trim().charAt(0).toUpperCase() || 'U'
    const activeNavItem = portalNavItems.find((item) => item.href === currentPath)
        || portalNavItems.find((item) => item.href === ROUTES.USER_DASHBOARD)
        || portalNavItems[0]

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
                        'group flex items-center rounded-md transition-colors',
                        isCompact ? 'mx-2 my-1 px-4 py-3' : 'mx-2 my-1 px-6 py-3',
                        isActive
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                        collapsed && !isCompact ? 'justify-center' : '',
                    )}
                >
                    <div className="flex h-5 w-5 items-center justify-center">
                        <item.icon
                            className={cn(
                                'h-5 w-5 transition-colors',
                                isActive ? 'text-foreground' : 'text-muted-foreground',
                            )}
                        />
                    </div>
                    <span
                        className={cn(
                            'ml-3 whitespace-nowrap font-medium transition-all duration-300 ease-in-out',
                            isActive ? 'text-foreground' : 'text-muted-foreground',
                            collapsed && !isCompact ? 'w-0 overflow-hidden opacity-0' : 'w-auto opacity-100',
                        )}
                    >
                        {item.label}
                    </span>
                </Link>
            )
        })
    )

    const renderMobileResourceLinks = (onNavigate?: () => void) => (
        publicResourceItems.map((item) => {
            const isActive = currentPath === item.href
            const isExternal = /^https?:\/\//.test(item.href)
            const isDocumentRoute = item.href.startsWith('/swagger')
            const className = cn(
                'group mx-2 my-1 flex items-center rounded-md px-4 py-2.5 text-sm transition-colors',
                isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )
            const content = (
                <>
                    <div className="flex h-5 w-5 items-center justify-center">
                        <item.icon className={cn('h-4 w-4 transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground')} />
                    </div>
                    <span className="ml-3 whitespace-nowrap font-medium">{item.label}</span>
                </>
            )

            if (isExternal || isDocumentRoute) {
                return (
                    <a
                        key={item.href}
                        href={item.href}
                        className={className}
                        rel={isExternal ? 'noreferrer' : undefined}
                        target={isExternal ? '_blank' : undefined}
                        onClick={onNavigate}
                    >
                        {content}
                    </a>
                )
            }

            return (
                <Link key={item.href} to={item.href} className={className} onClick={onNavigate}>
                    {content}
                </Link>
            )
        })
    )

    return (
        <div className="flex h-dvh bg-background">
            <aside
                className={cn(
                    'relative hidden h-full overflow-hidden lg:flex flex-col transition-all duration-300 ease-in-out',
                    'border-r border-border bg-background',
                    collapsed ? 'w-20' : 'w-64',
                )}
            >
                <div className="relative z-10 flex items-center justify-between border-b border-border px-6 py-5">
                    <div
                        className={cn(
                            'overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0',
                            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                        )}
                    >
                        <div className="flex items-center gap-3 whitespace-nowrap">
                            <div>
                                <div className="text-xs font-medium text-muted-foreground">AI Proxy</div>
                                <div className="text-base font-semibold text-foreground">{t('portal.nav.console')}</div>
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
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
                                                'w-5 h-5 transition-colors',
                                                isActive ? 'text-foreground' : 'text-muted-foreground',
                                            )}
                                        />
                                    </div>
                                    <span
                                        className={cn(
                                            'ml-3 font-medium whitespace-nowrap transition-all duration-300 ease-in-out',
                                            isActive ? 'text-foreground' : 'text-muted-foreground',
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
                                                'group flex items-center mx-2 my-1 rounded-md px-6 py-3 transition-colors',
                                                isActive
                                                    ? 'bg-muted text-foreground'
                                                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
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

                <div className="relative z-10 border-t border-border p-3">
                    {!collapsed && (
                        <div className="rounded-lg border border-border bg-muted/25 p-3 shadow-[rgba(15,23,42,0.03)_0px_8px_18px] dark:bg-white/[0.03]">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-[13px] font-semibold text-background">
                                    {accountInitial}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                                        {t('portal.nav.currentAccount')}
                                    </div>
                                    <div className="truncate text-sm font-semibold text-foreground">{account}</div>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                <div className="flex min-w-0 items-center justify-center rounded-md border border-border bg-background px-2 py-2">
                                    <ThemeToggle />
                                </div>
                                <LanguageSelector className="h-9 w-[58px] rounded-md bg-background" variant="minimal" />
                            </div>
                        </div>
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="secondary"
                                onClick={handleLogout}
                                className={cn(
                                    'group flex w-full items-center rounded-md border border-transparent bg-transparent shadow-none transition-colors',
                                    'text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground',
                                    collapsed ? 'h-10 justify-center p-0' : 'mt-3 h-10 justify-start px-3',
                                )}
                            >
                                <div className="flex items-center justify-center w-5 h-5">
                                    <LogOut className="h-5 w-5 transition-colors" />
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

            <main className="flex-1 flex flex-col overflow-hidden bg-background">
                <header className="sticky top-0 z-30 hidden border-b border-border bg-background/95 px-4 py-3 backdrop-blur-xl lg:flex lg:items-center lg:justify-end lg:px-6">
                    <PublicSiteMenu
                        className="ml-0 max-w-full"
                        showPrimaryAction={false}
                    />
                </header>
                <header className="sticky top-0 z-30 border-b border-border bg-background px-4 py-3 lg:hidden">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                                {activeNavItem && <activeNavItem.icon className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-foreground">{activeNavItem?.label}</div>
                                <div className="truncate text-xs text-muted-foreground">{account}</div>
                            </div>
                        </div>
                        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-md bg-background">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">{t('portal.nav.console')}</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[86vw] max-w-[340px] border-r border-border bg-background p-0 text-foreground">
                                <SheetHeader className="relative z-10 border-b border-border p-5 text-left">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <SheetDescription className="text-xs font-medium text-muted-foreground">AI Proxy</SheetDescription>
                                            <SheetTitle className="text-base font-semibold text-foreground">{t('portal.nav.console')}</SheetTitle>
                                        </div>
                                    </div>
                                </SheetHeader>
                                <div className="relative z-10 flex-1 overflow-y-auto py-3">
                                    <div className="px-6 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        {t('portal.nav.console')}
                                    </div>
                                    {renderNavigationLinks(true, () => setMobileMenuOpen(false))}

                                    <Collapsible
                                        open={mobileResourcesOpen}
                                        onOpenChange={setMobileResourcesOpen}
                                        className="mt-3 border-t border-border pt-3"
                                    >
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="mx-2 flex h-10 w-[calc(100%-1rem)] items-center justify-between rounded-md px-4 text-sm font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                            >
                                                <span>{t('portal.nav.resources')}</span>
                                                <ChevronDown
                                                    className={cn(
                                                        'h-4 w-4 transition-transform duration-200',
                                                        mobileResourcesOpen ? 'rotate-180' : '',
                                                    )}
                                                />
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pt-1">
                                            {renderMobileResourceLinks(() => setMobileMenuOpen(false))}
                                        </CollapsibleContent>
                                    </Collapsible>
                                </div>
                                <div className="relative z-10 space-y-3 border-t border-border p-4">
                                    <div className="rounded-md border border-border bg-background px-4 py-3">
                                        <div className="text-xs text-muted-foreground">{t('portal.nav.currentAccount')}</div>
                                        <div className="truncate text-sm font-medium">{account}</div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="rounded-md border border-border bg-background px-3 py-2">
                                            <ThemeToggle />
                                        </div>
                                        <LanguageSelector variant="minimal" />
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={handleLogout}
                                        className="group flex w-full items-center justify-start rounded-md border border-border bg-background px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
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
                        <UserPortalAnnouncementBanner />
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    )
}
