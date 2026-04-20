import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserPortalGroups } from '@/feature/user-portal/hooks'

export default function UserPortalGroupsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const { data, isLoading } = useUserPortalGroups(true)
    const groups = data?.groups || []

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="space-y-2">
                    <div className="text-sm text-primary">{t('portal.groups.badge')}</div>
                    <h1 className="text-3xl font-semibold tracking-tight">{t('portal.groups.title')}</h1>
                    <p className="max-w-3xl text-muted-foreground">{t('portal.groups.description')}</p>
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                {isLoading ? (
                    <>
                        <Skeleton className="h-56 rounded-[28px]" />
                        <Skeleton className="h-56 rounded-[28px]" />
                    </>
                ) : groups.map((group) => (
                    <Card key={group.group} className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl">{group.group}</CardTitle>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    {t('portal.groups.sets')}: {group.available_sets.join(', ') || '-'}
                                </div>
                            </div>
                            <Badge variant="outline" className="border-transparent bg-primary/12 px-3 py-1 text-primary">
                                x{group.price_multiplier.toFixed(2)}
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm font-medium">{t('portal.groups.models')}</div>
                            <div className="flex flex-wrap gap-2">
                                {group.models.map((model) => (
                                    <Badge
                                        key={`${group.group}-${model}`}
                                        variant="outline"
                                        className="rounded-full border-border/70 bg-background/80 px-3 py-1"
                                    >
                                        {model}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </section>
        </div>
    )
}
