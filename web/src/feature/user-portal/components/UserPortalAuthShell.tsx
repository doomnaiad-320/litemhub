import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPortalMarketingHeader } from '@/feature/user-portal/components/UserPortalMarketingHeader'

type UserPortalAuthMode = 'login' | 'register'

interface UserPortalAuthShellProps {
    mode: UserPortalAuthMode
    children: ReactNode
}

export function UserPortalAuthShell({ mode, children }: UserPortalAuthShellProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string

    return (
        <div className="min-h-screen overflow-x-hidden bg-white font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] transition-colors duration-200 dark:bg-background dark:text-foreground">
            <UserPortalMarketingHeader />

            <main className="relative flex min-h-[calc(100dvh-58px)] flex-col items-center justify-center overflow-hidden border-b border-[#f2f3f5] bg-white px-4 py-10 dark:border-border dark:bg-background">
                <div className="pointer-events-none absolute right-[-10rem] top-[-16rem] h-[34rem] w-[34rem] rounded-full bg-[#1456f0]/10 blur-3xl dark:bg-primary/10" />
                <div className="pointer-events-none absolute bottom-[-14rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[#ea5ec1]/10 blur-3xl dark:bg-[#f59e0b]/10" />

                <div className="relative grid w-full max-w-[896px] overflow-hidden rounded-[13px] border border-[#d9d9d9] bg-white shadow-[rgba(36,36,36,0.04)_0px_12px_24px] dark:border-border dark:bg-card dark:shadow-none md:min-h-[572px] md:grid-cols-2">
                    <section className="flex flex-col bg-white px-8 py-9 dark:bg-card sm:px-10 md:px-8 lg:px-10">
                        <div className="mx-auto mb-9 flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#151515] text-[12px] font-semibold text-white dark:bg-primary dark:text-primary-foreground">
                                LM
                            </span>
                            <span className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-xl font-semibold text-[#151515] dark:text-foreground">
                                LiteMHub
                            </span>
                        </div>

                        <div className="mx-auto flex w-full max-w-[384px] flex-1 flex-col justify-center">
                            {children}
                        </div>
                    </section>

                    <section className="hidden border-l border-[#d9d9d9] bg-[#e8e8e8] dark:border-border dark:bg-muted md:block">
                        <div className="relative flex h-full min-h-[572px] items-center justify-center overflow-hidden">
                            <AuthSideIllustration />
                            <div className="absolute bottom-6 right-6 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-xs font-medium uppercase text-[#b5b5b5] dark:text-muted-foreground/40">
                                {mode === 'login' ? 'Sign in' : 'Create account'}
                            </div>
                        </div>
                    </section>
                </div>

                <p className="mt-6 text-center text-xs leading-6 text-[#6f6f6f] dark:text-muted-foreground">
                    {t('portalAuth.agreementNotice')}
                </p>
            </main>
        </div>
    )
}

function AuthSideIllustration() {
    return (
        <svg
            aria-hidden="true"
            className="h-full w-full"
            viewBox="0 0 448 572"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="auth-hero-blue" x1="100" y1="90" x2="356" y2="420" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1456F0" />
                    <stop offset="1" stopColor="#3DAEFF" />
                </linearGradient>
                <linearGradient id="auth-hero-pink" x1="133" y1="156" x2="323" y2="430" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#EA5EC1" />
                    <stop offset="1" stopColor="#60A5FA" />
                </linearGradient>
                <radialGradient id="auth-hero-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(226 276) rotate(90) scale(230 180)">
                    <stop stopColor="#60A5FA" stopOpacity=".34" />
                    <stop offset=".62" stopColor="#EA5EC1" stopOpacity=".13" />
                    <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </radialGradient>
                <filter id="auth-hero-shadow" x="64" y="95" width="326" height="382" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feDropShadow dx="6" dy="2" stdDeviation="13" floodColor="#2C1E74" floodOpacity=".14" />
                </filter>
                <pattern id="auth-hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M32 0H0V32" stroke="currentColor" strokeOpacity=".22" />
                </pattern>
            </defs>

            <rect width="448" height="572" className="fill-[#e8e8e8] dark:fill-muted" />
            <rect width="448" height="572" fill="url(#auth-hero-glow)" />
            <rect width="448" height="572" fill="url(#auth-hero-grid)" className="text-[#cfcfcf] dark:text-muted-foreground/10" />

            <g opacity=".68">
                <path d="M59 128C124 92 181 97 232 143C281 187 336 188 391 146" className="stroke-[#c6c6c6] dark:stroke-border" strokeWidth="1.2" />
                <path d="M64 442C126 399 190 398 245 438C293 473 347 471 392 424" className="stroke-[#c6c6c6] dark:stroke-border" strokeWidth="1.2" />
            </g>

            <g filter="url(#auth-hero-shadow)">
                <rect x="118" y="138" width="212" height="296" rx="24" className="fill-white dark:fill-card" />
                <rect x="118.5" y="138.5" width="211" height="295" rx="23.5" className="stroke-[#d9d9d9] dark:stroke-border" />

                <rect x="142" y="162" width="164" height="44" rx="12" fill="url(#auth-hero-blue)" />
                <circle cx="165" cy="184" r="8" fill="white" fillOpacity=".92" />
                <path d="M185 178H276M185 190H244" stroke="white" strokeOpacity=".78" strokeWidth="6" strokeLinecap="round" />

                <path d="M224 224V259" className="stroke-[#b8c7dc] dark:stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" />
                <path d="M174 292H224H274" className="stroke-[#b8c7dc] dark:stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" />
                <path d="M174 292V332M274 292V332" className="stroke-[#b8c7dc] dark:stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" />

                <rect x="168" y="244" width="112" height="64" rx="18" fill="url(#auth-hero-pink)" />
                <rect x="186" y="263" width="76" height="8" rx="4" fill="white" fillOpacity=".86" />
                <rect x="198" y="281" width="52" height="8" rx="4" fill="white" fillOpacity=".62" />
                <circle cx="224" cy="334" r="12" fill="#1456F0" />
                <circle cx="174" cy="356" r="12" fill="#EA5EC1" />
                <circle cx="274" cy="356" r="12" fill="#3DAEFF" />

                <rect x="146" y="375" width="156" height="34" rx="12" className="fill-[#f4f7ff] dark:fill-muted" />
                <path d="M165 392H220M235 392H283" className="stroke-[#8e8e93] dark:stroke-muted-foreground/55" strokeWidth="6" strokeLinecap="round" />
            </g>

            <g>
                <rect x="72" y="220" width="94" height="58" rx="16" className="fill-white dark:fill-card" />
                <rect x="72.5" y="220.5" width="93" height="57" rx="15.5" className="stroke-[#d9d9d9] dark:stroke-border" />
                <path d="M94 242H137M94 258H124" className="stroke-[#45515e] dark:stroke-muted-foreground/60" strokeWidth="6" strokeLinecap="round" />
            </g>

            <g>
                <rect x="286" y="326" width="92" height="58" rx="16" className="fill-white dark:fill-card" />
                <rect x="286.5" y="326.5" width="91" height="57" rx="15.5" className="stroke-[#d9d9d9] dark:stroke-border" />
                <path d="M309 348H352M309 364H338" className="stroke-[#45515e] dark:stroke-muted-foreground/60" strokeWidth="6" strokeLinecap="round" />
            </g>

            <path d="M166 249C189 239 194 231 207 207" className="stroke-[#1456f0] dark:stroke-[#60a5fa]" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 8" />
            <path d="M280 329C298 316 307 301 313 278" className="stroke-[#ea5ec1] dark:stroke-[#ea5ec1]" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 8" />
            <circle cx="209" cy="206" r="4" fill="#1456F0" />
            <circle cx="313" cy="278" r="4" fill="#EA5EC1" />
        </svg>
    )
}
