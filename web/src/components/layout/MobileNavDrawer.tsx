import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes/constants'
import useAuthStore from '@/store/auth'
import { ADMIN_NAV_ITEMS } from './adminNav'

interface MobileNavDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

// H5 全量导航抽屉：列出全部后台入口 + 主题切换 + 登出
export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const logout = useAuthStore((s) => s.logout)

    const currentFirstLevelPath = '/' + location.pathname.split('/')[1]

    const handleLogout = () => {
        logout()
        onOpenChange(false)
        navigate(ROUTES.ADMIN_LOGIN)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-[86vw] max-w-[340px] flex-col border-l border-border bg-background p-0 text-foreground"
            >
                <SheetHeader className="border-b border-border p-5 text-left">
                    <SheetDescription className="text-xs font-medium text-muted-foreground">
                        AI Proxy
                    </SheetDescription>
                    <SheetTitle className="text-base font-semibold text-foreground">
                        {t('sidebar.more')}
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-3">
                    {ADMIN_NAV_ITEMS.map((item) => {
                        const isActive = currentFirstLevelPath === item.href

                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => onOpenChange(false)}
                                className={cn(
                                    'mx-2 my-1 flex items-center rounded-md px-4 py-3 transition-colors',
                                    isActive
                                        ? 'bg-muted text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                                )}
                            >
                                <div className="flex h-5 w-5 items-center justify-center">
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <span className="ml-3 font-medium">{t(`sidebar.${item.key}`)}</span>
                            </Link>
                        )
                    })}
                </div>

                <div className="space-y-3 border-t border-border p-4">
                    <div className="flex min-h-11 items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-muted-foreground">
                        <span className="font-medium">{t('sidebar.theme')}</span>
                        <ThemeToggle className="ml-3" />
                    </div>
                    <Button
                        variant="secondary"
                        onClick={handleLogout}
                        className="group flex w-full items-center justify-start rounded-md border border-border bg-background px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                    >
                        <LogOut className="mr-3 h-5 w-5" />
                        {t('sidebar.logout')}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}
