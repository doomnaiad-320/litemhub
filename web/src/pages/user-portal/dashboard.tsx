import {
    BadgePercent,
    Bell,
    ChevronDown,
    CircleHelp,
    CreditCard,
    ExternalLink,
    QrCode,
    Smartphone,
    Tag,
    Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
    useUserPortalDuluPayRecharge,
    useUserPortalWallet,
} from '@/feature/user-portal/hooks'

const presetAmounts = [10, 50, 100, 500, 1000, 5000]
const normalizeDiscountCodeInput = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)

const formatMoney = (amount?: number) => `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`

export default function UserPortalDashboardPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: walletData, isLoading } = useUserPortalWallet(true)
    const [rechargeAmount, setRechargeAmount] = useState('10')
    const [discountCode, setDiscountCode] = useState('')
    const [paymentType, setPaymentType] = useState('alipay')
    const rechargeMutation = useUserPortalDuluPayRecharge()

    const wallet = walletData?.wallet
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

    const startRecharge = async () => {
        const amount = Number(rechargeAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error(t('portal.dashboard.amountInvalid'))
            return
        }

        const response = await rechargeMutation.mutateAsync({
            amount,
            type: paymentType,
            discount_code: normalizeDiscountCodeInput(discountCode) || undefined,
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
        <div className="w-full max-w-[1120px] space-y-6 font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white">
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
                                            onChange={(event) => setDiscountCode(normalizeDiscountCodeInput(event.target.value))}
                                            maxLength={6}
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
        </div>
    )
}
