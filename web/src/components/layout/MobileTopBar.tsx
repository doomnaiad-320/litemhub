import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ADMIN_NAV_ITEMS } from './adminNav'

interface MobileTopBarProps {
    className?: string
    onMenu: () => void
}

// H5 顶栏：显示当前页标题 + 汉堡按钮（打开导航抽屉）
export function MobileTopBar({ className, onMenu }: MobileTopBarProps) {
    const location = useLocation()
    const { t } = useTranslation()

    const currentFirstLevelPath = '/' + location.pathname.split('/')[1]
    const activeItem = ADMIN_NAV_ITEMS.find((item) => item.href === currentFirstLevelPath)

    return (
        <header
            className={cn(
                'sticky top-0 z-30 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-xl',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                        {activeItem ? (
                            <activeItem.icon className="h-5 w-5" />
                        ) : (
                            <span className="text-sm font-semibold">AI</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-foreground">
                            {activeItem ? t(`sidebar.${activeItem.key}`) : 'AI Proxy'}
                        </div>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onMenu}
                    className="h-10 w-10 shrink-0 rounded-md bg-background"
                >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">{t('sidebar.more')}</span>
                </Button>
            </div>
        </header>
    )
}
