import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bell, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePublicAnnouncements } from '@/feature/public-announcements/hooks'
import { ROUTES } from '@/routes/constants'
import { cn } from '@/lib/utils'

const dismissedAnnouncementKey = (id: number) => `user-portal-announcement-dismissed:${id}`

export function UserPortalAnnouncementBanner() {
    const { data, isLoading, isError } = usePublicAnnouncements(1, 1)
    const announcement = data?.announcements?.[0]
    const [dismissedId, setDismissedId] = useState<number | null>(null)

    useEffect(() => {
        if (!announcement?.id) return
        const dismissed = window.localStorage.getItem(dismissedAnnouncementKey(announcement.id)) === '1'
        setDismissedId(dismissed ? announcement.id : null)
    }, [announcement?.id])

    const visible = useMemo(() => {
        if (isLoading || isError || !announcement) return false
        return dismissedId !== announcement.id
    }, [announcement, dismissedId, isError, isLoading])

    if (!visible || !announcement) {
        return null
    }

    const handleDismiss = () => {
        window.localStorage.setItem(dismissedAnnouncementKey(announcement.id), '1')
        setDismissedId(announcement.id)
    }

    return (
        <div className="mb-4 rounded-[10px] border border-[#dbe3f0] bg-white/80 px-3 py-2.5 shadow-none backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] sm:px-4">
            <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#181e25] text-white dark:bg-white dark:text-[#181e25]">
                    <Bell className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {announcement.category && (
                            <span className="text-xs font-semibold text-[#1456f0] dark:text-[#93c5fd]">
                                {announcement.category}
                            </span>
                        )}
                        <span className="truncate text-sm font-semibold text-[#18181b] dark:text-white">
                            {announcement.title}
                        </span>
                    </div>
                    {announcement.summary && (
                        <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#45515e] dark:text-white/55">
                            {announcement.summary}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="hidden h-8 rounded-[6px] px-2 text-xs font-semibold text-[#1456f0] hover:bg-[#1456f0]/8 hover:text-[#17437d] dark:text-[#93c5fd] dark:hover:bg-white/10 sm:inline-flex"
                    >
                        <Link to={ROUTES.PUBLIC_API_UPDATES}>
                            查看
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8e8e93] transition",
                            "hover:bg-black/[0.04] hover:text-[#18181b] dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white",
                        )}
                        aria-label="关闭公告"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
