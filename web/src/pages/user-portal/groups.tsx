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
        <div className="space-y-4 sm:space-y-6">
            <section className="rounded-md border border-border bg-background p-3 shadow-none dark:border-white/10 sm:p-4">
                <div className="space-y-2">
                    <div className="text-sm text-primary">{t('portal.groups.badge')}</div>
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('portal.groups.title')}</h1>
                    <p className="max-w-3xl text-muted-foreground">{t('portal.groups.description')}</p>
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                {isLoading ? (
                    <>
                        <Skeleton className="h-56 rounded-md" />
                        <Skeleton className="h-56 rounded-md" />
                    </>
                ) : groups.map((group) => (
                    <Card key={group.group} className="rounded-md border-border bg-background shadow-none dark:border-white/10">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl">{group.group}</CardTitle>
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
                                        className="rounded-md border-border bg-background px-3 py-1"
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
