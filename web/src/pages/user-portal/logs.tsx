import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { cn } from '@/lib/utils'
import type { UserPortalWalletLog } from '@/types/user-portal'
import { useUserPortalWalletLogs } from '@/feature/user-portal/hooks'

const formatMoney = (amount?: number) => `$${(amount || 0).toFixed(4)}`

const getLogBadgeClass = (type: string) => {
    switch (type) {
        case 'recharge':
            return 'border-transparent bg-primary/12 text-primary'
        case 'reserve':
            return 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        case 'settle':
            return 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        case 'release':
            return 'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'
        default:
            return 'border-transparent bg-muted text-muted-foreground'
    }
}

export default function UserPortalLogsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    const { data, isLoading } = useUserPortalWalletLogs(page, pageSize, true)
    const logs = data?.wallet_logs || []
    const total = data?.total || 0

    const columns: ColumnDef<UserPortalWalletLog>[] = useMemo(() => [
        {
            accessorKey: 'type',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.type')}</div>,
            cell: ({ row }) => (
                <Badge variant="outline" className={cn(getLogBadgeClass(row.original.type))}>
                    {row.original.type}
                </Badge>
            ),
        },
        {
            accessorKey: 'amount',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.amount')}</div>,
            cell: ({ row }) => <div className="font-mono text-sm">{formatMoney(row.original.amount)}</div>,
        },
        {
            id: 'balance',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.balance')}</div>,
            cell: ({ row }) => (
                <div className="font-mono text-xs text-muted-foreground">
                    {formatMoney(row.original.balance_before)} → {formatMoney(row.original.balance_after)}
                </div>
            ),
        },
        {
            accessorKey: 'remark',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.remark')}</div>,
            cell: ({ row }) => (
                <div className="max-w-[280px] break-words text-sm text-muted-foreground">
                    {row.original.remark || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'created_at',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.createdAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {format(new Date(row.original.created_at), 'yyyy-MM-dd HH:mm')}
                </div>
            ),
        },
    ], [t])

    const table = useReactTable({
        data: logs,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="space-y-2">
                    <div className="text-sm text-primary">{t('portal.logs.badge')}</div>
                    <h1 className="text-3xl font-semibold tracking-tight">{t('portal.logs.title')}</h1>
                    <p className="max-w-3xl text-muted-foreground">{t('portal.logs.description')}</p>
                </div>
            </section>

            <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                <CardHeader>
                    <CardTitle>{t('portal.logs.list')}</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    <div className="px-6 pb-5">
                        <DataTable
                            table={table}
                            columns={columns}
                            isLoading={isLoading}
                            loadingStyle="skeleton"
                            fixedHeader={true}
                            showScrollShadows={false}
                        />
                    </div>
                    <div className="border-t border-border/60 px-3">
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
                </CardContent>
            </Card>
        </div>
    )
}
