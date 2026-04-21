import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { LogTable } from '@/feature/log/components/LogTable'
import { cn } from '@/lib/utils'
import type { UserPortalWalletLog } from '@/types/user-portal'
import {
    useUserPortalModelLogs,
    useUserPortalWalletLogs,
} from '@/feature/user-portal/hooks'

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
    const [modelPage, setModelPage] = useState(1)
    const [modelPageSize, setModelPageSize] = useState(20)
    const [walletPage, setWalletPage] = useState(1)
    const [walletPageSize, setWalletPageSize] = useState(20)

    const { data: modelData, isLoading: isModelLoading } = useUserPortalModelLogs(modelPage, modelPageSize, true)
    const modelLogs = modelData?.logs || []
    const modelTotal = modelData?.total || 0

    const { data: walletData, isLoading: isWalletLoading } = useUserPortalWalletLogs(walletPage, walletPageSize, true)
    const walletLogs = walletData?.wallet_logs || []
    const walletTotal = walletData?.total || 0

    const walletColumns: ColumnDef<UserPortalWalletLog>[] = useMemo(() => [
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
                    {formatDateTime(row.original.created_at)}
                </div>
            ),
        },
    ], [t])

    const walletTable = useReactTable({
        data: walletLogs,
        columns: walletColumns,
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

            <Tabs defaultValue="model" className="space-y-4">
                <TabsList className="rounded-2xl bg-white/70 p-1 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.35)] dark:bg-white/5">
                    <TabsTrigger value="model" className="rounded-xl px-5">{t('portal.logs.modelTab')}</TabsTrigger>
                    <TabsTrigger value="wallet" className="rounded-xl px-5">{t('portal.logs.walletTab')}</TabsTrigger>
                </TabsList>

                <TabsContent value="model" className="mt-0">
                    <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                        <CardHeader>
                            <CardTitle>{t('portal.logs.modelList')}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6">
                            <LogTable
                                data={modelLogs}
                                total={modelTotal}
                                loading={isModelLoading}
                                page={modelPage}
                                pageSize={modelPageSize}
                                onPageChange={setModelPage}
                                onPageSizeChange={(size) => {
                                    setModelPageSize(size)
                                    setModelPage(1)
                                }}
                                detailScope="user"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="wallet" className="mt-0">
                    <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                        <CardHeader>
                            <CardTitle>{t('portal.logs.walletList')}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                            <div className="px-6 pb-5">
                                <DataTable
                                    table={walletTable}
                                    columns={walletColumns}
                                    isLoading={isWalletLoading}
                                    loadingStyle="skeleton"
                                    fixedHeader={true}
                                    showScrollShadows={false}
                                />
                            </div>
                            <div className="border-t border-border/60 px-3">
                                <ServerPagination
                                    page={walletPage}
                                    pageSize={walletPageSize}
                                    total={walletTotal}
                                    onPageChange={setWalletPage}
                                    onPageSizeChange={(size) => {
                                        setWalletPageSize(size)
                                        setWalletPage(1)
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
