import { format, isToday, isYesterday } from 'date-fns'
import { Loader2, ReceiptText } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/table/motion-data-table'
import { cn } from '@/lib/utils'
import { useInfiniteUserPortalWalletLogs } from '@/feature/user-portal/hooks'
import type { UserPortalWalletLog } from '@/types/user-portal'

const WALLET_LOG_PAGE_SIZE = 20

const formatMoney = (amount?: number) => `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`

const formatSignedMoney = (amount?: number) => {
    const value = amount || 0
    const prefix = value > 0 ? '+' : value < 0 ? '-' : ''

    return `${prefix}${formatMoney(Math.abs(value))}`
}

const toDate = (value?: string | number) => {
    if (!value) {
        return null
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return null
    }

    return date
}

const formatDateTime = (value?: string | number) => {
    const date = toDate(value)

    return date ? format(date, 'yyyy/MM/dd HH:mm') : '-'
}

const formatLogTime = (value?: string | number) => {
    const date = toDate(value)

    return date ? format(date, 'HH:mm') : '-'
}

const getDateGroupKey = (value?: string | number) => {
    const date = toDate(value)

    return date ? format(date, 'yyyy-MM-dd') : 'unknown'
}

const getAmountTone = (amount?: number) => {
    const value = amount || 0

    if (value > 0) {
        return 'text-[#2f7d62] dark:text-[#9bc3b5]'
    }

    if (value < 0) {
        return 'text-[#c2410c] dark:text-[#fb923c]'
    }

    return 'text-[#18181b] dark:text-white'
}

const getPayAmount = (log: UserPortalWalletLog) => log.pay_amount || log.amount

const getDiscountAmount = (log: UserPortalWalletLog) => {
    if (typeof log.discount_amount === 'number') {
        return Math.max(log.discount_amount, 0)
    }

    return Math.max((log.amount || 0) - getPayAmount(log), 0)
}

const hasDetailValue = (value?: string | number | null) => {
    if (value === null || value === undefined) {
        return false
    }

    if (typeof value === 'number') {
        return true
    }

    return value.trim().length > 0
}

function WalletLogDetailRow({ label, value, valueClassName }: {
    label: string
    value: string
    valueClassName?: string
}) {
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 py-2">
            <span className="text-xs leading-5 text-[#8e8e93]">{label}</span>
            <span className={cn(
                'min-w-0 text-right text-sm leading-5 text-[#18181b] dark:text-white/85',
                valueClassName,
            )}>
                {value}
            </span>
        </div>
    )
}

export function UserPortalWalletLogHistory() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const mobileLoadMoreRef = useRef<HTMLDivElement | null>(null)
    const desktopLoadMoreRef = useRef<HTMLDivElement | null>(null)
    const [selectedLog, setSelectedLog] = useState<UserPortalWalletLog | null>(null)
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteUserPortalWalletLogs(WALLET_LOG_PAGE_SIZE, true)

    const walletLogs = useMemo(
        () => data?.pages.flatMap((page) => page.wallet_logs || []) || [],
        [data],
    )
    const totalRecords = data?.pages[0]?.total || 0

    const walletLogTypeLabel = (type: string) => {
        switch (type) {
            case 'rebate':
                return t('portal.dashboard.logTypeRebate')
            case 'recharge':
                return t('portal.dashboard.logTypeRecharge')
            case 'adjust':
                return t('portal.dashboard.logTypeAdjust')
            default:
                return type || '-'
        }
    }

    const getDateGroupLabel = (value?: string | number) => {
        const date = toDate(value)
        if (!date) {
            return t('portal.dashboard.walletLogDateUnknown')
        }

        if (isToday(date)) {
            return t('portal.dashboard.walletLogToday')
        }

        if (isYesterday(date)) {
            return t('portal.dashboard.walletLogYesterday')
        }

        return format(date, 'yyyy/MM/dd')
    }

    const groupedWalletLogs = useMemo(() => {
        const groups: Array<{ key: string; label: string; logs: UserPortalWalletLog[] }> = []

        walletLogs.forEach((log) => {
            const key = getDateGroupKey(log.created_at)
            let group = groups.find((item) => item.key === key)

            if (!group) {
                group = {
                    key,
                    label: getDateGroupLabel(log.created_at),
                    logs: [],
                }
                groups.push(group)
            }

            group.logs.push(log)
        })

        return groups
    }, [walletLogs, t])

    useEffect(() => {
        const targets = [mobileLoadMoreRef.current, desktopLoadMoreRef.current].filter(
            (target): target is HTMLDivElement => Boolean(target),
        )
        if (targets.length === 0 || !hasNextPage) {
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting) && hasNextPage && !isFetchingNextPage) {
                    void fetchNextPage()
                }
            },
            { rootMargin: '160px 0px' },
        )

        targets.forEach((target) => observer.observe(target))

        return () => observer.disconnect()
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, walletLogs.length])

    const walletLogColumns: ColumnDef<UserPortalWalletLog>[] = useMemo(() => [
        {
            accessorKey: 'remark',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.transaction')}</div>,
            cell: ({ row }) => (
                <button
                    type="button"
                    onClick={() => setSelectedLog(row.original)}
                    className="max-w-[280px] text-left"
                >
                    <div className="text-sm font-medium text-[#18181b] dark:text-white">
                        {walletLogTypeLabel(row.original.type)}
                    </div>
                    <div className="mt-1 truncate text-xs text-[#8e8e93]">
                        {row.original.remark || '-'}
                    </div>
                </button>
            ),
        },
        {
            accessorKey: 'type',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.type')}</div>,
            cell: ({ row }) => (
                <Badge className="rounded-full border border-[#e5e7eb] bg-background px-2.5 py-1 text-xs font-medium text-[#45515e] shadow-none dark:border-white/10 dark:text-white/70">
                    {walletLogTypeLabel(row.original.type)}
                </Badge>
            ),
        },
        {
            accessorKey: 'amount',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.amount')}</div>,
            cell: ({ row }) => (
                <div className={cn('font-mono text-sm font-semibold', getAmountTone(row.original.amount))}>
                    {formatSignedMoney(row.original.amount)}
                </div>
            ),
        },
        {
            accessorKey: 'created_at',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.createdAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-[#8e8e93]">
                    {formatDateTime(row.original.created_at)}
                </div>
            ),
        },
    ], [t])

    const walletLogTable = useReactTable({
        data: walletLogs,
        columns: walletLogColumns,
        getCoreRowModel: getCoreRowModel(),
    })

    const renderMobileContent = () => {
        if (isLoading) {
            return (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-[68px] rounded-md" />
                    ))}
                </div>
            )
        }

        if (walletLogs.length === 0) {
            return (
                <div className="rounded-lg border border-dashed border-[#e5e7eb] p-6 text-center text-sm text-[#8e8e93] dark:border-white/10">
                    {t('table.noData')}
                </div>
            )
        }

        return (
            <div className="space-y-4">
                {groupedWalletLogs.map((group) => (
                    <div key={group.key}>
                        <div className="sticky top-0 z-[1] bg-background/95 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93] backdrop-blur dark:bg-background/95">
                            {group.label}
                        </div>
                        <div className="divide-y divide-[#f2f3f5] rounded-lg border border-[#f2f3f5] bg-background dark:divide-white/10 dark:border-white/10">
                            {group.logs.map((log) => (
                                <button
                                    key={log.id}
                                    type="button"
                                    onClick={() => setSelectedLog(log)}
                                    className="flex min-h-[72px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#fafafa] focus:outline-none dark:hover:bg-white/[0.03]"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f6f7f9] text-[#8e8e93] dark:bg-white/5">
                                        <ReceiptText className="h-4 w-4" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="truncate text-sm font-semibold leading-5 text-[#18181b] dark:text-white">
                                                {walletLogTypeLabel(log.type)}
                                            </span>
                                            <span className="shrink-0 text-[11px] leading-4 text-[#8e8e93]">
                                                {formatLogTime(log.created_at)}
                                            </span>
                                        </div>
                                        <div className="mt-1 line-clamp-1 text-xs leading-4 text-[#8e8e93]">
                                            {log.remark || t('portal.dashboard.walletLogNoRemark')}
                                        </div>
                                    </div>

                                    <div className={cn(
                                        'shrink-0 font-mono text-sm font-semibold leading-5',
                                        getAmountTone(log.amount),
                                    )}>
                                        {formatSignedMoney(log.amount)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                <div ref={mobileLoadMoreRef} className="flex min-h-10 items-center justify-center">
                    {isFetchingNextPage ? (
                        <div className="flex items-center gap-2 text-xs text-[#8e8e93]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {t('portal.dashboard.walletLogLoadingMore')}
                        </div>
                    ) : hasNextPage ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void fetchNextPage()}
                            className="h-8 px-3 text-xs text-[#45515e] hover:bg-[#f6f7f9] dark:text-white/70 dark:hover:bg-white/5"
                        >
                            {t('portal.dashboard.walletLogLoadMore')}
                        </Button>
                    ) : (
                        <div className="text-xs text-[#8e8e93]">
                            {t('portal.dashboard.walletLogNoMore')}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <>
            <section>
                <div className="mb-2 flex flex-col justify-between gap-2 sm:mb-3 sm:flex-row sm:items-end sm:gap-3">
                    <div>
                        <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-base font-semibold text-[#18181b] dark:text-white sm:text-lg">
                            {t('portal.dashboard.transactionHistory')}
                        </h2>
                        <p className="mt-1 text-xs text-[#8e8e93] sm:text-sm">
                            {t('portal.dashboard.totalRecords', { count: totalRecords })}
                        </p>
                    </div>
                </div>

                <div className="md:hidden">
                    {renderMobileContent()}
                </div>

                <div className="hidden rounded-lg border border-[#e5e7eb] bg-background shadow-none dark:border-white/10 md:block">
                    <DataTable
                        table={walletLogTable}
                        columns={walletLogColumns}
                        isLoading={isLoading}
                        loadingStyle="skeleton"
                        fixedHeader={true}
                        showScrollShadows={false}
                    />
                    {walletLogs.length > 0 && (
                        <div ref={desktopLoadMoreRef} className="flex min-h-12 items-center justify-center border-t border-[#f2f3f5] px-4 dark:border-white/10">
                            {isFetchingNextPage ? (
                                <div className="flex items-center gap-2 text-xs text-[#8e8e93]">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {t('portal.dashboard.walletLogLoadingMore')}
                                </div>
                            ) : hasNextPage ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void fetchNextPage()}
                                    className="h-8 px-3 text-xs text-[#45515e] hover:bg-[#f6f7f9] dark:text-white/70 dark:hover:bg-white/5"
                                >
                                    {t('portal.dashboard.walletLogLoadMore')}
                                </Button>
                            ) : (
                                <div className="text-xs text-[#8e8e93]">
                                    {t('portal.dashboard.walletLogNoMore')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-h-[88vh] max-w-[min(720px,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-[#e5e7eb] bg-background p-0 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-white/15 dark:bg-[#111214]">
                    {selectedLog && (
                        <>
                            <DialogHeader className="border-b border-[#f2f3f5] px-4 py-4 text-left dark:border-white/10 sm:px-5">
                                <DialogTitle className="pr-8 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold leading-6 text-[#18181b] dark:text-white">
                                    {walletLogTypeLabel(selectedLog.type)}
                                </DialogTitle>
                                <DialogDescription className="hidden" />
                            </DialogHeader>

                            <div className="px-4 py-3 sm:px-5">
                                <div className="divide-y divide-[#f2f3f5] dark:divide-white/10">
                                    <WalletLogDetailRow
                                        label="时间"
                                        value={formatDateTime(selectedLog.created_at)}
                                    />
                                    <WalletLogDetailRow
                                        label="金额"
                                        value={formatSignedMoney(selectedLog.amount)}
                                        valueClassName={cn(
                                            "font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold",
                                            getAmountTone(selectedLog.amount),
                                        )}
                                    />
                                    <WalletLogDetailRow
                                        label="备注"
                                        value={selectedLog.remark || t('portal.dashboard.walletLogNoRemark')}
                                        valueClassName="break-all"
                                    />
                                    {hasDetailValue(selectedLog.out_trade_no) && (
                                        <WalletLogDetailRow
                                            label="订单号"
                                            value={selectedLog.out_trade_no || '-'}
                                            valueClassName="break-all font-mono text-[13px]"
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.paid_at) && (
                                        <WalletLogDetailRow
                                            label="支付时间"
                                            value={formatDateTime(selectedLog.paid_at)}
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.pay_amount) && (
                                        <WalletLogDetailRow
                                            label="实付"
                                            value={formatMoney(getPayAmount(selectedLog))}
                                            valueClassName="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold"
                                        />
                                    )}
                                    {getDiscountAmount(selectedLog) > 0 && (
                                        <WalletLogDetailRow
                                            label="优惠"
                                            value={formatMoney(getDiscountAmount(selectedLog))}
                                            valueClassName="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#1456f0] dark:text-[#7db0ff]"
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.discount_code) && (
                                        <WalletLogDetailRow
                                            label="折扣码"
                                            value={selectedLog.discount_code || '-'}
                                            valueClassName="font-mono text-[13px]"
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.channel) && (
                                        <WalletLogDetailRow
                                            label="渠道"
                                            value={selectedLog.channel || '-'}
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.pay_type) && (
                                        <WalletLogDetailRow
                                            label="支付方式"
                                            value={selectedLog.pay_type || '-'}
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.trade_no) && (
                                        <WalletLogDetailRow
                                            label="支付单号"
                                            value={selectedLog.trade_no || '-'}
                                            valueClassName="break-all font-mono text-[13px]"
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
