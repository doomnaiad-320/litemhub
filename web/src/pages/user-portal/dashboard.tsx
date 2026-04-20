import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ArrowRight, Layers3, KeyRound, ScrollText, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'
import { useUserPortalWallet, useUserPortalGroups, useUserPortalKeys } from '@/feature/user-portal/hooks'

const formatMoney = (amount?: number) => `$${(amount || 0).toFixed(4)}`

export default function UserPortalDashboardPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const user = useUserPortalAuthStore((state) => state.user)
    const { data: walletData, isLoading: walletLoading } = useUserPortalWallet(true)
    const { data: groupsData, isLoading: groupsLoading } = useUserPortalGroups(true)
    const { data: keysData, isLoading: keysLoading } = useUserPortalKeys(1, 5, undefined, true)

    const wallet = walletData?.wallet
    const groups = groupsData?.groups || []
    const keys = keysData?.keys || []
    const account = user?.email || user?.phone || `#${user?.id ?? ''}`

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <div className="text-sm text-primary">{t('portal.dashboard.welcome')}</div>
                        <h1 className="text-3xl font-semibold tracking-tight">{account}</h1>
                        <p className="max-w-2xl text-muted-foreground">
                            {t('portal.dashboard.description')}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link to="/groups">
                            <Button className="rounded-2xl">
                                <Layers3 className="h-4 w-4" />
                                {t('portal.dashboard.toGroups')}
                            </Button>
                        </Link>
                        <Link to="/keys">
                            <Button variant="outline" className="rounded-2xl">
                                <KeyRound className="h-4 w-4" />
                                {t('portal.dashboard.toKeys')}
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
                {walletLoading || !wallet ? (
                    <>
                        <Skeleton className="h-36 rounded-[28px]" />
                        <Skeleton className="h-36 rounded-[28px]" />
                        <Skeleton className="h-36 rounded-[28px]" />
                    </>
                ) : (
                    <>
                        <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Wallet className="h-4 w-4 text-primary" />
                                    {t('portal.dashboard.available')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-semibold tracking-tight">{formatMoney(wallet.available_balance)}</div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="text-base">{t('portal.dashboard.frozen')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-semibold tracking-tight">{formatMoney(wallet.frozen_balance)}</div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="text-base">{t('portal.dashboard.total')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-semibold tracking-tight">
                                    {formatMoney(wallet.available_balance + wallet.frozen_balance)}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">{t('portal.dashboard.groups')}</CardTitle>
                        <Link to="/groups">
                            <Button variant="ghost" size="sm" className="rounded-2xl">
                                {t('portal.dashboard.viewAll')}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {groupsLoading ? (
                            <>
                                <Skeleton className="h-20 rounded-2xl" />
                                <Skeleton className="h-20 rounded-2xl" />
                            </>
                        ) : groups.slice(0, 3).map((group) => (
                            <div key={group.group} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-semibold">{group.group}</div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            {group.models.length} {t('portal.dashboard.models')}
                                        </div>
                                    </div>
                                    <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                        x{group.price_multiplier.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">{t('portal.dashboard.latestKeys')}</CardTitle>
                        <Link to="/keys">
                            <Button variant="ghost" size="sm" className="rounded-2xl">
                                {t('portal.dashboard.viewAll')}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {keysLoading ? (
                            <>
                                <Skeleton className="h-20 rounded-2xl" />
                                <Skeleton className="h-20 rounded-2xl" />
                            </>
                        ) : keys.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                                {t('portal.dashboard.noKeys')}
                            </div>
                        ) : keys.map((key) => (
                            <div key={key.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="font-semibold">{key.name}</div>
                                        <div className="mt-1 text-sm text-muted-foreground">{key.group}</div>
                                    </div>
                                    <div className="text-right text-xs text-muted-foreground">
                                        {format(new Date(key.created_at), 'yyyy-MM-dd HH:mm')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Link to="/groups">
                    <Card className="rounded-[28px] border-white/70 bg-white/80 transition hover:-translate-y-0.5 hover:shadow-[0_28px_56px_-42px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-white/5">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                                <Layers3 className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="font-semibold">{t('portal.dashboard.toGroups')}</div>
                                <div className="text-sm text-muted-foreground">{t('portal.dashboard.groupHint')}</div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/keys">
                    <Card className="rounded-[28px] border-white/70 bg-white/80 transition hover:-translate-y-0.5 hover:shadow-[0_28px_56px_-42px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-white/5">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                                <KeyRound className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="font-semibold">{t('portal.dashboard.toKeys')}</div>
                                <div className="text-sm text-muted-foreground">{t('portal.dashboard.keyHint')}</div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/logs">
                    <Card className="rounded-[28px] border-white/70 bg-white/80 transition hover:-translate-y-0.5 hover:shadow-[0_28px_56px_-42px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-white/5">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                                <ScrollText className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="font-semibold">{t('portal.dashboard.toLogs')}</div>
                                <div className="text-sm text-muted-foreground">{t('portal.dashboard.logHint')}</div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </section>
        </div>
    )
}
