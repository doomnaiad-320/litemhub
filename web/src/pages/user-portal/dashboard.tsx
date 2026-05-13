import { format } from 'date-fns'
import { CreditCard, ExternalLink } from 'lucide-react'
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    const account = user?.email || `#${user?.id ?? ''}`
    const totalBalance = (wallet?.available_balance || 0) + (wallet?.frozen_balance || 0)

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

    const metricItems = wallet
        ? [
            { label: t('portal.dashboard.available'), value: formatMoney(wallet.available_balance) },
            { label: t('portal.dashboard.frozen'), value: formatMoney(wallet.frozen_balance) },
            { label: t('portal.dashboard.total'), value: formatMoney(totalBalance) },
            { label: t('portal.dashboard.historicalConsumed'), value: formatMoney(wallet.historical_consumed) },
        ]
        : []

    return (
        <div className="font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white">
            <Card className="overflow-hidden rounded-[24px] border-0 bg-white shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:ring-white/10">
                <CardHeader className="border-b border-[#f2f3f5] p-5 dark:border-white/10 sm:p-6">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div>
                            <div className="text-sm font-medium text-[#1456f0] dark:text-[#60a5fa]">
                                {t('portal.dashboard.welcome')}
                            </div>
                            <h1 className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold leading-[1.5] tracking-tight text-[#222222] dark:text-white sm:text-[31px]">
                                {t('portal.dashboard.title')}
                            </h1>
                            <p className="mt-1 max-w-2xl text-sm leading-[1.7] text-[#45515e] dark:text-white/70">
                                {t('portal.dashboard.description')}
                            </p>
                        </div>
                        <div className="inline-flex max-w-full rounded-full bg-[#f7f7f7] px-3 py-1.5 text-xs font-medium text-[#45515e] ring-1 ring-[#f2f3f5] dark:bg-white/10 dark:text-white/70 dark:ring-white/10">
                            <span className="shrink-0">{t('portal.dashboard.currentAccount')}:</span>
                            <span className="ml-1 truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif]">{account}</span>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-x-6 gap-y-3 border-t border-[#f2f3f5] pt-4 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
                        {isLoading || !wallet ? (
                            Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-10 rounded-[12px]" />
                            ))
                        ) : (
                            metricItems.map((item) => (
                                <div key={item.label} className="min-w-0">
                                    <div className="text-xs font-medium text-[#8e8e93]">{item.label}</div>
                                    <div className="mt-1 truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-base font-semibold text-[#18181b] dark:text-white">
                                        {item.value}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <section className="border-b border-[#f2f3f5] p-5 dark:border-white/10 sm:p-6">
                        <div className="flex items-center gap-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">
                            <CreditCard className="h-4 w-4 text-[#1456f0] dark:text-[#60a5fa]" />
                            {t('portal.dashboard.rechargeTitle')}
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-[1.7] text-[#45515e] dark:text-white/70">
                            {t('portal.dashboard.rechargeDescription')}
                        </p>

                        {isLoading || !wallet ? (
                            <Skeleton className="mt-6 h-24 rounded-[16px]" />
                        ) : (
                            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_280px_180px] lg:items-end">
                                <div className="space-y-2">
                                    <Label htmlFor="recharge-amount" className="text-xs font-semibold text-[#5f5f5f] dark:text-white/60">
                                        {t('portal.dashboard.rechargeAmount')}
                                    </Label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-base font-semibold text-[#8e8e93]">$</span>
                                        <Input
                                            id="recharge-amount"
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            value={rechargeAmount}
                                            onChange={(event) => setRechargeAmount(event.target.value)}
                                            className="h-14 rounded-[14px] border-[#e5e7eb] bg-white pl-9 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-xl font-semibold shadow-none focus-visible:ring-[#1456f0] dark:border-white/10 dark:bg-white/10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-[#5f5f5f] dark:text-white/60">
                                        {t('portal.dashboard.paymentMethod')}
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'alipay', label: t('portal.dashboard.alipay') },
                                            { value: 'wxpay', label: t('portal.dashboard.wxpay') },
                                        ].map((item) => (
                                            <button
                                                key={item.value}
                                                type="button"
                                                onClick={() => setPaymentType(item.value)}
                                                className={
                                                    paymentType === item.value
                                                        ? 'h-14 rounded-[14px] border border-[#18181b] bg-white text-sm font-semibold text-[#18181b] dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'h-14 rounded-[14px] border border-[#e5e7eb] bg-white text-sm font-semibold text-[#45515e] transition hover:border-[#18181b] hover:text-[#18181b] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:border-white dark:hover:text-white'
                                                }
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <Button
                                    disabled={rechargeMutation.isPending}
                                    onClick={startRecharge}
                                    className="h-14 rounded-[14px] bg-[#181e25] text-white shadow-none hover:bg-[#111827] dark:bg-white dark:text-[#181e25]"
                                >
                                    {rechargeMutation.isPending
                                        ? t('portal.dashboard.recharging')
                                        : t('portal.dashboard.rechargeNow')}
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </section>
                </CardContent>

                <div className="border-t border-[#f2f3f5] dark:border-white/10">
                <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                    <div>
                        <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">
                            {t('portal.logs.rechargeList')}
                        </h2>
                    </div>
                    <div className="inline-flex w-fit rounded-full bg-[#f7f7f7] px-3 py-1 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-xs font-semibold text-[#45515e] ring-1 ring-[#f2f3f5] dark:bg-white/10 dark:text-white/70 dark:ring-white/10">
                        {walletLogTotal}
                    </div>
                </div>
                <div className="px-0 pb-0">
                    <div className="px-4 pb-3 sm:px-6 sm:pb-4">
                        <div className="space-y-3 md:hidden">
                            {isWalletLogLoading ? (
                                Array.from({ length: 3 }).map((_, index) => (
                                    <Skeleton key={index} className="h-28 rounded-2xl" />
                                ))
                            ) : walletLogs.length > 0 ? (
                                walletLogs.map((log) => (
                                    <div key={log.id} className="border-b border-[#f2f3f5] py-4 last:border-b-0 dark:border-white/10">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-xs text-[#8e8e93]">{t('portal.logs.amount')}</div>
                                                <div className="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">{formatMoney(log.amount)}</div>
                                            </div>
                                            <div className="text-right text-xs text-[#8e8e93]">
                                                {formatDateTime(log.created_at)}
                                            </div>
                                        </div>
                                        <div className="mt-3 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-xs font-medium text-[#45515e] dark:text-white/70">
                                            {formatMoney(log.balance_before)} → {formatMoney(log.balance_after)}
                                        </div>
                                        {log.remark && (
                                            <div className="mt-3 break-words text-sm leading-[1.7] text-[#45515e] dark:text-white/70">{log.remark}</div>
                                        )}
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
                                table={walletLogTable}
                                columns={walletLogColumns}
                                isLoading={isWalletLogLoading}
                                loadingStyle="skeleton"
                                fixedHeader={true}
                                showScrollShadows={false}
                            />
                        </div>
                    </div>
                    <div className="border-t border-[#f2f3f5] px-3 dark:border-white/10">
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
                </div>
                </div>
            </Card>
        </div>
    )
}
