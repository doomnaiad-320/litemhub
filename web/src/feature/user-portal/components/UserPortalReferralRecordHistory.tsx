import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, ReceiptText } from 'lucide-react'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { useUserPortalReferralRecords } from '@/feature/user-portal/hooks'
import type { UserPortalReferralRecord } from '@/types/user-portal'

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

    const records = data?.referral_records || []
    const total = data?.total || 0

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
        <div className="rounded-lg border border-[#e5e7eb] bg-background shadow-none dark:border-white/10">
            <div className="space-y-3 p-4 md:hidden">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-36 rounded-md" />
                    ))
                ) : records.length > 0 ? (
                    records.map((record) => (
                        <div key={record.id} className="border-b border-[#f2f3f5] py-4 last:border-b-0 dark:border-white/10">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-[#18181b] dark:text-white">
                                        <Gift className="h-4 w-4 text-[#8e8e93]" />
                                        <span className="truncate">{invitedUserLabel(record)}</span>
                                    </div>
                                    <div className="mt-2 truncate text-xs text-[#8e8e93]">{record.order_no || record.discount_code || '-'}</div>
                                </div>
                                <Badge className="rounded-full border border-[#e5e7eb] bg-background px-2.5 py-1 text-xs font-medium text-[#45515e] shadow-none dark:border-white/10 dark:text-white/70">
                                    {statusLabel(record.status)}
                                </Badge>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-[#8e8e93]">{t('portal.referrals.rechargeAmount')}</div>
                                    <div className="mt-1 font-mono font-semibold text-[#18181b] dark:text-white">{record.pay_amount > 0 ? formatMoney(record.pay_amount || record.amount) : '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-[#8e8e93]">{t('portal.referrals.rebateAmount')}</div>
                                    <div className="mt-1 font-mono font-semibold text-[#18181b] dark:text-white">{formatMoney(record.rebate_amount)}</div>
                                </div>
                            </div>
                            <div className="mt-3 text-xs text-[#8e8e93]">
                                {t('portal.referrals.rechargeCount')}: {record.order_count}
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-xs text-[#8e8e93]">
                                <ReceiptText className="h-3.5 w-3.5" />
                                {t('portal.referrals.invitedAt')}: {formatDateTime(record.created_at)}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-[#8e8e93]">
                                <ReceiptText className="h-3.5 w-3.5" />
                                {t('portal.referrals.lastRechargedAt')}: {formatDateTime(record.paid_at)}
                            </div>
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
                    table={table}
                    columns={columns}
                    isLoading={isLoading}
                    loadingStyle="skeleton"
                    fixedHeader={true}
                    showScrollShadows={false}
                />
            </div>

            <div className="border-t border-[#f2f3f5] px-3 dark:border-white/10">
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
