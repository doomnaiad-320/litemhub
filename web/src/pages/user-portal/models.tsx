import { Blocks, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserPortalGroups } from '@/feature/user-portal/hooks'

interface ModelAccessGroup {
    availableSets: string[]
    group: string
    priceMultiplier: number
}

interface ModelCardItem {
    accessGroups: ModelAccessGroup[]
    model: string
    provider: string
}

const inferProvider = (model: string) => {
    const normalized = model.toLowerCase()

    if (normalized.startsWith('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4')) {
        return 'OpenAI'
    }
    if (normalized.startsWith('claude')) {
        return 'Anthropic'
    }
    if (normalized.startsWith('gemini')) {
        return 'Google'
    }
    if (normalized.startsWith('grok')) {
        return 'xAI'
    }
    if (normalized.startsWith('qwen')) {
        return 'Qwen'
    }
    if (normalized.startsWith('deepseek')) {
        return 'DeepSeek'
    }
    if (normalized.startsWith('kimi')) {
        return 'Moonshot'
    }
    if (normalized.startsWith('glm')) {
        return 'Zhipu'
    }
    if (normalized.startsWith('doubao')) {
        return 'Doubao'
    }
    if (normalized.startsWith('llama')) {
        return 'Meta'
    }
    if (normalized.startsWith('mistral')) {
        return 'Mistral'
    }

    return 'Model'
}

export default function UserPortalModelsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [keyword, setKeyword] = useState('')
    const { data, isLoading } = useUserPortalGroups(true)
    const groups = data?.groups || []

    const modelCards = useMemo<ModelCardItem[]>(() => {
        const groupedModels = new Map<string, ModelCardItem>()

        groups.forEach((group) => {
            group.models.forEach((model) => {
                const current = groupedModels.get(model) || {
                    model,
                    provider: inferProvider(model),
                    accessGroups: [],
                }

                current.accessGroups.push({
                    group: group.group,
                    priceMultiplier: group.price_multiplier,
                    availableSets: [...group.available_sets].sort((left, right) => left.localeCompare(right)),
                })

                groupedModels.set(model, current)
            })
        })

        return Array.from(groupedModels.values())
            .map((item) => ({
                ...item,
                accessGroups: item.accessGroups.sort((left, right) => {
                    if (left.priceMultiplier === right.priceMultiplier) {
                        return left.group.localeCompare(right.group)
                    }

                    return left.priceMultiplier - right.priceMultiplier
                }),
            }))
            .sort((left, right) => left.model.localeCompare(right.model))
    }, [groups])

    const filteredModels = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase()
        if (!normalizedKeyword) {
            return modelCards
        }

        return modelCards.filter((item) => (
            item.model.toLowerCase().includes(normalizedKeyword)
            || item.provider.toLowerCase().includes(normalizedKeyword)
            || item.accessGroups.some((group) => (
                group.group.toLowerCase().includes(normalizedKeyword)
                || group.availableSets.some((setName) => setName.toLowerCase().includes(normalizedKeyword))
            ))
        ))
    }, [keyword, modelCards])

    const maxMultiplier = useMemo(() => {
        if (groups.length === 0) {
            return 0
        }

        return Math.max(...groups.map((group) => group.price_multiplier))
    }, [groups])

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-3">
                        <div className="text-sm text-primary">{t('portal.models.badge')}</div>
                        <h1 className="text-3xl font-semibold tracking-tight">{t('portal.models.title')}</h1>
                        <p className="max-w-3xl text-muted-foreground">{t('portal.models.description')}</p>
                        <div className="inline-flex max-w-3xl items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                            <Blocks className="h-4 w-4 text-primary" />
                            <span>{t('portal.models.billingFormula')}</span>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <Card className="min-w-[180px] rounded-[24px] border-white/70 bg-white/85 shadow-none dark:border-white/10 dark:bg-white/5">
                            <CardContent className="space-y-2 p-5">
                                <div className="text-sm text-muted-foreground">{t('portal.models.totalModels')}</div>
                                <div className="text-3xl font-semibold tracking-tight">{modelCards.length}</div>
                            </CardContent>
                        </Card>
                        <Card className="min-w-[180px] rounded-[24px] border-white/70 bg-white/85 shadow-none dark:border-white/10 dark:bg-white/5">
                            <CardContent className="space-y-2 p-5">
                                <div className="text-sm text-muted-foreground">{t('portal.models.totalGroups')}</div>
                                <div className="text-3xl font-semibold tracking-tight">{groups.length}</div>
                            </CardContent>
                        </Card>
                        <Card className="min-w-[180px] rounded-[24px] border-white/70 bg-white/85 shadow-none dark:border-white/10 dark:bg-white/5">
                            <CardContent className="space-y-2 p-5">
                                <div className="text-sm text-muted-foreground">{t('portal.models.maxMultiplier')}</div>
                                <div className="text-3xl font-semibold tracking-tight">x{maxMultiplier.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="relative mt-6 max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder={t('portal.models.searchPlaceholder')}
                        className="h-11 rounded-2xl border-border/70 bg-background/80 pl-11"
                    />
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {isLoading ? (
                    <>
                        <Skeleton className="h-80 rounded-[28px]" />
                        <Skeleton className="h-80 rounded-[28px]" />
                        <Skeleton className="h-80 rounded-[28px]" />
                    </>
                ) : filteredModels.length > 0 ? filteredModels.map((item) => {
                    const highestMultiplier = Math.max(...item.accessGroups.map((group) => group.priceMultiplier))

                    return (
                        <Card key={item.model} className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                            <CardHeader className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-3">
                                        <Badge variant="outline" className="w-fit rounded-full border-transparent bg-primary/12 px-3 py-1 text-primary">
                                            {item.provider}
                                        </Badge>
                                        <div>
                                            <CardTitle className="break-all text-xl">{item.model}</CardTitle>
                                            <p className="mt-2 text-sm text-muted-foreground">
                                                {t('portal.models.groupCount', { count: item.accessGroups.length })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
                                        <div className="text-xs text-muted-foreground">{t('portal.models.highestMultiplier')}</div>
                                        <div className="text-lg font-semibold text-primary">x{highestMultiplier.toFixed(2)}</div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="text-sm font-medium">{t('portal.models.accessGroups')}</div>
                                <div className="grid gap-3">
                                    {item.accessGroups.map((group) => (
                                        <div
                                            key={`${item.model}-${group.group}`}
                                            className="rounded-2xl border border-border/60 bg-background/70 p-4"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-medium">{group.group}</div>
                                                <Badge variant="outline" className="rounded-full border-transparent bg-primary/12 px-3 py-1 text-primary">
                                                    x{group.priceMultiplier.toFixed(2)}
                                                </Badge>
                                            </div>
                                            {group.availableSets.length > 0 && (
                                                <div className="mt-3 text-xs leading-5 text-muted-foreground">
                                                    {t('portal.groups.sets')}: {group.availableSets.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )
                }) : (
                    <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5 xl:col-span-2 2xl:col-span-3">
                        <CardContent className="flex min-h-52 flex-col items-center justify-center space-y-3 p-8 text-center">
                            <div className="text-lg font-semibold">{t('portal.models.emptyTitle')}</div>
                            <p className="max-w-xl text-sm text-muted-foreground">{t('portal.models.emptyDescription')}</p>
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    )
}
