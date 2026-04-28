import { Link } from 'react-router'
import { ArrowRight, BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageSelector } from '@/components/common/LanguageSelector'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'
import { ROUTES } from '@/routes/constants'

export function UserPortalMarketingHeader() {
    const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated)

    return (
        <header className="relative z-10">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
                <Link to="/" className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.65)] dark:bg-white dark:text-slate-950">
                        <BrainCircuit className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-base font-semibold tracking-tight">LiteMHub</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">AI Model Router</div>
                    </div>
                </Link>

                <nav className="hidden items-center gap-8 text-sm text-slate-600 dark:text-slate-300 md:flex">
                    <Link to={ROUTES.PUBLIC_MODELS} className="transition hover:text-slate-950 dark:hover:text-white">模型</Link>
                    <a href="/#billing" className="transition hover:text-slate-950 dark:hover:text-white">计费</a>
                    <a href="/#workflow" className="transition hover:text-slate-950 dark:hover:text-white">流程</a>
                </nav>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:block">
                        <ThemeToggle />
                    </div>
                    <div className="hidden sm:block">
                        <LanguageSelector variant="minimal" />
                    </div>
                    {!isAuthenticated && (
                        <Link to={ROUTES.USER_LOGIN}>
                            <Button variant="ghost" className="rounded-full">登录</Button>
                        </Link>
                    )}
                    <Link to={isAuthenticated ? ROUTES.USER_DASHBOARD : ROUTES.USER_REGISTER}>
                        <Button className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90">
                            {isAuthenticated ? '进入控制台' : '开始使用'}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </header>
    )
}
