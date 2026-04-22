import { format } from 'date-fns'
import { CreditCard, ReceiptText, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { cn } from '@/lib/utils'
import type { UserPortalWalletLog } from '@/types/user-portal'
import {
    useUserPortalWallet,
    useUserPortalWalletLogs,
} from '@/feature/user-portal/hooks'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'

const formatMoney = (amount?: number) => `$${(amount || 0).toFixed(4)}`

const formatDateTime = (value?: string | number) => {
    if (!value) {
        return '-'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return '-'
    }

    return format(date, 'yyyy-MM-dd HH:mm')
}

const getWalletLogBadgeClass = (type: string) => {
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

export default function UserPortalDashboardPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const user = useUserPortalAuthStore((state) => state.user)
    const { data: walletData, isLoading } = useUserPortalWallet(true)
    const [walletLogPage, setWalletLogPage] = useState(1)
    const [walletLogPageSize, setWalletLogPageSize] = useState(20)
    const { data: walletLogData, isLoading: isWalletLogLoading } = useUserPortalWalletLogs(walletLogPage, walletLogPageSize, true)

    const wallet = walletData?.wallet
    const walletLogs = walletLogData?.wallet_logs || []
    const walletLogTotal = walletLogData?.total || 0
    const account = user?.email || user?.phone || `#${user?.id ?? ''}`

    const walletLogColumns: ColumnDef<UserPortalWalletLog>[] = useMemo(() => [
        {
            accessorKey: 'type',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.type')}</div>,
            cell: ({ row }) => (
                <Badge variant="outline" className={cn(getWalletLogBadgeClass(row.original.type))}>
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

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-8">
                <div className="space-y-3">
                    <div className="text-sm text-primary">{t('portal.dashboard.welcome')}</div>
                    <h1 className="text-3xl font-semibold tracking-tight">{t('portal.dashboard.title')}</h1>
                    <p className="max-w-2xl text-muted-foreground">
                        {t('portal.dashboard.description')}
                    </p>
                    <div className="inline-flex rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                        {t('portal.dashboard.currentAccount')}: {account}
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
                {isLoading || !wallet ? (
                    <>
                        <Skeleton className="h-48 rounded-[28px]" />
                        <Skeleton className="h-48 rounded-[28px]" />
                        <Skeleton className="h-48 rounded-[28px]" />
                    </>
                ) : (
                    <>
                        <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Wallet className="h-4 w-4 text-primary" />
                                    {t('portal.dashboard.balanceTitle')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-4xl font-semibold tracking-tight">
                                    {formatMoney(wallet.available_balance)}
                                </div>
                                <div className="rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
                                    {t('portal.dashboard.frozenHint', {
                                        amount: formatMoney(wallet.frozen_balance),
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <ReceiptText className="h-4 w-4 text-primary" />
                                    {t('portal.dashboard.historicalConsumed')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-4xl font-semibold tracking-tight">
                                    {formatMoney(wallet.historical_consumed)}
                                </div>
                                <div className="rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
                                    {t('portal.dashboard.historicalHint')}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <CreditCard className="h-4 w-4 text-primary" />
                                    {t('portal.dashboard.rechargeTitle')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="min-h-16 text-sm leading-6 text-muted-foreground">
                                    {t('portal.dashboard.rechargeDescription')}
                                </p>
                                <Button disabled className="w-full rounded-2xl">
                                    {t('portal.dashboard.rechargeSoon')}
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
            </section>

            <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                <CardHeader>
                    <CardTitle>{t('portal.logs.walletList')}</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    <div className="px-6 pb-5">
                        <DataTable
                            table={walletLogTable}
                            columns={walletLogColumns}
                            isLoading={isWalletLogLoading}
                            loadingStyle="skeleton"
                            fixedHeader={true}
                            showScrollShadows={false}
                        />
                    </div>
                    <div className="border-t border-border/60 px-3">
                        <ServerPagination
                            page={walletLogPage}
                            pageSize={walletLogPageSize}
                            total={walletLogTotal}
                            onPageChange={setWalletLogPage}
                            onPageSizeChange={(size) => {
                                setWalletLogPageSize(size)
                                setWalletLogPage(1)
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
