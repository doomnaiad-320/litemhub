import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    useGenerateUserPortalDiscountCode,
    useUserPortalDiscountCode,
    useUserPortalReferralRecords,
} from '@/feature/user-portal/hooks'
import { UserPortalReferralRecordHistory } from '@/feature/user-portal/components/UserPortalReferralRecordHistory'

const formatMoney = (amount?: number) => `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`

export default function UserPortalReferralsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const { data: discountCodeData, isLoading: isDiscountCodeLoading } = useUserPortalDiscountCode(true)
    const { data: referralData, isLoading: isReferralLoading } = useUserPortalReferralRecords(1, 20, true)
    const generateDiscountCodeMutation = useGenerateUserPortalDiscountCode()

    const myDiscountCode = discountCodeData?.discount_code?.code
    const inviteLink = myDiscountCode && typeof window !== 'undefined' ? `${window.location.origin}/r/${myDiscountCode}` : ''
    const referralStats = referralData?.stats

    const copyValueToClipboard = async (value: string, successMessage: string) => {
        if (!value) return

        try {
            await navigator.clipboard.writeText(value)
            toast.success(successMessage)
        } catch {
            toast.error(t('common.copyFailed'))
        }
    }

    const copyMyDiscountCode = () => {
        copyValueToClipboard(myDiscountCode || '', t('portal.referrals.discountCodeCopied'))
    }

    const copyInviteLink = () => {
        copyValueToClipboard(inviteLink, t('portal.referrals.inviteLinkCopied'))
    }

    return (
        <div className="mx-auto w-full max-w-[1120px] space-y-4 font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white sm:space-y-6">
            <section className="rounded-md border border-[#e5e7eb] bg-background p-4 shadow-none dark:border-white/10 sm:p-5">
                <div className="grid grid-cols-2 gap-2 lg:min-w-[280px]">
                    {isReferralLoading ? (
                        Array.from({ length: 2 }).map((_, index) => (
                            <Skeleton key={index} className="h-[76px] rounded-md" />
                        ))
                    ) : (
                        <>
                            <div className="rounded-md border border-[#e5e7eb] bg-background p-3 shadow-none dark:border-white/10">
                                <div className="text-[11px] font-medium text-[#8e8e93]">
                                    {t('portal.referrals.summaryInvitedUsers')}
                                </div>
                                <div className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold leading-none text-[#18181b] dark:text-white">
                                    {referralStats?.invited_user_count || 0}
                                </div>
                            </div>
                            <div className="rounded-md border border-[#e5e7eb] bg-background p-3 shadow-none dark:border-white/10">
                                <div className="text-[11px] font-medium text-[#8e8e93]">
                                    {t('portal.referrals.summaryTotalRebate')}
                                </div>
                                <div className="mt-2 truncate font-mono text-2xl font-semibold leading-none text-[#18181b] dark:text-white">
                                    {formatMoney(referralStats?.total_rebate_amount)}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-4 min-w-0">
                    <div className="text-sm font-medium text-[#18181b] dark:text-white">
                        {t('portal.referrals.title')}
                    </div>
                    <div className="mt-1 hidden text-xs text-[#8e8e93] sm:block">
                        {t('portal.referrals.description')}
                    </div>

                    <div className="mt-4">
                        {isDiscountCodeLoading ? (
                            <Skeleton className="h-[90px] w-full rounded-md" />
                        ) : myDiscountCode ? (
                            <div className="divide-y divide-[#f2f3f5] border-y border-[#f2f3f5] dark:divide-white/10 dark:border-white/10">
                                <div className="flex items-center gap-3 py-2.5">
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={copyMyDiscountCode}
                                    >
                                        <div className="text-xs text-[#8e8e93]">{t('portal.referrals.discountCode')}</div>
                                        <div className="mt-1 truncate font-mono text-sm font-semibold tracking-[0.08em] text-[#18181b] dark:text-white">
                                            {myDiscountCode}
                                        </div>
                                    </button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 rounded-md border-[#e5e7eb] bg-background shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10"
                                        onClick={copyMyDiscountCode}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        <span className="sr-only">{t('portal.referrals.copyCode')}</span>
                                    </Button>
                                </div>
                                <div className="flex items-center gap-3 py-2.5">
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={copyInviteLink}
                                    >
                                        <div className="text-xs text-[#8e8e93]">{t('portal.referrals.inviteLink')}</div>
                                        <div className="mt-1 truncate font-mono text-sm text-[#18181b] dark:text-white">
                                            {inviteLink}
                                        </div>
                                    </button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 rounded-md border-[#e5e7eb] bg-background shadow-none hover:border-[#18181b] hover:bg-background dark:border-white/10"
                                        onClick={copyInviteLink}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        <span className="sr-only">{t('portal.referrals.copyInviteLink')}</span>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                onClick={() => generateDiscountCodeMutation.mutate()}
                                disabled={generateDiscountCodeMutation.isPending}
                                className="h-10 w-full rounded-md bg-[#181e25] px-4 text-white shadow-none hover:bg-[#111827] dark:bg-white dark:text-[#181e25] sm:w-auto"
                            >
                                {generateDiscountCodeMutation.isPending
                                    ? t('portal.referrals.generatingDiscountCode')
                                    : t('portal.referrals.generateDiscountCode')}
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            <section>
                <div className="mb-3">
                    <h2 className="text-sm font-medium text-[#18181b] dark:text-white">
                        {t('portal.referrals.logsTitle')}
                    </h2>
                    <p className="mt-1 hidden text-xs text-[#8e8e93] sm:block">{t('portal.referrals.logsDescription')}</p>
                </div>

                <UserPortalReferralRecordHistory />
            </section>
        </div>
    )
}
