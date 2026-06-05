import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_PRIMARY_TABS } from './adminNav'

interface MobileTabBarProps {
    className?: string
    onMore: () => void
    moreActive?: boolean
}

// H5 底部固定 TabBar：4 个核心入口 + “更多”（打开导航抽屉）
export function MobileTabBar({ className, onMore, moreActive }: MobileTabBarProps) {
    const location = useLocation()
    const { t } = useTranslation()

    const currentFirstLevelPath = '/' + location.pathname.split('/')[1]

    const tabBaseClass =
        'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors'

    return (
        <nav
            className={cn(
                'shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]',
                className,
            )}
        >
            <div className="grid grid-cols-5">
                {ADMIN_PRIMARY_TABS.map((item) => {
                    const isActive = !moreActive && currentFirstLevelPath === item.href

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                tabBaseClass,
                                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="leading-none">{t(`sidebar.${item.key}`)}</span>
                        </Link>
                    )
                })}
                <button
                    type="button"
                    onClick={onMore}
                    className={cn(
                        tabBaseClass,
                        moreActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="leading-none">{t('sidebar.more')}</span>
                </button>
            </div>
        </nav>
    )
}
