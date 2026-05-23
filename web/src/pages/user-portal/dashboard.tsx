import {
    BadgePercent,
    CreditCard,
    ExternalLink,
    QrCode,
    Smartphone,
    Tag,
    Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
    useUserPortalBillingSettings,
    useUserPortalDuluPayRecharge,
    useUserPortalWallet,
} from '@/feature/user-portal/hooks'
import { UserPortalWalletLogHistory } from '@/feature/user-portal/components/UserPortalWalletLogHistory'

const presetAmounts = [10, 50, 100, 500, 1000, 5000]
const normalizeDiscountCodeInput = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
const normalizeDiscount = (value?: number) => (value && value > 0 && value <= 1 ? value : 1)
const normalizeDiscountRatio = (value?: number) => (value !== undefined && value >= 0 && value < 1 ? value : 0)
const roundMoney = (value: number) => Math.round(value * 100) / 100

const formatMoney = (amount?: number) => `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`

export default function UserPortalDashboardPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const queryClient = useQueryClient()
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: walletData, isLoading } = useUserPortalWallet(true)
    const [rechargeAmount, setRechargeAmount] = useState('10')
    const [discountCode, setDiscountCode] = useState('')
    const [paymentType, setPaymentType] = useState('alipay')
    const [pullDistance, setPullDistance] = useState(0)
    const [isPullRefreshing, setIsPullRefreshing] = useState(false)
    const pullStartYRef = useRef<number | null>(null)
    const pullDistanceRef = useRef(0)
    const rechargeMutation = useUserPortalDuluPayRecharge()
    const { data: billingSettingsData } = useUserPortalBillingSettings(true)

    const wallet = walletData?.wallet
    const totalBalance = (wallet?.available_balance || 0) + (wallet?.frozen_balance || 0)
    const selectedAmount = Number(rechargeAmount)
    const hasCustomAmount = Number.isFinite(selectedAmount) && !presetAmounts.includes(selectedAmount)
    const normalizedDiscountCode = normalizeDiscountCodeInput(discountCode)
    const rechargeDiscount = normalizeDiscount(billingSettingsData?.settings.recharge_discount)
    const discountCodeDiscount = normalizedDiscountCode
        ? normalizeDiscountRatio(billingSettingsData?.settings.discount_code_discount)
        : 0
    const effectiveDiscount = rechargeDiscount * (1 - discountCodeDiscount)
    const estimatedPayAmount = Number.isFinite(selectedAmount) && selectedAmount > 0
        ? roundMoney(selectedAmount * effectiveDiscount)
        : undefined
    const hasDiscount = estimatedPayAmount !== undefined && estimatedPayAmount < selectedAmount

    const refreshPage = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['userPortalWallet'] }),
            queryClient.resetQueries({ queryKey: ['userPortalWalletLogs'] }),
            queryClient.invalidateQueries({ queryKey: ['userPortalRechargeLogs'] }),
        ])
    }, [queryClient])

    const updatePullDistance = (distance: number) => {
        pullDistanceRef.current = distance
        setPullDistance(distance)
    }

    const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        if (window.matchMedia('(min-width: 640px)').matches || window.scrollY > 0 || isPullRefreshing) {
            return
        }

        pullStartYRef.current = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
        if (pullStartYRef.current === null || window.scrollY > 0) {
            return
        }

        const currentY = event.touches[0]?.clientY ?? pullStartYRef.current
        const distance = currentY - pullStartYRef.current

        if (distance <= 0) {
            updatePullDistance(0)
            return
        }

        updatePullDistance(Math.min(distance * 0.45, 72))
    }

    const handleTouchEnd = () => {
        const shouldRefresh = pullDistanceRef.current >= 64
        pullStartYRef.current = null

        if (!shouldRefresh) {
            updatePullDistance(0)
            return
        }

        setIsPullRefreshing(true)
        void refreshPage().finally(() => {
            updatePullDistance(0)
            setIsPullRefreshing(false)
        })
    }

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
            discount_code: normalizedDiscountCode || undefined,
        })
        const payment = response.payment
        if (payment.pay_type === 'jump' || payment.pay_type === 'urlscheme') {
            window.location.href = payment.pay_info
            return
        }

        window.open(payment.pay_info, '_blank', 'noopener,noreferrer')
    }

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
        <div
            className="mx-auto w-full max-w-[1120px] space-y-4 font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white sm:space-y-6"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            <div
                className="flex items-center justify-center overflow-hidden text-[11px] text-muted-foreground transition-[height] duration-200 sm:hidden"
                style={{ height: isPullRefreshing ? 64 : pullDistance }}
            >
                {isPullRefreshing ? t('portal.dashboard.pullToRefreshRefreshing') : t('portal.dashboard.pullToRefresh')}
            </div>

            <header>
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[24px] font-semibold leading-tight tracking-tight text-[#18181b] dark:text-white sm:text-[28px]">
                    {t('portal.dashboard.billingTitle')}
                </h1>
                <p className="mt-1 text-xs leading-[1.5] text-[#5f5f5f] dark:text-white/60 sm:text-sm sm:leading-[1.6]">
                    {t('portal.dashboard.billingDescription')}
                </p>
            </header>

            <section className="rounded-lg border border-[#e5e7eb] bg-background p-3 shadow-none dark:border-white/10 sm:p-5">
                {isLoading || !wallet ? (
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 rounded-md" />
                            <Skeleton className="h-8 w-32 rounded-md" />
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-center lg:gap-5">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e9f4ef] text-[#6f9d8d] dark:bg-[#6f9d8d]/15 dark:text-[#9bc3b5] sm:h-12 sm:w-12">
                                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-[#8e8e93]">{t('portal.dashboard.available')}</div>
                                <div className="mt-1 truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-[24px] font-semibold leading-none text-[#18181b] dark:text-white sm:text-[30px] lg:text-[34px]">
                                    {formatMoney(wallet.available_balance)}
                                </div>
                            </div>
                        </div>

                        <div className="grid w-full grid-cols-3 gap-2 border-t border-[#f2f3f5] pt-3 dark:border-white/10 sm:gap-4 lg:border-t-0 lg:pt-0">
                            {balanceItems.map((item) => (
                                <div key={item.label} className="min-w-0 text-center lg:border-l lg:border-[#f2f3f5] lg:pl-5 lg:text-left lg:dark:border-white/10">
                                    <div className="truncate text-[11px] font-medium text-[#8e8e93] sm:text-xs">{item.label}</div>
                                    <div className="mt-1 truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-sm font-semibold leading-tight text-[#18181b] dark:text-white sm:text-lg">
                                        {item.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <div className="space-y-4 sm:space-y-5">
                <div className="space-y-4 sm:space-y-5">
                    <section className="rounded-lg border border-[#e5e7eb] bg-background p-3 shadow-none dark:border-white/10 sm:p-6">
                        <div>
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-base font-semibold text-[#18181b] dark:text-white sm:text-lg">
                                {t('portal.dashboard.packageTitle')}
                            </h2>
                            <p className="mt-1 text-xs text-[#8e8e93] sm:text-sm">
                                {t('portal.dashboard.packageDescription')}
                            </p>
                        </div>

                        {/*
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {presetAmounts.map((amount) => {
                                const selected = Number(rechargeAmount) === amount
                                return (
                                    <button
                                        key={amount}
                                        type="button"
                                        onClick={() => setRechargeAmount(String(amount))}
                                        className={
                                            selected
                                                ? 'min-h-[56px] rounded-md border border-[#6f9d8d] bg-[#eef6f3] p-3 text-left transition-colors dark:border-[#9bc3b5] dark:bg-[#6f9d8d]/15 sm:min-h-[72px] sm:p-4'
                                                : 'min-h-[56px] rounded-md border border-[#e5e7eb] bg-background p-3 text-left transition-colors hover:border-[#8e8e93] hover:bg-[#fafafa] dark:border-white/10 dark:hover:border-white/30 dark:hover:bg-white/[0.03] sm:min-h-[72px] sm:p-4'
                                        }
                                    >
                                        <div className="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold leading-tight text-[#18181b] dark:text-white sm:text-xl">
                                            {formatMoney(amount)}
                                        </div>
                                        <div className="mt-1 text-[11px] leading-[1.4] text-[#8e8e93] sm:mt-2 sm:text-xs sm:leading-[1.5]">
                                            {t('portal.dashboard.packageHint')}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                        */}

                        <div className="mt-3 grid gap-3 sm:mt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
                                        className="h-10 rounded-md border-[#e5e7eb] bg-background pl-9 font-mono text-sm shadow-none focus-visible:border-[#6f9d8d] focus-visible:ring-[#6f9d8d]/20 dark:border-white/10 sm:h-11"
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
                                            onChange={(event) => setDiscountCode(normalizeDiscountCodeInput(event.target.value))}
                                            maxLength={6}
                                            placeholder={t('portal.dashboard.discountCodePlaceholder')}
                                            className="h-10 rounded-md border-[#e5e7eb] bg-background pl-10 text-sm shadow-none focus-visible:border-[#6f9d8d] focus-visible:ring-[#6f9d8d]/20 dark:border-white/10 sm:h-11"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 rounded-md border-[#e5e7eb] bg-background px-3 text-xs shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10 sm:h-11 sm:px-4"
                                    >
                                        {t('portal.dashboard.verify')}
                                    </Button>
                                </div>
                                <p className="text-xs text-[#8e8e93]">
                                    {normalizedDiscountCode
                                        ? t('portal.dashboard.discountCodeEstimate', {
                                            percent: Math.round(discountCodeDiscount * 10000) / 100,
                                        })
                                        : t('portal.dashboard.discountCodeHelp')}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-lg border border-[#e5e7eb] bg-background p-3 shadow-none dark:border-white/10 sm:p-6">
                        <div>
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-base font-semibold text-[#18181b] dark:text-white sm:text-lg">
                                {t('portal.dashboard.selectPaymentMethod')}
                            </h2>
                            <p className="mt-1 text-xs text-[#8e8e93] sm:text-sm">
                                {t('portal.dashboard.paymentDescription')}
                            </p>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                                                ? 'flex min-h-[52px] items-center gap-2 rounded-md border border-[#6f9d8d] bg-[#eef6f3] p-2.5 text-left transition-colors dark:border-[#9bc3b5] dark:bg-[#6f9d8d]/15 sm:min-h-[64px] sm:gap-3 sm:p-4'
                                                : 'flex min-h-[52px] items-center gap-2 rounded-md border border-[#e5e7eb] bg-background p-2.5 text-left transition-colors hover:border-[#8e8e93] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:hover:border-white/30 dark:hover:bg-white/[0.03] sm:min-h-[64px] sm:gap-3 sm:p-4'
                                        }
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#f2f3f5] bg-background text-[#8e8e93] dark:border-white/10 sm:h-9 sm:w-9">
                                            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-[#18181b] dark:text-white">{method.label}</span>
                                            <span className="mt-1 hidden truncate text-xs text-[#8e8e93] sm:block">{method.description}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-4 flex flex-col gap-3 border-t border-[#f2f3f5] pt-4 dark:border-white/10 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
                            <div className="space-y-1 text-xs text-[#5f5f5f] dark:text-white/60 sm:text-sm">
                                <div>
                                    <span>{t('portal.dashboard.rechargeAmount')}: </span>
                                    <span className="font-mono font-semibold text-[#18181b] dark:text-white">
                                        {Number.isFinite(selectedAmount) && selectedAmount > 0 ? formatMoney(selectedAmount) : '-'}
                                    </span>
                                    {hasCustomAmount && (
                                        <span className="ml-2 text-xs text-[#8e8e93]">{t('portal.dashboard.customAmountTag')}</span>
                                    )}
                                </div>
                                <div>
                                    <span>{t('portal.dashboard.payAmount')}: </span>
                                    <span className="font-mono font-semibold text-[#18181b] dark:text-white">
                                        {estimatedPayAmount !== undefined ? formatMoney(estimatedPayAmount) : '-'}
                                    </span>
                                    {hasDiscount && (
                                        <span className="ml-2 text-xs text-[#6f9d8d]">
                                            {t('portal.dashboard.discountApplied')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <Button
                                disabled={rechargeMutation.isPending}
                                onClick={startRecharge}
                                className="h-10 rounded-md bg-[#181e25] px-6 text-white shadow-none hover:bg-[#111827] dark:bg-white dark:text-[#181e25] sm:h-11 sm:min-w-[180px]"
                            >
                                {rechargeMutation.isPending
                                    ? t('portal.dashboard.recharging')
                                    : t('portal.dashboard.rechargeNow')}
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    </section>
                </div>

                {/*
                <aside className="space-y-5">
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
                */}
            </div>

            <div className="space-y-4 sm:space-y-5">
                <UserPortalWalletLogHistory />
            </div>
        </div>
    )
}
