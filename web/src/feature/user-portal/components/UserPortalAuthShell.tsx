import type { ReactNode } from 'react'
import { Cpu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from '@/components/common/ThemeToggle'

type UserPortalAuthMode = 'login' | 'register'

interface UserPortalAuthShellProps {
    mode: UserPortalAuthMode
    children: ReactNode
}

export function UserPortalAuthShell({ mode, children }: UserPortalAuthShellProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string

    return (
        <div className="min-h-[100dvh] overflow-x-hidden bg-[#f3f3f3] font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#151515] transition-colors duration-200 dark:bg-[#0c0d0f] dark:text-[#f3f4f6]">
            <div className="absolute right-5 top-5">
                <ThemeToggle />
            </div>

            <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
                <div className="grid w-full max-w-[896px] overflow-hidden rounded-[13px] border border-[#d9d9d9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#111316] md:min-h-[572px] md:grid-cols-2">
                    <section className="flex flex-col bg-white px-8 py-9 dark:bg-[#111316] sm:px-10 md:px-8 lg:px-10">
                        <div className="mx-auto mb-9 flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#151515] text-[12px] font-semibold text-white dark:bg-[#f4f4f5] dark:text-[#111316]">
                                LM
                            </span>
                            <span className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-xl font-semibold text-[#151515] dark:text-white">
                                LiteMHub
                            </span>
                        </div>

                        <div className="mx-auto flex w-full max-w-[384px] flex-1 flex-col justify-center">
                            {children}
                        </div>
                    </section>

                    <section className="hidden border-l border-[#d9d9d9] bg-[#e8e8e8] dark:border-white/10 dark:bg-[#1b1d21] md:block">
                        <div className="relative flex h-full min-h-[572px] items-center justify-center overflow-hidden">
                            <div className="absolute h-40 w-px rotate-45 bg-[#d3d3d3] dark:bg-white/[0.08]" />
                            <div className="absolute h-40 w-px -rotate-45 bg-[#d3d3d3] dark:bg-white/[0.08]" />
                            <div className="absolute h-32 w-px bg-[#d3d3d3] dark:bg-white/[0.08]" />
                            <div className="absolute h-px w-32 bg-[#d3d3d3] dark:bg-white/[0.08]" />
                            <div className="absolute h-32 w-32 rounded-full border border-[#d5d5d5] dark:border-white/10" />
                            <div className="absolute h-14 w-14 rounded-full border border-[#d0d0d0] bg-[#ededed] dark:border-white/10 dark:bg-[#202328]" />
                            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[#cfcfcf] bg-[#efefef] text-[#8d8d8d] dark:border-white/10 dark:bg-[#202328] dark:text-white/45">
                                <Cpu className="h-5 w-5" strokeWidth={1.7} />
                            </div>
                            <div className="absolute bottom-6 right-6 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-xs font-medium uppercase text-[#b5b5b5] dark:text-white/[0.18]">
                                {mode === 'login' ? 'Sign in' : 'Create account'}
                            </div>
                        </div>
                    </section>
                </div>

                <p className="mt-6 text-center text-xs leading-6 text-[#6f6f6f] dark:text-white/40">
                    {t('portalAuth.termsPrefix')}
                    <span className="mx-1 underline underline-offset-2">{t('portalAuth.terms')}</span>
                    {t('portalAuth.termsJoiner')}
                    <span className="mx-1 underline underline-offset-2">{t('portalAuth.privacy')}</span>
                    {t('portalAuth.termsSuffix')}
                </p>
            </main>
        </div>
    )
}
