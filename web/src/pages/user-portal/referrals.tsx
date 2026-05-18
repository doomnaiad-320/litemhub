import { useTranslation } from 'react-i18next'
import {
    BadgePercent,
    Copy,
    Gift,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    useGenerateUserPortalDiscountCode,
    useUserPortalDiscountCode,
} from '@/feature/user-portal/hooks'
import { UserPortalWalletLogHistory } from '@/feature/user-portal/components/UserPortalWalletLogHistory'

export default function UserPortalReferralsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const { data: discountCodeData, isLoading: isDiscountCodeLoading } = useUserPortalDiscountCode(true)
    const generateDiscountCodeMutation = useGenerateUserPortalDiscountCode()

    const myDiscountCode = discountCodeData?.discount_code?.code

    const copyMyDiscountCode = async () => {
        if (!myDiscountCode) return

        await navigator.clipboard.writeText(myDiscountCode)
        toast.success(t('portal.dashboard.myDiscountCodeCopied'))
    }

    return (
        <div className="mx-auto w-full max-w-[1120px] space-y-6 font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white">
            <header>
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[28px] font-semibold leading-tight tracking-tight text-[#18181b] dark:text-white">
                    {t('portal.referrals.title')}
                </h1>
                <p className="mt-1 text-sm leading-[1.6] text-[#5f5f5f] dark:text-white/60">
                    {t('portal.referrals.description')}
                </p>
            </header>

            <section className="rounded-lg border border-[#e5e7eb] bg-background p-5 shadow-none dark:border-white/10 sm:p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#eef6f3] text-[#6f9d8d] dark:bg-[#6f9d8d]/15 dark:text-[#9bc3b5]">
                        <Gift className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <BadgePercent className="h-4 w-4 text-[#18181b] dark:text-white" />
                            <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">
                                {t('portal.dashboard.myDiscountCodeTitle')}
                            </h2>
                        </div>
                        <p className="mt-1 text-sm leading-[1.6] text-[#8e8e93]">{t('portal.dashboard.myDiscountCodeDescription')}</p>

                        <div className="mt-5 max-w-xl border-t border-[#f2f3f5] pt-5 dark:border-white/10">
                            {isDiscountCodeLoading ? (
                                <Skeleton className="h-11 w-full rounded-md" />
                            ) : myDiscountCode ? (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1 rounded-md border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 font-mono text-base font-semibold tracking-[0.08em] text-[#18181b] dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
                                        {myDiscountCode}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={copyMyDiscountCode}
                                        className="h-11 rounded-md border-[#e5e7eb] bg-background px-4 shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10"
                                    >
                                        <Copy className="h-4 w-4" />
                                        {t('portal.referrals.copyCode')}
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={() => generateDiscountCodeMutation.mutate()}
                                    disabled={generateDiscountCodeMutation.isPending}
                                    className="h-11 rounded-md bg-[#181e25] px-5 text-white shadow-none hover:bg-[#111827] dark:bg-white dark:text-[#181e25]"
                                >
                                    {generateDiscountCodeMutation.isPending
                                        ? t('portal.dashboard.generatingDiscountCode')
                                        : t('portal.dashboard.generateDiscountCode')}
                                </Button>
                            )}
                        </div>
                        <p className="mt-3 text-xs leading-[1.6] text-[#8e8e93]">{t('portal.dashboard.myDiscountCodeHelp')}</p>
                    </div>
                </div>
            </section>

            <UserPortalWalletLogHistory />
        </div>
    )
}
