import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import {
    useInfiniteUserPortalReferralRecords,
    useUserPortalReferralRecords,
} from '@/feature/user-portal/hooks'
import type { UserPortalReferralRecord } from '@/types/user-portal'

const REFERRAL_RECORD_PAGE_SIZE = 20

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

export function UserPortalReferralRecordHistory() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const { data, isLoading } = useUserPortalReferralRecords(page, pageSize, true)
    const {
        data: mobileData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isMobileLoading,
    } = useInfiniteUserPortalReferralRecords(REFERRAL_RECORD_PAGE_SIZE, true)

    const records = data?.referral_records || []
    const total = data?.total || 0
    const mobileRecords = useMemo(
        () => mobileData?.pages.flatMap((item) => item.referral_records || []) || [],
        [mobileData],
    )

    const statusLabel = (status: string) => {
        switch (status) {
            case 'recharged':
                return t('portal.referrals.statusRecharged')
            case 'invited':
                return t('portal.referrals.statusInvited')
            default:
                return status || '-'
        }
    }

    const invitedUserLabel = (record: UserPortalReferralRecord) => (
        record.invited_user_email
        || record.invited_user_phone
        || `#${record.invited_user_id}`
    )

    const columns: ColumnDef<UserPortalReferralRecord>[] = useMemo(() => [
        {
            accessorKey: 'invited_user_email',
            header: () => <div className="py-3.5 font-medium">{t('portal.referrals.invitedUser')}</div>,
            cell: ({ row }) => (
                <div className="max-w-[280px]">
                    <div className="text-sm font-medium text-[#18181b] dark:text-white">
                        {invitedUserLabel(row.original)}
                    </div>
                    <div className="mt-1 truncate text-xs text-[#8e8e93]">
                        {row.original.order_no || row.original.discount_code || '-'}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: () => <div className="py-3.5 font-medium">{t('portal.referrals.recordStatus')}</div>,
            cell: ({ row }) => (
                <Badge className="rounded-full border border-[#e5e7eb] bg-background px-2.5 py-1 text-xs font-medium text-[#45515e] shadow-none dark:border-white/10 dark:text-white/70">
                    {statusLabel(row.original.status)}
                </Badge>
            ),
        },
        {
            accessorKey: 'pay_amount',
            header: () => <div className="py-3.5 font-medium">{t('portal.referrals.rechargeAmount')}</div>,
            cell: ({ row }) => <div className="font-mono text-sm text-[#18181b] dark:text-white">{row.original.pay_amount > 0 ? formatMoney(row.original.pay_amount || row.original.amount) : '-'}</div>,
        },
        {
            accessorKey: 'rebate_amount',
            header: () => <div className="py-3.5 font-medium">{t('portal.referrals.rebateAmount')}</div>,
            cell: ({ row }) => <div className="font-mono text-sm text-[#45515e] dark:text-white/70">{formatMoney(row.original.rebate_amount)}</div>,
        },
        {
            accessorKey: 'order_count',
            header: () => <div className="py-3.5 font-medium">{t('portal.referrals.rechargeCount')}</div>,
            cell: ({ row }) => <div className="text-sm text-[#45515e] dark:text-white/70">{row.original.order_count}</div>,
        },
        {
            accessorKey: 'created_at',
            header: () => <div className="py-3.5 font-medium">{t('portal.referrals.invitedAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-[#8e8e93]">
                    {formatDateTime(row.original.created_at)}
                </div>
            ),
        },
        {
            accessorKey: 'paid_at',
            header: () => <div className="py-3.5 font-medium">{t('portal.referrals.lastRechargedAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-[#8e8e93]">
                    {formatDateTime(row.original.paid_at)}
                </div>
            ),
        },
    ], [t])

    const table = useReactTable({
        data: records,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div>
            <div className="space-y-2 md:hidden">
                {isMobileLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-md" />
                    ))
                ) : mobileRecords.length > 0 ? (
                    <>
                        {mobileRecords.map((record) => (
                            <div key={record.id} className="rounded-md border border-[#e5e7eb] bg-background p-3 shadow-none dark:border-white/10">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-[#18181b] dark:text-white">
                                            {invitedUserLabel(record)}
                                        </div>
                                        <div className="mt-1 truncate text-xs text-[#8e8e93]">
                                            {record.order_no || record.discount_code || '-'}
                                        </div>
                                        <div className="mt-2 text-xs text-[#8e8e93]">
                                            {formatDateTime(record.created_at)}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <Badge className="rounded-md border border-[#e5e7eb] bg-background px-2 py-1 text-xs font-medium text-[#45515e] shadow-none dark:border-white/10 dark:text-white/70">
                                            {statusLabel(record.status)}
                                        </Badge>
                                        <div className="mt-2 font-mono text-sm font-semibold text-[#18181b] dark:text-white">
                                            {formatMoney(record.rebate_amount)}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#f2f3f5] pt-3 text-xs dark:border-white/10">
                                    <div className="min-w-0">
                                        <div className="text-[#8e8e93]">{t('portal.referrals.rechargeAmount')}</div>
                                        <div className="mt-1 truncate font-mono text-[#45515e] dark:text-white/70">
                                            {record.pay_amount > 0 ? formatMoney(record.pay_amount || record.amount) : '-'}
                                        </div>
                                    </div>
                                    <div className="min-w-0 text-right">
                                        <div className="text-[#8e8e93]">{t('portal.referrals.rechargeCount')}</div>
                                        <div className="mt-1 text-[#45515e] dark:text-white/70">{record.order_count}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="pt-2">
                            {hasNextPage ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 w-full rounded-md border-[#e5e7eb] bg-background text-sm font-medium text-[#45515e] shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10 dark:text-white/70"
                                    disabled={isFetchingNextPage}
                                    onClick={() => void fetchNextPage()}
                                >
                                    {isFetchingNextPage ? t('portal.referrals.loadingMore') : t('portal.referrals.loadMore')}
                                </Button>
                            ) : (
                                <div className="py-2 text-center text-xs text-[#8e8e93]">
                                    {t('portal.referrals.noMoreRecords')}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="rounded-md border border-dashed border-[#e5e7eb] bg-background p-6 text-center text-sm text-[#8e8e93] dark:border-white/10">
                        {t('table.noData')}
                    </div>
                )}
            </div>

            <div className="hidden overflow-hidden rounded-md border border-[#e5e7eb] bg-background shadow-none dark:border-white/10 md:block">
                <DataTable
                    table={table}
                    columns={columns}
                    isLoading={isLoading}
                    loadingStyle="skeleton"
                    fixedHeader={true}
                    showScrollShadows={false}
                />
            </div>

            <div className="mt-3 hidden rounded-md border border-[#e5e7eb] bg-background px-3 shadow-none dark:border-white/10 md:mt-0 md:block md:rounded-t-none md:border-t-0">
                <ServerPagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size)
                        setPage(1)
                    }}
                />
            </div>
        </div>
    )
}
