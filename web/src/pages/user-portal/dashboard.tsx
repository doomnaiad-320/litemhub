import { format } from 'date-fns'
import {
    BadgePercent,
    Bell,
    Check,
    ChevronDown,
    CircleHelp,
    Copy,
    CreditCard,
    ExternalLink,
    QrCode,
    ReceiptText,
    Smartphone,
    Tag,
    Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import type { UserPortalRechargeLog } from '@/types/user-portal'
import {
    useUserPortalDuluPayRecharge,
    useUserPortalRechargeLogs,
    useUserPortalWallet,
} from '@/feature/user-portal/hooks'

const presetAmounts = [10, 50, 100, 500, 1000, 5000]

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

const getRechargeStatusClassName = (status: string) => {
    switch (status) {
        case 'success':
            return 'border-[#d8f3df] bg-[#f2fbf4] text-[#2f7d46] dark:border-[#69b37c]/30 dark:bg-[#69b37c]/10 dark:text-[#9dd8aa]'
        case 'failed':
            return 'border-[#f3d8d8] bg-[#fff5f5] text-[#a14343] dark:border-[#d47777]/30 dark:bg-[#d47777]/10 dark:text-[#f0aaaa]'
        default:
            return 'border-[#f2dfc6] bg-[#fff8ed] text-[#a76b1d] dark:border-[#d5a15a]/30 dark:bg-[#d5a15a]/10 dark:text-[#edc384]'
    }
}

export default function UserPortalDashboardPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: walletData, isLoading } = useUserPortalWallet(true)
    const [rechargeLogPage, setRechargeLogPage] = useState(1)
    const [rechargeLogPageSize, setRechargeLogPageSize] = useState(20)
    const [rechargeAmount, setRechargeAmount] = useState('10')
    const [discountCode, setDiscountCode] = useState('')
    const [paymentType, setPaymentType] = useState('alipay')
    const { data: rechargeLogData, isLoading: isRechargeLogLoading } = useUserPortalRechargeLogs(
        rechargeLogPage,
        rechargeLogPageSize,
        true,
    )
    const rechargeMutation = useUserPortalDuluPayRecharge()

    const wallet = walletData?.wallet
    const rechargeLogs = rechargeLogData?.recharge_logs || []
    const rechargeLogTotal = rechargeLogData?.total || 0
    const totalBalance = (wallet?.available_balance || 0) + (wallet?.frozen_balance || 0)
    const selectedAmount = Number(rechargeAmount)
    const hasCustomAmount = Number.isFinite(selectedAmount) && !presetAmounts.includes(selectedAmount)

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

    const paymentTypeLabel = (type?: string) => {
        switch (type) {
            case 'wxpay':
                return t('portal.dashboard.wxpay')
            case 'alipay':
                return t('portal.dashboard.alipay')
            default:
                return type || '-'
        }
    }

    const statusLabel = (status: string) => {
        switch (status) {
            case 'success':
                return t('portal.dashboard.statusSuccess')
            case 'failed':
                return t('portal.dashboard.statusFailed')
            default:
                return t('portal.dashboard.statusUnpaid')
        }
    }

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

    const rechargeLogColumns: ColumnDef<UserPortalRechargeLog>[] = useMemo(() => [
        {
            accessorKey: 'trade_no',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.orderNo')}</div>,
            cell: ({ row }) => (
                <div className="flex max-w-[240px] items-center gap-2">
                    <span className="truncate font-mono text-xs text-[#45515e] dark:text-white/70">
                        {row.original.trade_no || '-'}
                    </span>
                    {row.original.trade_no && (
                        <button
                            type="button"
                            className="text-[#8e8e93] transition-colors hover:text-[#18181b] dark:hover:text-white"
                            onClick={() => {
                                navigator.clipboard.writeText(row.original.trade_no || '')
                                toast.success(t('portal.dashboard.orderCopied'))
                            }}
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'pay_type',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.paymentMethod')}</div>,
            cell: ({ row }) => <div className="text-sm text-[#45515e] dark:text-white/70">{paymentTypeLabel(row.original.pay_type)}</div>,
        },
        {
            accessorKey: 'amount',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.rechargeAmount')}</div>,
            cell: ({ row }) => <div className="font-mono text-sm text-[#18181b] dark:text-white">{formatMoney(row.original.amount)}</div>,
        },
        {
            accessorKey: 'pay_amount',
            header: () => <div className="py-3.5 font-medium">{t('portal.dashboard.payAmount')}</div>,
            cell: ({ row }) => <div className="font-mono text-sm text-[#18181b] dark:text-white">{formatMoney(row.original.pay_amount ?? row.original.amount)}</div>,
        },
        {
            accessorKey: 'status',
            header: () => <div className="py-3.5 font-medium">{t('portal.logs.status')}</div>,
            cell: ({ row }) => (
                <Badge className={`rounded-full px-2.5 py-1 text-xs font-medium shadow-none ${getRechargeStatusClassName(row.original.status)}`}>
                    {statusLabel(row.original.status)}
                </Badge>
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

    const rechargeLogTable = useReactTable({
        data: rechargeLogs,
        columns: rechargeLogColumns,
        getCoreRowModel: getCoreRowModel(),
    })

    const balanceItems = wallet
        ? [
            { label: t('portal.dashboard.frozen'), value: formatMoney(wallet.frozen_balance) },
            { label: t('portal.dashboard.total'), value: formatMoney(totalBalance) },
            { label: t('portal.dashboard.historicalConsumed'), value: formatMoney(wallet.historical_consumed) },
        ]
        : []

    const paymentMethods = [
        {
            value: 'alipay',
            label: t('portal.dashboard.alipay'),
            description: t('portal.dashboard.paymentMethodHint'),
            icon: QrCode,
            disabled: false,
        },
        {
            value: 'wxpay',
            label: t('portal.dashboard.wxpay'),
            description: t('portal.dashboard.paymentMethodHint'),
            icon: Smartphone,
            disabled: false,
        },
        {
            value: 'crypto',
            label: 'Crypto',
            description: t('portal.dashboard.minimumAmount', { amount: '$15.00' }),
            icon: BadgePercent,
            disabled: true,
        },
        {
            value: 'paypal',
            label: 'PayPal',
            description: t('portal.dashboard.paymentMethodHint'),
            icon: CreditCard,
            disabled: true,
        },
    ]

    return (
        <div className="space-y-6 font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white">
            <header>
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[28px] font-semibold leading-tight tracking-tight text-[#18181b] dark:text-white">
                    {t('portal.dashboard.billingTitle')}
                </h1>
                <p className="mt-1 text-sm leading-[1.6] text-[#5f5f5f] dark:text-white/60">
                    {t('portal.dashboard.billingDescription')}
                </p>
            </header>

            <section className="rounded-lg border border-[#e5e7eb] bg-background p-5 shadow-none dark:border-white/10">
                {isLoading || !wallet ? (
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 rounded-md" />
                            <Skeleton className="h-8 w-32 rounded-md" />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#e9f4ef] text-[#6f9d8d] dark:bg-[#6f9d8d]/15 dark:text-[#9bc3b5]">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-[#8e8e93]">{t('portal.dashboard.available')}</div>
                                <div className="mt-1 truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-[30px] font-semibold leading-none text-[#18181b] dark:text-white">
                                    {formatMoney(wallet.available_balance)}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 border-t border-[#f2f3f5] pt-4 dark:border-white/10 sm:grid-cols-3 lg:min-w-[520px] lg:border-t-0 lg:pt-0">
                            {balanceItems.map((item) => (
                                <div key={item.label} className="min-w-0 lg:border-l lg:border-[#f2f3f5] lg:pl-5 lg:dark:border-white/10">
                                    <div className="text-xs font-medium text-[#8e8e93]">{item.label}</div>
                                    <div className="mt-1 truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold leading-tight text-[#18181b] dark:text-white">
                                        {item.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-fit rounded-md border-[#e5e7eb] bg-background text-xs text-[#45515e] shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10 dark:text-white/70"
                        >
                            <Bell className="h-3.5 w-3.5" />
                            {t('portal.dashboard.notify')}
                        </Button>
                    </div>
                )}
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_292px]">
                <div className="space-y-5">
                    <section className="rounded-lg border border-[#e5e7eb] bg-background p-5 shadow-none dark:border-white/10 sm:p-6">
                        <div>
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">
                                {t('portal.dashboard.packageTitle')}
                            </h2>
                            <p className="mt-1 text-sm text-[#8e8e93]">
                                {t('portal.dashboard.packageDescription')}
                            </p>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {presetAmounts.map((amount) => {
                                const selected = Number(rechargeAmount) === amount
                                return (
                                    <button
                                        key={amount}
                                        type="button"
                                        onClick={() => setRechargeAmount(String(amount))}
                                        className={
                                            selected
                                                ? 'min-h-[72px] rounded-md border border-[#6f9d8d] bg-[#eef6f3] p-4 text-left transition-colors dark:border-[#9bc3b5] dark:bg-[#6f9d8d]/15'
                                                : 'min-h-[72px] rounded-md border border-[#e5e7eb] bg-background p-4 text-left transition-colors hover:border-[#8e8e93] hover:bg-[#fafafa] dark:border-white/10 dark:hover:border-white/30 dark:hover:bg-white/[0.03]'
                                        }
                                    >
                                        <div className="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-xl font-semibold leading-tight text-[#18181b] dark:text-white">
                                            {formatMoney(amount)}
                                        </div>
                                        <div className="mt-2 text-xs leading-[1.5] text-[#8e8e93]">
                                            {t('portal.dashboard.packageHint')}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="space-y-2">
                                <Label htmlFor="recharge-amount" className="text-xs font-semibold text-[#18181b] dark:text-white">
                                    {t('portal.dashboard.customAmount')}
                                </Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#8e8e93]">$</span>
                                    <Input
                                        id="recharge-amount"
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={rechargeAmount}
                                        onChange={(event) => setRechargeAmount(event.target.value)}
                                        className="h-11 rounded-md border-[#e5e7eb] bg-background pl-9 font-mono text-sm shadow-none focus-visible:border-[#6f9d8d] focus-visible:ring-[#6f9d8d]/20 dark:border-white/10"
                                    />
                                </div>
                                <p className="text-xs text-[#8e8e93]">{t('portal.dashboard.minimumAmount', { amount: '$1.00' })}</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="discount-code" className="text-xs font-semibold text-[#18181b] dark:text-white">
                                    {t('portal.dashboard.discountCode')}
                                </Label>
                                <div className="flex gap-2">
                                    <div className="relative min-w-0 flex-1">
                                        <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
                                        <Input
                                            id="discount-code"
                                            value={discountCode}
                                            onChange={(event) => setDiscountCode(event.target.value)}
                                            placeholder={t('portal.dashboard.discountCodePlaceholder')}
                                            className="h-11 rounded-md border-[#e5e7eb] bg-background pl-10 text-sm shadow-none focus-visible:border-[#6f9d8d] focus-visible:ring-[#6f9d8d]/20 dark:border-white/10"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 rounded-md border-[#e5e7eb] bg-background px-4 text-xs shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10"
                                    >
                                        {t('portal.dashboard.verify')}
                                    </Button>
                                </div>
                                <p className="text-xs text-[#8e8e93]">{t('portal.dashboard.discountCodeHelp')}</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-lg border border-[#e5e7eb] bg-background p-5 shadow-none dark:border-white/10 sm:p-6">
                        <div>
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">
                                {t('portal.dashboard.selectPaymentMethod')}
                            </h2>
                            <p className="mt-1 text-sm text-[#8e8e93]">
                                {t('portal.dashboard.paymentDescription')}
                            </p>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {paymentMethods.map((method) => {
                                const Icon = method.icon
                                const active = paymentType === method.value
                                return (
                                    <button
                                        key={method.value}
                                        type="button"
                                        disabled={method.disabled}
                                        onClick={() => setPaymentType(method.value)}
                                        className={
                                            active
                                                ? 'flex min-h-[64px] items-center gap-3 rounded-md border border-[#6f9d8d] bg-[#eef6f3] p-4 text-left transition-colors dark:border-[#9bc3b5] dark:bg-[#6f9d8d]/15'
                                                : 'flex min-h-[64px] items-center gap-3 rounded-md border border-[#e5e7eb] bg-background p-4 text-left transition-colors hover:border-[#8e8e93] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:hover:border-white/30 dark:hover:bg-white/[0.03]'
                                        }
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#f2f3f5] bg-background text-[#8e8e93] dark:border-white/10">
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-[#18181b] dark:text-white">{method.label}</span>
                                            <span className="mt-1 block truncate text-xs text-[#8e8e93]">{method.description}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-5 flex flex-col gap-3 border-t border-[#f2f3f5] pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-[#5f5f5f] dark:text-white/60">
                                <span>{t('portal.dashboard.rechargeAmount')}: </span>
                                <span className="font-mono font-semibold text-[#18181b] dark:text-white">
                                    {Number.isFinite(selectedAmount) && selectedAmount > 0 ? formatMoney(selectedAmount) : '-'}
                                </span>
                                {hasCustomAmount && (
                                    <span className="ml-2 text-xs text-[#8e8e93]">{t('portal.dashboard.customAmountTag')}</span>
                                )}
                            </div>

                            <Button
                                disabled={rechargeMutation.isPending}
                                onClick={startRecharge}
                                className="h-11 rounded-md bg-[#181e25] px-6 text-white shadow-none hover:bg-[#111827] dark:bg-white dark:text-[#181e25] sm:min-w-[180px]"
                            >
                                {rechargeMutation.isPending
                                    ? t('portal.dashboard.recharging')
                                    : t('portal.dashboard.rechargeNow')}
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    </section>
                </div>

                <aside className="space-y-5">
                    <section className="rounded-lg border border-[#e5e7eb] bg-background p-5 shadow-none dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <BadgePercent className="h-4 w-4 text-[#18181b] dark:text-white" />
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-base font-semibold text-[#18181b] dark:text-white">
                                {t('portal.dashboard.voucherTitle')}
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-[#8e8e93]">{t('portal.dashboard.voucherDescription')}</p>
                        <div className="mt-4 flex gap-2">
                            <Input
                                value={discountCode}
                                onChange={(event) => setDiscountCode(event.target.value)}
                                placeholder={t('portal.dashboard.voucherPlaceholder')}
                                className="h-9 rounded-md border-[#e5e7eb] bg-background text-sm shadow-none dark:border-white/10"
                            />
                            <Button
                                type="button"
                                disabled={!discountCode.trim()}
                                className="h-9 rounded-md bg-[#8fb6a7] px-4 text-xs text-white shadow-none hover:bg-[#7aa495]"
                            >
                                <Check className="h-3.5 w-3.5" />
                                {t('portal.dashboard.redeem')}
                            </Button>
                        </div>
                        <p className="mt-3 text-xs leading-[1.6] text-[#8e8e93]">{t('portal.dashboard.voucherHelp')}</p>
                    </section>

                    <section className="rounded-lg border border-[#e5e7eb] bg-background p-5 shadow-none dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <CircleHelp className="h-4 w-4 text-[#18181b] dark:text-white" />
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-base font-semibold text-[#18181b] dark:text-white">
                                {t('portal.dashboard.faqTitle')}
                            </h2>
                        </div>
                        <div className="mt-3 divide-y divide-[#f2f3f5] dark:divide-white/10">
                            {[
                                t('portal.dashboard.faqModels'),
                                t('portal.dashboard.faqValidity'),
                                t('portal.dashboard.faqDiscount'),
                                t('portal.dashboard.faqAnnouncements'),
                            ].map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-[#45515e] transition-colors hover:text-[#18181b] dark:text-white/70 dark:hover:text-white"
                                >
                                    <span>{item}</span>
                                    <ChevronDown className="h-4 w-4 shrink-0 text-[#8e8e93]" />
                                </button>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

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
                        {isRechargeLogLoading ? (
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
                                                <span className="truncate">{log.trade_no || '-'}</span>
                                            </div>
                                            <div className="mt-2 text-xs text-[#8e8e93]">{paymentTypeLabel(log.pay_type)}</div>
                                        </div>
                                        <Badge className={`rounded-full px-2.5 py-1 text-xs font-medium shadow-none ${getRechargeStatusClassName(log.status)}`}>
                                            {statusLabel(log.status)}
                                        </Badge>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <div className="text-xs text-[#8e8e93]">{t('portal.dashboard.rechargeAmount')}</div>
                                            <div className="mt-1 font-mono font-semibold text-[#18181b] dark:text-white">{formatMoney(log.amount)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[#8e8e93]">{t('portal.dashboard.payAmount')}</div>
                                            <div className="mt-1 font-mono font-semibold text-[#18181b] dark:text-white">{formatMoney(log.pay_amount ?? log.amount)}</div>
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
                            isLoading={isRechargeLogLoading}
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
