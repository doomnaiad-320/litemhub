import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useInfiniteUserPortalRechargeLogs } from '@/feature/user-portal/hooks'
import type { UserPortalRechargeLog } from '@/types/user-portal'

const RECHARGE_ORDER_PAGE_SIZE = 20

const formatMoney = (amount?: number) => `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`

const formatDateTime = (value?: string | number) => {
    if (!value) {
        return '-'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return '-'
    }

    return format(date, 'yyyy/MM/dd HH:mm')
}

const getRechargeAmount = (log: UserPortalRechargeLog) => log.pay_amount || log.amount

const getDiscountAmount = (log: UserPortalRechargeLog) => {
    if (typeof log.discount_amount === 'number') {
        return Math.max(log.discount_amount, 0)
    }

    return Math.max((log.amount || 0) - getRechargeAmount(log), 0)
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

function RechargeOrderStatusBadge({ status, label }: { status: string, label: string }) {
    const className = (() => {
        switch (status) {
            case 'success':
                return 'bg-[#e9f4ef] text-[#2f7d62] dark:bg-[#6f9d8d]/15 dark:text-[#9bc3b5]'
            case 'failed':
                return 'bg-[#fff1f0] text-[#b42318] dark:bg-[#b42318]/15 dark:text-[#fca5a5]'
            case 'unpaid':
            default:
                return 'bg-[#fff7ed] text-[#c2410c] dark:bg-[#c2410c]/15 dark:text-[#fb923c]'
        }
    })()

    return (
        <span className={cn(
            'inline-flex min-w-[56px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-medium leading-none',
            className,
        )}>
            {label}
        </span>
    )
}

function RechargeOrderDetailRow({ label, value, valueClassName }: {
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

export function UserPortalRechargeOrderHistory() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const loadMoreRef = useRef<HTMLDivElement | null>(null)
    const [selectedLog, setSelectedLog] = useState<UserPortalRechargeLog | null>(null)
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteUserPortalRechargeLogs(RECHARGE_ORDER_PAGE_SIZE, true)

    const rechargeLogs = useMemo(
        () => data?.pages.flatMap((page) => page.recharge_logs || []) || [],
        [data],
    )

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'success':
                return t('portal.dashboard.statusSuccess')
            case 'failed':
                return t('portal.dashboard.statusFailed')
            case 'unpaid':
            default:
                return t('portal.dashboard.statusUnpaid')
        }
    }

    useEffect(() => {
        if (!hasNextPage || !loadMoreRef.current) {
            return
        }

        const target = loadMoreRef.current
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0]
            if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
                void fetchNextPage()
            }
        }, { rootMargin: '120px 0px' })

        observer.observe(target)
        return () => observer.disconnect()
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, rechargeLogs.length])

    return (
        <>
            <div className="flex min-h-[420px] flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-6">
                    {isLoading ? (
                        <div className="space-y-3 py-2">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-[72px] rounded-lg" />
                            ))}
                        </div>
                    ) : rechargeLogs.length > 0 ? (
                        <div className="divide-y divide-[#f2f3f5] dark:divide-white/10">
                            {rechargeLogs.map((log) => (
                                <button
                                    key={log.id}
                                    type="button"
                                    onClick={() => setSelectedLog(log)}
                                    className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-[#fafafa] focus:outline-none dark:hover:bg-white/[0.03]"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold leading-5 text-[#18181b] dark:text-white">
                                            {log.out_trade_no || '-'}
                                        </div>
                                        <div className="mt-1 text-xs leading-5 text-[#8e8e93]">
                                            {formatDateTime(log.created_at)}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                        <div className="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-sm font-semibold leading-5 text-[#18181b] dark:text-white">
                                            {formatMoney(getRechargeAmount(log))}
                                        </div>
                                        <RechargeOrderStatusBadge
                                            status={log.status}
                                            label={getStatusLabel(log.status)}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-14 text-center text-sm text-[#8e8e93]">
                            {t('portal.dashboard.paymentOrderNoData')}
                        </div>
                    )}
                </div>

                {rechargeLogs.length > 0 && (
                    <div
                        ref={loadMoreRef}
                        className="flex min-h-12 items-center justify-center border-t border-[#f2f3f5] px-4 dark:border-white/10 sm:px-6"
                    >
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
                                className="h-8 px-3 text-xs text-[#45515e] hover:bg-transparent hover:text-[#18181b] dark:text-white/70 dark:hover:text-white"
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

            <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-h-[88vh] max-w-[min(720px,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-[#e5e7eb] bg-background p-0 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-white/15 dark:bg-[#111214]">
                    {selectedLog && (
                        <>
                            <DialogHeader className="border-b border-[#f2f3f5] px-4 py-4 text-left dark:border-white/10 sm:px-5">
                                <DialogTitle className="pr-8 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold leading-6 text-[#18181b] dark:text-white">
                                    {t('portal.dashboard.paymentOrderHistory')}
                                </DialogTitle>
                                <DialogDescription className="hidden" />
                            </DialogHeader>

                            <div className="px-4 py-3 sm:px-5">
                                <div className="divide-y divide-[#f2f3f5] dark:divide-white/10">
                                    <RechargeOrderDetailRow
                                        label={t('portal.dashboard.orderNo')}
                                        value={selectedLog.out_trade_no || '-'}
                                        valueClassName="break-all font-mono text-[13px]"
                                    />
                                    <RechargeOrderDetailRow
                                        label={t('common.time')}
                                        value={formatDateTime(selectedLog.created_at)}
                                    />
                                    {hasDetailValue(selectedLog.paid_at) && (
                                        <RechargeOrderDetailRow
                                            label="支付时间"
                                            value={formatDateTime(selectedLog.paid_at)}
                                        />
                                    )}
                                    <RechargeOrderDetailRow
                                        label={t('common.status')}
                                        value={getStatusLabel(selectedLog.status)}
                                        valueClassName={cn(
                                            'font-medium',
                                            selectedLog.status === 'success' && 'text-[#2f7d62] dark:text-[#9bc3b5]',
                                            selectedLog.status === 'failed' && 'text-[#b42318] dark:text-[#fca5a5]',
                                            selectedLog.status === 'unpaid' && 'text-[#c2410c] dark:text-[#fb923c]',
                                        )}
                                    />
                                    <RechargeOrderDetailRow
                                        label="原价"
                                        value={formatMoney(selectedLog.amount)}
                                        valueClassName="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold"
                                    />
                                    <RechargeOrderDetailRow
                                        label="实付"
                                        value={formatMoney(getRechargeAmount(selectedLog))}
                                        valueClassName="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold"
                                    />
                                    {getDiscountAmount(selectedLog) > 0 && (
                                        <RechargeOrderDetailRow
                                            label="优惠"
                                            value={formatMoney(getDiscountAmount(selectedLog))}
                                            valueClassName="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#1456f0] dark:text-[#7db0ff]"
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.discount_code) && (
                                        <RechargeOrderDetailRow
                                            label="折扣码"
                                            value={selectedLog.discount_code || '-'}
                                            valueClassName="font-mono text-[13px]"
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.channel) && (
                                        <RechargeOrderDetailRow
                                            label="渠道"
                                            value={selectedLog.channel || '-'}
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.pay_type) && (
                                        <RechargeOrderDetailRow
                                            label="支付方式"
                                            value={selectedLog.pay_type || '-'}
                                        />
                                    )}
                                    {hasDetailValue(selectedLog.trade_no) && (
                                        <RechargeOrderDetailRow
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
