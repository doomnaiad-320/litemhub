import { Github } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const userPortalOAuthProviders = [
    {
        id: 'github',
        href: '/user-api/auth/oauth/github/start?accepted_terms=true',
        labelKey: 'portalAuth.continueWithGitHub',
        icon: GitHubIcon,
    },
    {
        id: 'google',
        href: '/user-api/auth/oauth/google/start?accepted_terms=true',
        labelKey: 'portalAuth.continueWithGoogle',
        icon: GoogleOAuthIcon,
    },
] as const

interface UserPortalOAuthButtonsProps {
    dividerPosition?: 'top' | 'bottom'
    onBeforeStart?: () => boolean
}

export function UserPortalOAuthButtons({
    dividerPosition = 'bottom',
    onBeforeStart,
}: UserPortalOAuthButtonsProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const divider = (
        <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e5e7eb] dark:bg-white/10" />
            <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#8e8e93] dark:text-white/40">
                {t('portalAuth.oauthDivider')}
            </span>
            <div className="h-px flex-1 bg-[#e5e7eb] dark:bg-white/10" />
        </div>
    )

    return (
        <div className="space-y-4">
            {dividerPosition === 'top' ? divider : null}

            <div className="grid gap-2 sm:grid-cols-2">
                {userPortalOAuthProviders.map((provider) => {
                    const Icon = provider.icon

                    return (
                        <Button
                            key={provider.id}
                            asChild
                            variant="outline"
                            className={cn(
                                'h-10 w-full rounded-[8px] border-[#d9d9d9] bg-white px-4 text-sm font-medium text-[#151515] shadow-none transition hover:bg-[#f7f7f7] active:translate-y-px dark:border-white/10 dark:bg-[#15181c] dark:text-white dark:hover:bg-white/[0.06]',
                            )}
                        >
                            <a
                                href={provider.href}
                                onClick={(event) => {
                                    if (onBeforeStart?.() === false) {
                                        event.preventDefault()
                                    }
                                }}
                            >
                                <Icon />
                                <span className="min-w-0 truncate">{t(provider.labelKey)}</span>
                            </a>
                        </Button>
                    )
                })}
            </div>

            {dividerPosition === 'bottom' ? divider : null}
        </div>
    )
}

function GitHubIcon() {
    return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[#151515] dark:bg-white/10 dark:text-white">
            <Github className="h-4 w-4" />
        </span>
    )
}

function GoogleOAuthIcon() {
    return (
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <span className="absolute inset-0 rounded-full bg-[conic-gradient(#ea4335_0deg_90deg,#fbbc05_90deg_180deg,#34a853_180deg_270deg,#4285f4_270deg_360deg)]" />
            <span className="absolute inset-[2px] rounded-full bg-white dark:bg-[#15181c]" />
            <span className="relative text-[10px] font-semibold leading-none text-[#4285f4]">G</span>
        </span>
    )
}
