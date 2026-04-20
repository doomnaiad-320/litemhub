import { Link } from 'react-router'
import {
    ArrowRight,
    BadgeDollarSign,
    Boxes,
    BrainCircuit,
    CheckCircle2,
    Code2,
    Gauge,
    Globe2,
    KeyRound,
    Layers3,
    LockKeyhole,
    Network,
    Sparkles,
    Wallet,
    Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LanguageSelector } from '@/components/common/LanguageSelector'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'

const modelCards = [
    { name: 'GPT', desc: 'OpenAI compatible', tone: 'from-sky-400/24 to-blue-500/10' },
    { name: 'Claude', desc: 'Long context routing', tone: 'from-orange-400/24 to-amber-500/10' },
    { name: 'Gemini', desc: 'Multimodal ready', tone: 'from-emerald-400/24 to-teal-500/10' },
    { name: 'Qwen', desc: 'China-friendly stack', tone: 'from-violet-400/24 to-purple-500/10' },
]

const features = [
    {
        icon: Network,
        title: '统一模型入口',
        desc: '把多个上游模型、渠道和供应商汇聚到一个 OpenAI-compatible API。',
    },
    {
        icon: Wallet,
        title: '预付费钱包',
        desc: '只做余额充值和实际用量扣费，账务链路简单、明确、可对账。',
    },
    {
        icon: Layers3,
        title: '分组倍率计费',
        desc: '用户创建 Key 时选择分组，调用该组模型并按分组倍率消费。',
    },
    {
        icon: KeyRound,
        title: '用户自助 Key',
        desc: '用户可创建自己的调用 Key，后台无需展示用户自助创建的 Key。',
    },
    {
        icon: Gauge,
        title: '用量可观测',
        desc: '请求、扣费、流水和余额变化都能追踪，便于排查和运营。',
    },
    {
        icon: LockKeyhole,
        title: '并发安全扣费',
        desc: '模型请求采用预占和结算，防止并发场景下余额被超扣。',
    },
]

const flow = ['注册账号', '充值余额', '选择分组', '创建 Key', '请求模型', '按实际用量扣费']

export default function UserPortalLandingPage() {
    const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated)

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#f7f8fc] text-slate-950 dark:bg-[#070912] dark:text-white">
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute left-1/2 top-[-18rem] h-[38rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(106,109,230,0.28)_0%,_rgba(106,109,230,0.09)_38%,_transparent_70%)] blur-2xl" />
                <div className="absolute right-[-16rem] top-40 h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute bottom-[-18rem] left-[-10rem] h-[34rem] w-[34rem] rounded-full bg-violet-500/12 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:42px_42px] dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]" />
            </div>

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
                        <a href="#models" className="transition hover:text-slate-950 dark:hover:text-white">模型</a>
                        <a href="#billing" className="transition hover:text-slate-950 dark:hover:text-white">计费</a>
                        <a href="#workflow" className="transition hover:text-slate-950 dark:hover:text-white">流程</a>
                    </nav>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block">
                            <ThemeToggle />
                        </div>
                        <div className="hidden sm:block">
                            <LanguageSelector variant="minimal" />
                        </div>
                        <Link to="/login">
                            <Button variant="ghost" className="rounded-full">登录</Button>
                        </Link>
                        <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                            <Button className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90">
                                {isAuthenticated ? '进入控制台' : '开始使用'}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:pb-24 lg:pt-20">
                    <div className="space-y-8">
                        <Badge className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-slate-200">
                            <Sparkles className="h-3.5 w-3.5 text-[#6A6DE6]" />
                            面向开发者的 AI 模型分发平台
                        </Badge>

                        <div className="space-y-5">
                            <h1 className="max-w-5xl text-5xl font-semibold tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                                一个入口，分发所有 AI 模型。
                            </h1>
                            <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                LiteMHub 为你的用户提供类似 OpenRouter 的模型接入体验：统一 API、分组倍率、预付费钱包、真实用量扣费，以及可追踪的余额流水。
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link to="/register">
                                <Button size="lg" className="h-12 rounded-full bg-slate-950 px-7 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90">
                                    免费注册
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Link to="/login">
                                <Button size="lg" variant="outline" className="h-12 rounded-full border-slate-300 bg-white/70 px-7 backdrop-blur dark:border-white/12 dark:bg-white/5">
                                    登录控制台
                                </Button>
                            </Link>
                        </div>

                        <div className="grid max-w-2xl grid-cols-3 gap-3">
                            <div className="rounded-3xl border border-white/70 bg-white/66 p-4 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
                                <div className="text-2xl font-semibold">1 API</div>
                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">统一调用入口</div>
                            </div>
                            <div className="rounded-3xl border border-white/70 bg-white/66 p-4 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
                                <div className="text-2xl font-semibold">Wallet</div>
                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">预付费余额</div>
                            </div>
                            <div className="rounded-3xl border border-white/70 bg-white/66 p-4 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
                                <div className="text-2xl font-semibold">Groups</div>
                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">倍率分组</div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-6 rounded-[42px] bg-[#6A6DE6]/18 blur-3xl" />
                        <div className="relative rounded-[42px] border border-white/80 bg-white/74 p-4 shadow-[0_50px_120px_-70px_rgba(15,23,42,0.65)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/7">
                            <div className="rounded-[32px] border border-slate-200/70 bg-slate-950 p-4 text-white shadow-2xl dark:border-white/10">
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-red-400" />
                                        <div className="h-3 w-3 rounded-full bg-amber-400" />
                                        <div className="h-3 w-3 rounded-full bg-emerald-400" />
                                    </div>
                                    <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">OpenAI compatible</Badge>
                                </div>
                                <div className="rounded-3xl bg-white/[0.06] p-5">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-white/55">Selected group</div>
                                            <div className="mt-1 text-2xl font-semibold">A / Premium</div>
                                        </div>
                                        <div className="rounded-2xl bg-[#6A6DE6] px-4 py-2 text-sm font-medium">x3.00</div>
                                    </div>
                                    <div className="grid gap-3">
                                        {modelCards.map((item) => (
                                            <div key={item.name} className={`rounded-2xl border border-white/10 bg-gradient-to-r ${item.tone} p-4`}>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="text-lg font-semibold">{item.name}</div>
                                                        <div className="mt-1 text-sm text-white/55">{item.desc}</div>
                                                    </div>
                                                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">ready</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-4 rounded-3xl bg-white/[0.06] p-5">
                                    <div className="mb-3 flex items-center gap-2 text-sm text-white/60">
                                        <Code2 className="h-4 w-4" />
                                        Request
                                    </div>
                                    <pre className="overflow-x-auto text-sm leading-7 text-white/78">
{`curl https://api.yourdomain.com/v1/chat/completions \\
  -H "Authorization: Bearer sk-user..." \\
  -d '{"model":"gpt-4.1","messages":[...]}'`}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="models" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="text-sm font-medium text-[#6A6DE6]">Model Distribution</div>
                            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">像交易所一样管理模型供应。</h2>
                        </div>
                        <p className="max-w-xl text-slate-600 dark:text-slate-300">
                            把上游、模型、价格、分组和用户 Key 拆开管理，最终给用户一个简单稳定的调用入口。
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => (
                            <Card key={feature.title} className="rounded-[30px] border-white/70 bg-white/72 shadow-[0_26px_58px_-44px_rgba(15,23,42,0.36)] backdrop-blur-xl transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/6">
                                <CardContent className="p-6">
                                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                                        <feature.icon className="h-5 w-5" />
                                    </div>
                                    <div className="text-xl font-semibold">{feature.title}</div>
                                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{feature.desc}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section id="billing" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                    <div className="rounded-[36px] border border-white/70 bg-slate-950 p-6 text-white shadow-[0_40px_100px_-70px_rgba(15,23,42,0.75)] dark:border-white/10 sm:p-8 lg:p-10">
                        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                            <div className="space-y-4">
                                <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                                    <BadgeDollarSign className="h-3.5 w-3.5" />
                                    Prepaid Billing
                                </Badge>
                                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">计费逻辑简单，但足够严谨。</h2>
                                <p className="leading-8 text-white/65">
                                    本期只做预付费钱包。充值到账后，模型请求先预占余额，请求完成后按实际 amount 结算，多退少补，并记录钱包流水。
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                    ['只做预付费', '没有月结、发票、后付费复杂逻辑'],
                                    ['固定价格表', '调用完成后复用现有 price 算 amount'],
                                    ['分组倍率', '基础价格乘以用户 Key 绑定分组倍率'],
                                    ['防超扣', '预占 + 结算，处理并发扣费风险'],
                                ].map(([title, desc]) => (
                                    <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                                        <CheckCircle2 className="mb-4 h-5 w-5 text-emerald-300" />
                                        <div className="font-semibold">{title}</div>
                                        <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="workflow" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                    <div className="mb-8 text-center">
                        <div className="text-sm font-medium text-[#6A6DE6]">Workflow</div>
                        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">从注册到调用，六步跑通。</h2>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                        {flow.map((item, index) => (
                            <div key={item} className="rounded-3xl border border-white/70 bg-white/72 p-5 shadow-[0_24px_54px_-44px_rgba(15,23,42,0.34)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6A6DE6]/12 text-sm font-semibold text-[#6A6DE6]">
                                    {index + 1}
                                </div>
                                <div className="font-semibold">{item}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-4 py-12 pb-20 sm:px-6">
                    <div className="relative overflow-hidden rounded-[40px] border border-white/70 bg-white/78 p-8 text-center shadow-[0_34px_86px_-58px_rgba(15,23,42,0.46)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6 sm:p-12">
                        <div className="absolute left-1/2 top-0 h-44 w-96 -translate-x-1/2 rounded-full bg-[#6A6DE6]/14 blur-3xl" />
                        <div className="relative mx-auto max-w-3xl space-y-5">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                                <Zap className="h-6 w-6" />
                            </div>
                            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">开始构建你的模型分发业务。</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                先注册用户账号，创建 Key，然后通过 OpenAI-compatible API 请求模型。充值支付接口后续接入即可闭环。
                            </p>
                            <div className="flex flex-col justify-center gap-3 sm:flex-row">
                                <Link to="/register">
                                    <Button size="lg" className="h-12 rounded-full bg-slate-950 px-7 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90">
                                        注册账号
                                    </Button>
                                </Link>
                                <Link to="/login">
                                    <Button size="lg" variant="outline" className="h-12 rounded-full px-7">
                                        已有账号登录
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="relative z-10 border-t border-slate-200/70 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
                    <div>© {new Date().getFullYear()} LiteMHub. AI model distribution platform.</div>
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1"><Globe2 className="h-4 w-4" /> OpenAI-compatible</span>
                        <span className="inline-flex items-center gap-1"><Boxes className="h-4 w-4" /> Multi-provider</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
