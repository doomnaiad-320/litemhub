import { format } from 'date-fns'
import { CreditCard, ExternalLink, ReceiptText, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import type { UserPortalWalletLog } from '@/types/user-portal'
import {
    useUserPortalDuluPayRecharge,
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

export default function UserPortalDashboardPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const user = useUserPortalAuthStore((state) => state.user)
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: walletData, isLoading } = useUserPortalWallet(true)
    const [walletLogPage, setWalletLogPage] = useState(1)
    const [walletLogPageSize, setWalletLogPageSize] = useState(20)
    const [rechargeAmount, setRechargeAmount] = useState('50')
    const [paymentType, setPaymentType] = useState('alipay')
    const { data: walletLogData, isLoading: isWalletLogLoading } = useUserPortalWalletLogs(walletLogPage, walletLogPageSize, true)
    const rechargeMutation = useUserPortalDuluPayRecharge()

    const wallet = walletData?.wallet
    const walletLogs = walletLogData?.wallet_logs || []
    const walletLogTotal = walletLogData?.total || 0
    const account = user?.email || user?.phone || `#${user?.id ?? ''}`

    useEffect(() => {
        const payment = searchParams.get('payment')
        if (payment === 'success') {
            toast.success(t('portal.dashboard.paymentSuccess'))
            setSearchParams({}, { replace: true })
        } else if (payment === 'failed') {
            toast.error(t('portal.dashboard.paymentFailed'))
            setSearchParams({}, { replace: true })
        }
    }, [searchParams, setSearchParams, t])

    const startRecharge = async () => {
        const amount = Number(rechargeAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error(t('portal.dashboard.amountInvalid'))
            return
        }

        const response = await rechargeMutation.mutateAsync({
            amount,
            type: paymentType,
        })
        const payment = response.payment
        if (payment.pay_type === 'jump' || payment.pay_type === 'urlscheme') {
            window.location.href = payment.pay_info
            return
        }

        window.open(payment.pay_info, '_blank', 'noopener,noreferrer')
    }

    const walletLogColumns: ColumnDef<UserPortalWalletLog>[] = useMemo(() => [
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
        <div className="space-y-4 sm:space-y-6">
            <section className="rounded-[18px] border border-white/60 bg-white/70 p-3 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:rounded-[24px] sm:p-4">
                <div className="space-y-2">
                    <div className="text-sm text-primary">{t('portal.dashboard.welcome')}</div>
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('portal.dashboard.title')}</h1>
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
                        <Skeleton className="h-40 rounded-[24px] sm:h-48 sm:rounded-[28px]" />
                        <Skeleton className="h-40 rounded-[24px] sm:h-48 sm:rounded-[28px]" />
                        <Skeleton className="h-40 rounded-[24px] sm:h-48 sm:rounded-[28px]" />
                    </>
                ) : (
                    <>
                        <Card className="rounded-[24px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5 sm:rounded-[28px]">
                            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Wallet className="h-4 w-4 text-primary" />
                                    {t('portal.dashboard.balanceTitle')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-4 pt-2 sm:space-y-4 sm:p-6 sm:pt-3">
                                <div className="break-all text-3xl font-semibold tracking-tight sm:text-4xl">
                                    {formatMoney(wallet.available_balance)}
                                </div>
                                <div className="rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
                                    {t('portal.dashboard.frozenHint', {
                                        amount: formatMoney(wallet.frozen_balance),
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[24px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5 sm:rounded-[28px]">
                            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <ReceiptText className="h-4 w-4 text-primary" />
                                    {t('portal.dashboard.historicalConsumed')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-4 pt-2 sm:space-y-4 sm:p-6 sm:pt-3">
                                <div className="break-all text-3xl font-semibold tracking-tight sm:text-4xl">
                                    {formatMoney(wallet.historical_consumed)}
                                </div>
                                <div className="rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
                                    {t('portal.dashboard.historicalHint')}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[24px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5 sm:rounded-[28px]">
                            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <CreditCard className="h-4 w-4 text-primary" />
                                    {t('portal.dashboard.rechargeTitle')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-4 pt-2 sm:space-y-4 sm:p-6 sm:pt-3">
                                <p className="text-sm leading-6 text-muted-foreground sm:min-h-16">
                                    {t('portal.dashboard.rechargeDescription')}
                                </p>
                                <div className="space-y-2">
                                    <Label htmlFor="recharge-amount">{t('portal.dashboard.rechargeAmount')}</Label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
                                        <Input
                                            id="recharge-amount"
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            value={rechargeAmount}
                                            onChange={(event) => setRechargeAmount(event.target.value)}
                                            className="h-11 rounded-2xl pl-7 font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="payment-type">{t('portal.dashboard.paymentMethod')}</Label>
                                    <Select value={paymentType} onValueChange={setPaymentType}>
                                        <SelectTrigger id="payment-type" className="h-11 rounded-2xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="alipay">{t('portal.dashboard.alipay')}</SelectItem>
                                            <SelectItem value="wxpay">{t('portal.dashboard.wxpay')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    disabled={rechargeMutation.isPending}
                                    onClick={startRecharge}
                                    className="w-full rounded-2xl"
                                >
                                    {rechargeMutation.isPending
                                        ? t('portal.dashboard.recharging')
                                        : t('portal.dashboard.rechargeNow')}
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
            </section>

            <Card className="rounded-[24px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5 sm:rounded-[28px]">
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>{t('portal.logs.rechargeList')}</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    <div className="px-4 pb-4 sm:px-6 sm:pb-5">
                        <div className="space-y-3 md:hidden">
                            {isWalletLogLoading ? (
                                Array.from({ length: 3 }).map((_, index) => (
                                    <Skeleton key={index} className="h-28 rounded-2xl" />
                                ))
                            ) : walletLogs.length > 0 ? (
                                walletLogs.map((log) => (
                                    <div key={log.id} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-xs text-muted-foreground">{t('portal.logs.amount')}</div>
                                                <div className="font-mono text-lg font-semibold">{formatMoney(log.amount)}</div>
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                {formatDateTime(log.created_at)}
                                            </div>
                                        </div>
                                        <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
                                            {formatMoney(log.balance_before)} → {formatMoney(log.balance_after)}
                                        </div>
                                        {log.remark && (
                                            <div className="mt-3 break-words text-sm text-muted-foreground">{log.remark}</div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                                    {t('table.noData')}
                                </div>
                            )}
                        </div>
                        <div className="hidden md:block">
                        <DataTable
                            table={walletLogTable}
                            columns={walletLogColumns}
                            isLoading={isWalletLogLoading}
                            loadingStyle="skeleton"
                            fixedHeader={true}
                            showScrollShadows={false}
                        />
                        </div>
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
