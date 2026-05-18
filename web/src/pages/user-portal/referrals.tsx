import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    BadgePercent,
    Copy,
    Gift,
    ReceiptText,
} from 'lucide-react'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import type { UserPortalWalletLog } from '@/types/user-portal'
import {
    useGenerateUserPortalDiscountCode,
    useUserPortalDiscountCode,
    useUserPortalWalletLogs,
} from '@/feature/user-portal/hooks'

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

export default function UserPortalReferralsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [rechargeLogPage, setRechargeLogPage] = useState(1)
    const [rechargeLogPageSize, setRechargeLogPageSize] = useState(20)
    const { data: walletLogData, isLoading: isWalletLogLoading } = useUserPortalWalletLogs(
        rechargeLogPage,
        rechargeLogPageSize,
        true,
    )
    const { data: discountCodeData, isLoading: isDiscountCodeLoading } = useUserPortalDiscountCode(true)
    const generateDiscountCodeMutation = useGenerateUserPortalDiscountCode()

    const myDiscountCode = discountCodeData?.discount_code?.code
    const rechargeLogs = walletLogData?.wallet_logs || []
    const rechargeLogTotal = walletLogData?.total || 0

    const copyMyDiscountCode = async () => {
        if (!myDiscountCode) return

        await navigator.clipboard.writeText(myDiscountCode)
        toast.success(t('portal.dashboard.myDiscountCodeCopied'))
    }

    const walletLogTypeLabel = (type: string) => {
        switch (type) {
            case 'rebate':
                return t('portal.dashboard.logTypeRebate')
            case 'recharge':
                return t('portal.dashboard.logTypeRecharge')
            default:
                return type || '-'
        }
    }

    const rechargeLogColumns: ColumnDef<UserPortalWalletLog>[] = useMemo(() => [
        {
            accessorKey: 'remark',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.transaction')}</div>,
            cell: ({ row }) => (
                <div className="max-w-[280px]">
                    <div className="text-sm font-medium text-[#18181b] dark:text-white">
                        {walletLogTypeLabel(row.original.type)}
                    </div>
                    <div className="mt-1 truncate text-xs text-[#8e8e93]">
                        {row.original.remark || '-'}
                    </div>
                </div>
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
            cell: ({ row }) => <div className="font-mono text-sm text-[#18181b] dark:text-white">+{formatMoney(row.original.amount)}</div>,
        },
        {
            accessorKey: 'balance_after',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.balanceAfter')}</div>,
            cell: ({ row }) => <div className="font-mono text-sm text-[#45515e] dark:text-white/70">{formatMoney(row.original.balance_after)}</div>,
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

    const rechargeLogTable = useReactTable({
        data: rechargeLogs,
        columns: rechargeLogColumns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="w-full max-w-[1120px] space-y-6 font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white">
            <header>
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[28px] font-semibold leading-tight tracking-tight text-[#18181b] dark:text-white">
                    {t('portal.referrals.title')}
                </h1>
                <p className="mt-1 text-sm leading-[1.6] text-[#5f5f5f] dark:text-white/60">
                    {t('portal.referrals.description')}
                </p>
            </header>

            <section className="rounded-lg border border-[#e5e7eb] bg-background p-5 shadow-none dark:border-white/10 sm:p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#eef6f3] text-[#6f9d8d] dark:bg-[#6f9d8d]/15 dark:text-[#9bc3b5]">
                        <Gift className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <BadgePercent className="h-4 w-4 text-[#18181b] dark:text-white" />
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">
                                {t('portal.dashboard.myDiscountCodeTitle')}
                            </h2>
                        </div>
                        <p className="mt-1 text-sm leading-[1.6] text-[#8e8e93]">{t('portal.dashboard.myDiscountCodeDescription')}</p>

                        <div className="mt-5 max-w-xl border-t border-[#f2f3f5] pt-5 dark:border-white/10">
                            {isDiscountCodeLoading ? (
                                <Skeleton className="h-11 w-full rounded-md" />
                            ) : myDiscountCode ? (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1 rounded-md border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 font-mono text-base font-semibold tracking-[0.08em] text-[#18181b] dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
                                        {myDiscountCode}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={copyMyDiscountCode}
                                        className="h-11 rounded-md border-[#e5e7eb] bg-background px-4 shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10"
                                    >
                                        <Copy className="h-4 w-4" />
                                        {t('portal.referrals.copyCode')}
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={() => generateDiscountCodeMutation.mutate()}
                                    disabled={generateDiscountCodeMutation.isPending}
                                    className="h-11 rounded-md bg-[#181e25] px-5 text-white shadow-none hover:bg-[#111827] dark:bg-white dark:text-[#181e25]"
                                >
                                    {generateDiscountCodeMutation.isPending
                                        ? t('portal.dashboard.generatingDiscountCode')
                                        : t('portal.dashboard.generateDiscountCode')}
                                </Button>
                            )}
                        </div>
                        <p className="mt-3 text-xs leading-[1.6] text-[#8e8e93]">{t('portal.dashboard.myDiscountCodeHelp')}</p>
                    </div>
                </div>
            </section>

            <section>
                <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">
                            {t('portal.dashboard.transactionHistory')}
                        </h2>
                        <p className="mt-1 text-sm text-[#8e8e93]">{t('portal.dashboard.transactionDescription')}</p>
                    </div>
                    <div className="w-fit rounded-full border border-[#e5e7eb] px-3 py-1 text-xs font-medium text-[#45515e] dark:border-white/10 dark:text-white/70">
                        {t('portal.dashboard.totalRecords', { count: rechargeLogTotal })}
                    </div>
                </div>

                <div className="rounded-lg border border-[#e5e7eb] bg-background shadow-none dark:border-white/10">
                    <div className="space-y-3 p-4 md:hidden">
                        {isWalletLogLoading ? (
                            Array.from({ length: 3 }).map((_, index) => (
                                <Skeleton key={index} className="h-28 rounded-md" />
                            ))
                        ) : rechargeLogs.length > 0 ? (
                            rechargeLogs.map((log) => (
                                <div key={log.id} className="border-b border-[#f2f3f5] py-4 last:border-b-0 dark:border-white/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-[#18181b] dark:text-white">
                                                <ReceiptText className="h-4 w-4 text-[#8e8e93]" />
                                                <span className="truncate">{walletLogTypeLabel(log.type)}</span>
                                            </div>
                                            <div className="mt-2 line-clamp-2 text-xs text-[#8e8e93]">{log.remark || '-'}</div>
                                        </div>
                                        <Badge className="rounded-full border border-[#e5e7eb] bg-background px-2.5 py-1 text-xs font-medium text-[#45515e] shadow-none dark:border-white/10 dark:text-white/70">
                                            {walletLogTypeLabel(log.type)}
                                        </Badge>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <div className="text-xs text-[#8e8e93]">{t('portal.dashboard.amount')}</div>
                                            <div className="mt-1 font-mono font-semibold text-[#18181b] dark:text-white">+{formatMoney(log.amount)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[#8e8e93]">{t('portal.dashboard.balanceAfter')}</div>
                                            <div className="mt-1 font-mono font-semibold text-[#18181b] dark:text-white">{formatMoney(log.balance_after)}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs text-[#8e8e93]">{formatDateTime(log.created_at)}</div>
                                </div>
                            ))
                        ) : (
                            <div className="border border-dashed border-[#e5e7eb] p-6 text-center text-sm text-[#8e8e93] dark:border-white/10">
                                {t('table.noData')}
                            </div>
                        )}
                    </div>

                    <div className="hidden md:block">
                        <DataTable
                            table={rechargeLogTable}
                            columns={rechargeLogColumns}
                            isLoading={isWalletLogLoading}
                            loadingStyle="skeleton"
                            fixedHeader={true}
                            showScrollShadows={false}
                        />
                    </div>

                    <div className="border-t border-[#f2f3f5] px-3 dark:border-white/10">
                        <ServerPagination
                            page={rechargeLogPage}
                            pageSize={rechargeLogPageSize}
                            total={rechargeLogTotal}
                            onPageChange={setRechargeLogPage}
                            onPageSizeChange={(size) => {
                                setRechargeLogPageSize(size)
                                setRechargeLogPage(1)
                            }}
                        />
                    </div>
                </div>
            </section>
        </div>
    )
}
