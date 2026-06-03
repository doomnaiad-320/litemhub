import { Link } from 'react-router'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '@/routes/constants'
import { cn } from '@/lib/utils'

interface UserPortalAgreementConsentProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    error?: boolean
}

export function UserPortalAgreementConsent({
    checked,
    error,
    onCheckedChange,
}: UserPortalAgreementConsentProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string

    return (
        <div
            className={cn(
                'rounded-[8px] border bg-[#fbfbfc] p-3 transition dark:bg-muted/60',
                error
                    ? 'border-red-300 bg-red-50 dark:border-red-400/40 dark:bg-red-500/10'
                    : 'border-[#f2f3f5] dark:border-border',
            )}
        >
            <label className="flex cursor-pointer items-start gap-3 text-left">
                <span className="relative mt-[2px] flex h-4 w-4 shrink-0">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => onCheckedChange(event.target.checked)}
                        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[4px] border border-[#d9d9d9] bg-white transition checked:border-[#151515] checked:bg-[#151515] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#151515]/15 dark:border-input dark:bg-card dark:checked:border-primary dark:checked:bg-primary dark:focus-visible:ring-ring/20"
                        aria-invalid={error || undefined}
                    />
                    <Check className="pointer-events-none absolute left-[2px] top-[2px] h-3 w-3 text-white opacity-0 transition peer-checked:opacity-100 dark:text-primary-foreground" strokeWidth={3} />
                </span>
                <span className="text-xs leading-5 text-[#6f6f6f] dark:text-muted-foreground">
                    {t('portalAuth.agreementPrefix')}
                    <Link
                        to={ROUTES.PUBLIC_TERMS}
                        target="_blank"
                        rel="noreferrer"
                        className="mx-1 font-medium text-[#1456f0] underline underline-offset-2 hover:text-[#17437d] dark:text-[#60a5fa]"
                    >
                        {t('portalAuth.terms')}
                    </Link>
                    {t('portalAuth.termsJoiner')}
                    <Link
                        to={ROUTES.PUBLIC_PRIVACY}
                        target="_blank"
                        rel="noreferrer"
                        className="mx-1 font-medium text-[#1456f0] underline underline-offset-2 hover:text-[#17437d] dark:text-[#60a5fa]"
                    >
                        {t('portalAuth.privacy')}
                    </Link>
                    {t('portalAuth.termsSuffix')}
                </span>
            </label>
            {error ? (
                <div className="mt-2 pl-7 text-xs leading-5 text-red-600 dark:text-red-300">
                    {t('portalAuth.agreementRequired')}
                </div>
            ) : null}
        </div>
    )
}
