import { Link } from 'react-router'
import {
    ArrowRight,
    Activity,
    Boxes,
    CreditCard,
    FileText,
    Gauge,
    Globe2,
    KeyRound,
    Layers3,
    LockKeyhole,
    Network,
    Search,
    ShieldCheck,
    Sparkles,
    TerminalSquare,
    TrendingUp,
    Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserPortalMarketingHeader } from '@/feature/user-portal/components/UserPortalMarketingHeader'
import { ROUTES } from '@/routes/constants'

const features = [
    {
        icon: Network,
        title: '一个 API 接入全部模型',
        desc: '统一 OpenAI-compatible 调用格式，上游模型、渠道和供应商在后台集中配置。',
        link: ROUTES.PUBLIC_MODELS,
        action: '浏览模型',
    },
    {
        icon: Activity,
        title: '多渠道可用性路由',
        desc: '同一模型可绑定多个供应渠道，便于按稳定性、倍率和可用状态切换。',
        link: '#workflow',
        action: '查看流程',
    },
    {
        icon: Gauge,
        title: '价格和用量透明',
        desc: '按模型价格、分组倍率和真实用量生成消费记录，方便运营和对账。',
        link: '#billing',
        action: '查看计费',
    },
    {
        icon: ShieldCheck,
        title: '余额保护和数据边界',
        desc: '预占、结算、流水追踪和用户 Key 隔离，降低并发扣费和权限混用风险。',
        link: ROUTES.USER_REGISTER,
        action: '开始接入',
    },
]

const stats = [
    ['1 API', '统一调用入口'],
    ['多渠道', '供应商集中管理'],
    ['预付费', '余额实时扣减'],
    ['自助 Key', '用户独立凭证'],
]

const modelLinks = [
    ['GPT 系列', 'OpenAI-compatible', ROUTES.PUBLIC_MODELS],
    ['Claude 系列', '长上下文任务', ROUTES.PUBLIC_MODELS],
    ['Gemini 系列', '多模态输入', ROUTES.PUBLIC_MODELS],
    ['Qwen 系列', '中文业务场景', ROUTES.PUBLIC_MODELS],
    ['DeepSeek 系列', '高性价比推理', ROUTES.PUBLIC_MODELS],
    ['自定义模型', '接入你的渠道', ROUTES.USER_REGISTER],
]

const appLinks = [
    {
        title: '开发者控制台',
        desc: '充值、建 Key、看日志、查余额。',
        link: ROUTES.USER_DASHBOARD,
    },
    {
        title: '模型目录',
        desc: '按供应商、能力和价格浏览模型。',
        link: ROUTES.PUBLIC_MODELS,
    },
    {
        title: '用量日志',
        desc: '请求、扣费、耗时和错误集中追踪。',
        link: ROUTES.USER_LOGS,
    },
]

const flow = [
    ['01', '注册账号', '创建个人或团队入口。'],
    ['02', '充值余额', '预付费额度可用于任意可用模型。'],
    ['03', '创建 API Key', '绑定分组倍率，隔离调用凭证。'],
]

const announcements = [
    ['钱包 MVP 已上线', '预付费余额、扣费流水和用户 Key 已形成闭环。'],
    ['公开模型目录', '无需登录也能浏览可用模型和能力说明。'],
    ['分组倍率计费', '按用户 Key 绑定分组，统一计算模型消费。'],
]

export default function UserPortalLandingPage() {
    return (
        <div className="min-h-screen overflow-x-hidden bg-white font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] transition-colors duration-200 dark:bg-background dark:text-foreground">
            <UserPortalMarketingHeader />

            <main>
                <section className="relative overflow-hidden border-b border-[#f2f3f5] bg-white dark:border-border dark:bg-background">
                    <div className="pointer-events-none absolute right-[-10rem] top-[-16rem] h-[34rem] w-[34rem] rounded-full bg-[#1456f0]/10 blur-3xl dark:bg-primary/[0.10]" />
                    <div className="pointer-events-none absolute bottom-[-14rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[#ea5ec1]/10 blur-3xl dark:bg-amber-500/[0.07]" />

                    <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-18">
                        <div className="mx-auto max-w-4xl text-center">
                            <Link
                                to={ROUTES.PUBLIC_MODELS}
                                className="mx-auto mb-8 flex h-12 max-w-2xl items-center gap-3 rounded-full border border-[#e5e7eb] bg-white px-4 text-left text-sm text-[#8e8e93] shadow-[rgba(36,36,36,0.04)_0px_8px_18px] transition hover:border-[#d8dbe2] hover:bg-[#f9fafb] dark:border-border dark:bg-card dark:text-muted-foreground dark:shadow-none dark:hover:border-primary/40 dark:hover:bg-muted"
                            >
                                <Search className="h-4 w-4 shrink-0 text-[#45515e] dark:text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate">搜索模型、供应商、价格和能力...</span>
                                <span className="hidden rounded-full bg-[#f0f0f0] px-2 py-1 text-xs text-[#45515e] dark:bg-muted dark:text-muted-foreground sm:inline">/</span>
                            </Link>

                            <Badge className="mb-5 rounded-full border-[#e5e7eb] bg-white px-3 py-1 text-[#45515e] shadow-none hover:bg-[#f9fafb] dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-muted">
                                <Sparkles className="h-3.5 w-3.5 text-[#1456f0]" />
                                LiteMHub 模型分发平台
                            </Badge>

                            <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-5xl font-medium leading-[1.08] text-[#222222] dark:text-foreground sm:text-6xl lg:text-[78px]">
                                一个统一入口，连接你的 AI 模型供应。
                            </h1>

                            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#45515e] dark:text-muted-foreground">
                                用 OpenAI-compatible API 聚合模型、渠道、用户 Key、分组倍率和预付费钱包，给开发者一个稳定、可观测、可计费的调用入口。
                            </p>

                            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                                <Link to={ROUTES.USER_REGISTER}>
                                    <Button size="lg" className="h-12 rounded-lg bg-[#181e25] px-7 text-white hover:bg-[#111827] dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90">
                                        获取 API Key
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link to={ROUTES.PUBLIC_MODELS}>
                                    <Button size="lg" variant="outline" className="h-12 rounded-lg border-[#e5e7eb] bg-white px-7 text-[#333333] hover:bg-[#f5f7fb] dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted">
                                        探索模型
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        <div className="mt-12 grid border-y border-[#f2f3f5] bg-white/70 dark:border-border dark:bg-card/55 sm:grid-cols-4 sm:divide-x sm:divide-[#f2f3f5] sm:dark:divide-border">
                            {stats.map(([value, label]) => (
                                <div key={value} className="border-b border-[#f2f3f5] py-5 text-center last:border-b-0 dark:border-border sm:border-b-0">
                                    <div className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold">{value}</div>
                                    <div className="mt-1 text-sm text-[#8e8e93] dark:text-muted-foreground">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="models" className="border-b border-[#f2f3f5] bg-white dark:border-border dark:bg-background">
                    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
                        <div className="mb-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <div className="text-sm font-medium text-[#6A6DE6]">Model Distribution</div>
                                <h2 className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold sm:text-4xl">把模型供应做成可浏览、可路由、可计费的目录。</h2>
                            </div>
                            <p className="max-w-xl text-[#45515e] dark:text-muted-foreground">
                                首页先提供核心入口，模型详情、排行、供应商和文档链接后续逐步补齐。
                            </p>
                        </div>

                        <div className="grid border-l border-t border-[#f2f3f5] bg-white shadow-[rgba(36,36,36,0.04)_0px_12px_24px] dark:border-border dark:bg-card dark:shadow-none md:grid-cols-2 lg:grid-cols-3">
                            {features.map((feature) => (
                                <div key={feature.title} className="border-b border-r border-[#f2f3f5] p-6 transition hover:bg-[#f7f8fc] dark:border-border dark:hover:bg-muted">
                                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#181e25] text-white dark:bg-primary dark:text-primary-foreground">
                                        <feature.icon className="h-5 w-5" />
                                    </div>
                                    <div className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-xl font-semibold">{feature.title}</div>
                                    <p className="mt-3 leading-7 text-[#45515e] dark:text-muted-foreground">{feature.desc}</p>
                                    <Link to={feature.link} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#1456f0]">
                                        {feature.action}
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-b border-[#f2f3f5] bg-[#fbfbfc] dark:border-border dark:bg-card">
                    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
                        <div>
                            <div className="text-sm font-medium text-[#6A6DE6]">Featured Models</div>
                            <h2 className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold sm:text-4xl">常用模型入口先放在首页。</h2>
                        </div>
                        <div className="grid border-l border-t border-[#f2f3f5] bg-white shadow-[rgba(36,36,36,0.04)_0px_12px_24px] dark:border-border dark:bg-background dark:shadow-none sm:grid-cols-2">
                            {modelLinks.map(([name, desc, link]) => (
                                <Link key={name} to={link} className="group border-b border-r border-[#f2f3f5] p-5 transition hover:bg-[#f7f8fc] dark:border-border dark:hover:bg-muted">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="font-semibold">{name}</div>
                                        <ArrowRight className="h-4 w-4 text-[#8e8e93] transition group-hover:translate-x-0.5 group-hover:text-[#1456f0]" />
                                    </div>
                                    <div className="mt-2 text-sm text-[#8e8e93] dark:text-muted-foreground">{desc}</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="workflow" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
                    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="text-sm font-medium text-[#6A6DE6]">Get Started</div>
                            <h2 className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold sm:text-4xl">三步拿到可用的模型调用入口。</h2>
                        </div>
                        <Link to={ROUTES.USER_REGISTER} className="inline-flex items-center gap-2 text-sm font-medium text-[#1456f0]">
                            创建账号
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <div className="grid border-l border-t border-[#f2f3f5] bg-white shadow-[rgba(36,36,36,0.04)_0px_12px_24px] dark:border-border dark:bg-card dark:shadow-none md:grid-cols-3">
                        {flow.map(([step, title, desc], index) => {
                            const Icon = [FileText, CreditCard, KeyRound][index]
                            return (
                                <div key={step} className="border-b border-r border-[#f2f3f5] p-6 transition hover:bg-[#f7f8fc] dark:border-border dark:hover:bg-muted">
                                    <Icon className="mb-5 h-5 w-5 text-[#1456f0]" />
                                    <div className="text-sm font-semibold text-[#8e8e93] dark:text-muted-foreground">{step}</div>
                                    <div className="mt-3 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold">{title}</div>
                                    <p className="mt-3 leading-7 text-[#45515e] dark:text-muted-foreground">{desc}</p>
                                </div>
                            )
                        })}
                    </div>
                </section>

                <section id="billing" className="border-y border-[#181e25] bg-[#181e25] text-white dark:border-border dark:bg-card">
                    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                        <div>
                            <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                                <Wallet className="h-3.5 w-3.5" />
                                Prepaid Billing
                            </Badge>
                            <h2 className="mt-5 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold sm:text-4xl">只做清晰的预付费账务。</h2>
                            <p className="mt-4 leading-8 text-white/65">
                                充值余额、请求预占、完成结算、流水追踪。先把开发者真正关心的消费闭环跑稳。
                            </p>
                        </div>
                        <div className="grid border border-white/10 bg-white/[0.03] dark:border-border dark:bg-background/45 md:grid-cols-2">
                            {[
                                ['固定价格表', '模型请求完成后复用现有价格计算 amount。', Layers3],
                                ['分组倍率', '用户 Key 绑定分组，按倍率结算真实消费。', TrendingUp],
                                ['并发保护', '预占和结算分离，减少余额超扣风险。', LockKeyhole],
                                ['全链路日志', '调用、扣费、余额变化都能追踪。', TerminalSquare],
                            ].map(([title, desc, Icon]) => (
                                <div key={title as string} className="border-b border-white/10 p-5 transition hover:bg-white/[0.05] last:border-b-0 md:border-r md:even:border-r-0">
                                    <Icon className="mb-4 h-5 w-5 text-white/80" />
                                    <div className="font-semibold">{title as string}</div>
                                    <div className="mt-2 text-sm leading-6 text-white/55">{desc as string}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1fr]">
                    <div>
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <div>
                                <div className="text-sm font-medium text-[#6A6DE6]">Apps</div>
                                <h2 className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold">常用入口</h2>
                            </div>
                            <Link to={ROUTES.USER_DASHBOARD} className="text-sm font-medium text-[#1456f0]">查看全部</Link>
                        </div>
                        <div className="divide-y divide-[#f2f3f5] border-y border-[#f2f3f5] bg-white shadow-[rgba(36,36,36,0.04)_0px_12px_24px] dark:divide-border dark:border-border dark:bg-card dark:shadow-none">
                            {appLinks.map((item) => (
                                <Link key={item.title} to={item.link} className="group flex items-center justify-between gap-4 px-4 py-5 transition hover:bg-[#f7f8fc] dark:hover:bg-muted">
                                    <div>
                                        <div className="font-semibold">{item.title}</div>
                                        <div className="mt-1 text-sm text-[#8e8e93] dark:text-muted-foreground">{item.desc}</div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-[#8e8e93] transition group-hover:translate-x-0.5 group-hover:text-[#1456f0]" />
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <div>
                                <div className="text-sm font-medium text-[#6A6DE6]">Announcements</div>
                                <h2 className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold">近期更新</h2>
                            </div>
                            <a href="#" className="text-sm font-medium text-[#1456f0]">查看全部</a>
                        </div>
                        <div className="divide-y divide-[#f2f3f5] border-y border-[#f2f3f5] bg-white shadow-[rgba(36,36,36,0.04)_0px_12px_24px] dark:divide-border dark:border-border dark:bg-card dark:shadow-none">
                            {announcements.map(([title, desc]) => (
                                <a key={title} href="#" className="group block px-4 py-5 transition hover:bg-[#f7f8fc] dark:hover:bg-muted">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="font-semibold">{title}</div>
                                        <ArrowRight className="h-4 w-4 text-[#8e8e93] transition group-hover:translate-x-0.5 group-hover:text-[#1456f0]" />
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-[#45515e] dark:text-muted-foreground">{desc}</p>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-[#f2f3f5] bg-[#fbfbfc] py-8 text-center text-sm text-[#8e8e93] dark:border-border dark:bg-card dark:text-muted-foreground">
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
