import { Building2, Layers3, RotateCcw, Search, Sparkles } from 'lucide-react'
import { type ComponentType, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserPortalGroups } from '@/feature/user-portal/hooks'
import { cn } from '@/lib/utils'

interface ModelAccessGroup {
    availableSets: string[]
    group: string
    priceMultiplier: number
}

interface ModelCardItem {
    accessGroups: ModelAccessGroup[]
    capabilities: string[]
    model: string
    provider: string
}

const CAPABILITY_ORDER = ['text', 'reasoning', 'vision', 'image', 'audio', 'video', 'coding', 'embedding', 'rerank'] as const

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

const inferCapabilities = (model: string) => {
    const normalized = model.toLowerCase()
    const capabilities = new Set<string>()

    const isEmbedding = /(embedding|text-embedding|bge|gte|e5)/.test(normalized)
    const isRerank = /(rerank|reranker)/.test(normalized)
    const isImage = /(gpt-image|dall|image|imagen|flux|stable-diffusion|sdxl|sd-)/.test(normalized)
    const isAudio = /(audio|speech|tts|whisper|voice|realtime|transcribe)/.test(normalized)
    const isVideo = /(video|veo|sora|wanx)/.test(normalized)
    const isVision = /(vision|vl|omni|gpt-4o|gemini|claude|pixtral|llava)/.test(normalized)
    const isReasoning = /(^o1($|-)|^o3($|-)|^o4($|-)|reason|thinking|r1|sonnet-4|opus-4)/.test(normalized)
    const isCoding = /(coder|codestral|devstral|codegen|codegemma|qwen.*coder|deepseek-coder)/.test(normalized)

    if (isVision) capabilities.add('vision')
    if (isReasoning) capabilities.add('reasoning')
    if (isImage) capabilities.add('image')
    if (isAudio) capabilities.add('audio')
    if (isVideo) capabilities.add('video')
    if (isCoding) capabilities.add('coding')
    if (isEmbedding) capabilities.add('embedding')
    if (isRerank) capabilities.add('rerank')

    if ((!isEmbedding && !isRerank && !isImage && !isAudio && !isVideo) || isVision || isReasoning || isCoding) {
        capabilities.add('text')
    }

    return [...capabilities].sort((left, right) => {
        const leftIndex = CAPABILITY_ORDER.indexOf(left as typeof CAPABILITY_ORDER[number])
        const rightIndex = CAPABILITY_ORDER.indexOf(right as typeof CAPABILITY_ORDER[number])

        if (leftIndex === -1 && rightIndex === -1) {
            return left.localeCompare(right)
        }
        if (leftIndex === -1) {
            return 1
        }
        if (rightIndex === -1) {
            return -1
        }

        return leftIndex - rightIndex
    })
}

interface FilterChipProps {
    active?: boolean
    children: ReactNode
    className?: string
    onClick: () => void
}

function FilterChip({
    active = false,
    children,
    className,
    onClick,
}: FilterChipProps) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
                'h-9 rounded-xl border-border/60 bg-background px-3 text-sm font-normal shadow-none hover:bg-muted/40',
                active && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/10',
                className,
            )}
            onClick={onClick}
        >
            {children}
        </Button>
    )
}

interface FilterSectionProps {
    children: ReactNode
    icon: ComponentType<{ className?: string }>
    label: string
}

function FilterSection({ children, icon: Icon, label }: FilterSectionProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {children}
            </div>
        </div>
    )
}

export default function UserPortalModelsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [keyword, setKeyword] = useState('')
    const [capabilityFilter, setCapabilityFilter] = useState('__all__')
    const [providerFilter, setProviderFilter] = useState('__all__')
    const [groupFilter, setGroupFilter] = useState('__all__')
    const { data, isLoading } = useUserPortalGroups(true)
    const groups = data?.groups || []
    const groupItems = useMemo(
        () => [...groups].sort((left, right) => left.group.localeCompare(right.group)),
        [groups],
    )

    const modelCards = useMemo<ModelCardItem[]>(() => {
        const groupedModels = new Map<string, ModelCardItem>()

        groups.forEach((group) => {
            group.models.forEach((model) => {
                const current = groupedModels.get(model) || {
                    model,
                    capabilities: inferCapabilities(model),
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

    const providerOptions = useMemo(
        () => Array.from(new Set(modelCards.map((item) => item.provider))).sort((left, right) => left.localeCompare(right)),
        [modelCards],
    )

    const capabilityOptions = useMemo(
        () => Array.from(new Set(modelCards.flatMap((item) => item.capabilities))).sort((left, right) => {
            const leftIndex = CAPABILITY_ORDER.indexOf(left as typeof CAPABILITY_ORDER[number])
            const rightIndex = CAPABILITY_ORDER.indexOf(right as typeof CAPABILITY_ORDER[number])

            if (leftIndex === -1 && rightIndex === -1) {
                return left.localeCompare(right)
            }
            if (leftIndex === -1) {
                return 1
            }
            if (rightIndex === -1) {
                return -1
            }

            return leftIndex - rightIndex
        }),
        [modelCards],
    )

    const filteredModels = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase()
        return modelCards
            .map((item) => ({
                ...item,
                accessGroups: groupFilter === '__all__'
                    ? item.accessGroups
                    : item.accessGroups.filter((group) => group.group === groupFilter),
            }))
            .filter((item) => item.accessGroups.length > 0)
            .filter((item) => providerFilter === '__all__' || item.provider === providerFilter)
            .filter((item) => capabilityFilter === '__all__' || item.capabilities.includes(capabilityFilter))
            .filter((item) => {
                if (!normalizedKeyword) {
                    return true
                }

                return (
                    item.model.toLowerCase().includes(normalizedKeyword)
                    || item.provider.toLowerCase().includes(normalizedKeyword)
                    || item.capabilities.some((capability) => (
                        capability.toLowerCase().includes(normalizedKeyword)
                        || t(`portal.models.capability.${capability}`).toLowerCase().includes(normalizedKeyword)
                    ))
                    || item.accessGroups.some((group) => (
                        group.group.toLowerCase().includes(normalizedKeyword)
                        || group.availableSets.some((setName) => setName.toLowerCase().includes(normalizedKeyword))
                    ))
                )
            })
    }, [capabilityFilter, groupFilter, keyword, modelCards, providerFilter, t])

    const hasActiveFilters = keyword.trim().length > 0 || capabilityFilter !== '__all__' || providerFilter !== '__all__' || groupFilter !== '__all__'
    const resetFilters = () => {
        setKeyword('')
        setCapabilityFilter('__all__')
        setProviderFilter('__all__')
        setGroupFilter('__all__')
    }

    return (
        <div className="w-full space-y-6">
            <Card className="gap-0 overflow-hidden rounded-[28px] border-border/60 bg-background shadow-sm">
                <CardContent className="space-y-7 px-6 py-6">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="relative w-full max-w-[320px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                                placeholder={t('portal.models.searchPlaceholder')}
                                className="h-11 rounded-2xl border-border/60 bg-background pl-10 shadow-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 self-end xl:self-auto">
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                                {t('portal.models.results', { count: filteredModels.length })}
                            </Badge>
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                                {t('portal.models.totalModels')}: {modelCards.length}
                            </Badge>
                            {hasActiveFilters && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 rounded-full border-border/60 px-4"
                                    onClick={resetFilters}
                                >
                                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                    {t('portal.models.resetFilters')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <FilterSection
                        icon={Building2}
                        label={t('portal.models.providerFilter')}
                    >
                        <FilterChip active={providerFilter === '__all__'} onClick={() => setProviderFilter('__all__')}>
                            {t('common.all')}
                        </FilterChip>
                        {providerOptions.map((provider) => (
                            <FilterChip
                                key={provider}
                                active={providerFilter === provider}
                                onClick={() => setProviderFilter(provider)}
                            >
                                {provider}
                            </FilterChip>
                        ))}
                    </FilterSection>

                    <FilterSection
                        icon={Sparkles}
                        label={t('portal.models.capabilities')}
                    >
                        <FilterChip active={capabilityFilter === '__all__'} onClick={() => setCapabilityFilter('__all__')}>
                            {t('common.all')}
                        </FilterChip>
                        {capabilityOptions.map((capability) => (
                            <FilterChip
                                key={capability}
                                active={capabilityFilter === capability}
                                onClick={() => setCapabilityFilter(capability)}
                            >
                                {t(`portal.models.capability.${capability}`)}
                            </FilterChip>
                        ))}
                    </FilterSection>

                    <FilterSection
                        icon={Layers3}
                        label={t('portal.models.groupFilterLabel')}
                    >
                        <FilterChip active={groupFilter === '__all__'} onClick={() => setGroupFilter('__all__')}>
                            {t('common.all')}
                        </FilterChip>
                        {groupItems.map((group) => (
                            <FilterChip
                                key={group.group}
                                active={groupFilter === group.group}
                                className="h-10 px-3"
                                onClick={() => setGroupFilter(group.group)}
                            >
                                <span className="flex items-center gap-2">
                                    <span>{group.group}</span>
                                    <span
                                        className={cn(
                                            'rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground',
                                            groupFilter === group.group && 'bg-primary/15 text-primary',
                                        )}
                                    >
                                        {group.models.length}
                                    </span>
                                    <span
                                        className={cn(
                                            'rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
                                            groupFilter === group.group && 'bg-primary/15 text-primary',
                                        )}
                                    >
                                        x{group.price_multiplier.toFixed(2)}
                                    </span>
                                </span>
                            </FilterChip>
                        ))}
                    </FilterSection>
                </CardContent>
            </Card>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {isLoading ? (
                    <>
                        <Skeleton className="h-56 rounded-xl" />
                        <Skeleton className="h-56 rounded-xl" />
                        <Skeleton className="h-56 rounded-xl" />
                    </>
                ) : filteredModels.length > 0 ? filteredModels.map((item) => {
                    const highestMultiplier = Math.max(...item.accessGroups.map((group) => group.priceMultiplier))
                    const visibleSets = Array.from(new Set(item.accessGroups.flatMap((group) => group.availableSets)))
                        .sort((left, right) => left.localeCompare(right))
                    const previewSets = visibleSets.slice(0, 3)

                    return (
                        <Card key={item.model} className="gap-0 overflow-hidden border-border/60 bg-background/90 shadow-sm">
                            <CardHeader className="gap-3 px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                'h-6 rounded-full px-2.5 text-[11px]',
                                                providerFilter === item.provider && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                                            )}
                                            onClick={() => setProviderFilter(item.provider)}
                                        >
                                            {item.provider}
                                        </Button>
                                        <div className="space-y-1">
                                            <CardTitle className="break-all text-base leading-6">{item.model}</CardTitle>
                                            <CardDescription className="text-xs">
                                                {t('portal.models.groupCount', { count: item.accessGroups.length })}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Badge className="rounded-full px-2.5 py-1">
                                        x{highestMultiplier.toFixed(2)}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 px-4 pb-4">
                                <Separator />
                                <div className="space-y-2">
                                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                        {t('portal.models.capabilities')}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {item.capabilities.map((capability) => (
                                            <Button
                                                key={`${item.model}-${capability}`}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className={cn(
                                                    'h-6 rounded-full px-2 text-[11px] font-normal',
                                                    capabilityFilter === capability && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                                                )}
                                                onClick={() => setCapabilityFilter(capability)}
                                            >
                                                {t(`portal.models.capability.${capability}`)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                        {t('portal.models.accessGroups')}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {item.accessGroups.map((group) => (
                                            <Button
                                                key={`${item.model}-${group.group}`}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className={cn(
                                                    'h-6 rounded-full px-2.5 text-[11px] font-normal',
                                                    groupFilter === group.group && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                                                )}
                                                onClick={() => setGroupFilter(group.group)}
                                            >
                                                {group.group}
                                                <span className="ml-1 text-muted-foreground">x{group.priceMultiplier.toFixed(2)}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                            {previewSets.length > 0 && (
                                <CardFooter className="flex-wrap gap-1.5 border-t bg-muted/20 px-4 py-3">
                                    <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                        {t('portal.groups.sets')}
                                    </span>
                                    {previewSets.map((setName) => (
                                        <Badge
                                            key={`${item.model}-${setName}`}
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
                                        >
                                            {setName}
                                        </Badge>
                                    ))}
                                    {visibleSets.length > previewSets.length && (
                                        <Badge
                                            variant="outline"
                                            className="rounded-full px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
                                        >
                                            +{visibleSets.length - previewSets.length}
                                        </Badge>
                                    )}
                                </CardFooter>
                            )}
                        </Card>
                    )
                }) : (
                    <Card className="gap-0 border-border/60 bg-background/80 shadow-sm md:col-span-2 xl:col-span-3 2xl:col-span-4">
                        <CardContent className="flex min-h-44 flex-col items-center justify-center space-y-3 p-8 text-center">
                            <div className="text-lg font-semibold">{t('portal.models.emptyTitle')}</div>
                            <p className="max-w-xl text-sm text-muted-foreground">{t('portal.models.emptyDescription')}</p>
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    )
}
