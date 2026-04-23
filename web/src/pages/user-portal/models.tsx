import { Building2, Info, Layers3, RotateCcw, Search, Sparkles } from 'lucide-react'
import { type ComponentType, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUserPortalGroups } from '@/feature/user-portal/hooks'
import type { ModelPrice } from '@/types/model'
import type { UserPortalGroupModelOption } from '@/types/user-portal'
import { cn } from '@/lib/utils'

interface ModelAccessGroup {
    availableSets: string[]
    group: string
    imagePrices?: Record<string, number>
    imageQualityPrices?: Record<string, Record<string, number>>
    price?: ModelPrice
    priceMultiplier: number
}

interface ModelCardItem {
    accessGroups: ModelAccessGroup[]
    capabilities: string[]
    model: string
    provider: string
}

const CAPABILITY_ORDER = ['text', 'reasoning', 'vision', 'image', 'audio', 'video', 'coding', 'embedding', 'rerank'] as const
const DEFAULT_PRICE_UNIT = 1000

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

const formatPriceNumber = (value: number) => {
    const digits = Math.abs(value) >= 1 ? 4 : 6
    return Number(value.toFixed(digits)).toString()
}

const formatPriceValue = (price?: number, unit?: number) => {
    if (price == null) {
        return null
    }

    return `${formatPriceNumber(price)} / ${unit || DEFAULT_PRICE_UNIT}`
}

const buildImagePriceEntries = (
    imagePrices?: Record<string, number>,
    imageQualityPrices?: Record<string, Record<string, number>>,
): Array<{ label: string, value: string }> => {
    const entries: Array<{ label: string, value: string }> = []

    if (imageQualityPrices) {
        const sizes = Object.keys(imageQualityPrices).sort((left, right) => left.localeCompare(right))
        for (const size of sizes) {
            const qualityPrices = imageQualityPrices[size]
            if (!qualityPrices) {
                continue
            }

            for (const quality of Object.keys(qualityPrices).sort((left, right) => left.localeCompare(right))) {
                entries.push({
                    label: `${size} ${quality}`,
                    value: `${formatPriceNumber(qualityPrices[quality])} / img`,
                })
            }
        }
    }

    if (entries.length > 0) {
        return entries
    }

    if (!imagePrices) {
        return entries
    }

    for (const size of Object.keys(imagePrices).sort((left, right) => left.localeCompare(right))) {
        entries.push({
            label: size,
            value: `${formatPriceNumber(imagePrices[size])} / img`,
        })
    }

    return entries
}

const scalePriceNumber = (value: number | undefined, multiplier: number) => {
    if (value == null) {
        return undefined
    }

    if (!multiplier || multiplier === 1) {
        return value
    }

    return value / multiplier
}

const scalePriceMap = (prices?: Record<string, number>, multiplier = 1) => {
    if (!prices || Object.keys(prices).length === 0) {
        return undefined
    }

    return Object.fromEntries(
        Object.entries(prices).map(([key, value]) => [key, scalePriceNumber(value, multiplier) || 0]),
    )
}

const scaleImageQualityPriceMap = (prices?: Record<string, Record<string, number>>, multiplier = 1) => {
    if (!prices || Object.keys(prices).length === 0) {
        return undefined
    }

    return Object.fromEntries(
        Object.entries(prices).map(([size, qualityPrices]) => [
            size,
            Object.fromEntries(
                Object.entries(qualityPrices).map(([quality, value]) => [quality, scalePriceNumber(value, multiplier) || 0]),
            ),
        ]),
    )
}

const scaleModelPrice = (price?: ModelPrice, multiplier = 1): ModelPrice | undefined => {
    if (!price) {
        return undefined
    }

    return {
        ...price,
        input_price: scalePriceNumber(price.input_price, multiplier),
        output_price: scalePriceNumber(price.output_price, multiplier),
        per_request_price: scalePriceNumber(price.per_request_price, multiplier),
        cached_price: scalePriceNumber(price.cached_price, multiplier),
        cache_creation_price: scalePriceNumber(price.cache_creation_price, multiplier),
        image_input_price: scalePriceNumber(price.image_input_price, multiplier),
        image_output_price: scalePriceNumber(price.image_output_price, multiplier),
        audio_input_price: scalePriceNumber(price.audio_input_price, multiplier),
        thinking_mode_output_price: scalePriceNumber(price.thinking_mode_output_price, multiplier),
        web_search_price: scalePriceNumber(price.web_search_price, multiplier),
        conditional_prices: price.conditional_prices?.map((item) => ({
            condition: item.condition,
            price: scaleModelPrice(item.price, multiplier) || ({} as ModelPrice),
        })),
    }
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
    const [selectedModel, setSelectedModel] = useState<ModelCardItem | null>(null)
    const { data, isLoading } = useUserPortalGroups(true)
    const groups = data?.groups || []
    const groupItems = useMemo(
        () => [...groups].sort((left, right) => left.group.localeCompare(right.group)),
        [groups],
    )

    const modelCards = useMemo<ModelCardItem[]>(() => {
        const groupedModels = new Map<string, ModelCardItem>()

        groups.forEach((group) => {
            const modelDetailMap = new Map<string, UserPortalGroupModelOption>(
                (group.model_details || []).map((detail) => [detail.model.toLowerCase(), detail]),
            )

            group.models.forEach((model) => {
                const current = groupedModels.get(model) || {
                    model,
                    capabilities: inferCapabilities(model),
                    provider: inferProvider(model),
                    accessGroups: [],
                }
                const modelDetail = modelDetailMap.get(model.toLowerCase())

                current.accessGroups.push({
                    group: group.group,
                    priceMultiplier: group.price_multiplier,
                    availableSets: [...group.available_sets].sort((left, right) => left.localeCompare(right)),
                    price: modelDetail?.price,
                    imagePrices: modelDetail?.image_prices,
                    imageQualityPrices: modelDetail?.image_quality_prices,
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

    const getCompactPriceEntries = (accessGroup: ModelAccessGroup) => {
        const price = accessGroup.price
        const entries: Array<{ label: string, value: string }> = []

        if (price) {
            const candidates: Array<{ key: string, value: string | null }> = [
                { key: 'input', value: formatPriceValue(price.input_price, price.input_price_unit) },
                { key: 'output', value: formatPriceValue(price.output_price, price.output_price_unit) },
                { key: 'request', value: price.per_request_price != null ? formatPriceNumber(price.per_request_price) : null },
                { key: 'cached', value: formatPriceValue(price.cached_price, price.cached_price_unit) },
                { key: 'cacheCreate', value: formatPriceValue(price.cache_creation_price, price.cache_creation_price_unit) },
                { key: 'imageInput', value: formatPriceValue(price.image_input_price, price.image_input_price_unit) },
                { key: 'imageOutput', value: formatPriceValue(price.image_output_price, price.image_output_price_unit) },
                { key: 'audioInput', value: formatPriceValue(price.audio_input_price, price.audio_input_price_unit) },
                { key: 'thinkingOutput', value: formatPriceValue(price.thinking_mode_output_price, price.thinking_mode_output_price_unit) },
                { key: 'webSearch', value: formatPriceValue(price.web_search_price, price.web_search_price_unit) },
            ]

            candidates.forEach((candidate) => {
                if (!candidate.value) {
                    return
                }

                entries.push({
                    label: t(`portal.models.price.${candidate.key}`),
                    value: candidate.value,
                })
            })
        }

        if (entries.length > 0) {
            return entries
        }

        return buildImagePriceEntries(accessGroup.imagePrices, accessGroup.imageQualityPrices).map((entry) => ({
            label: `${t('portal.models.price.imageSize')} ${entry.label}`,
            value: entry.value,
        }))
    }

    const getBaseAccessGroup = (item: ModelCardItem) => {
        const exactBase = item.accessGroups.find((group) => Math.abs(group.priceMultiplier - 1) < 0.0001)
        if (exactBase) {
            return exactBase
        }

        const pricedGroup = item.accessGroups.find((group) => group.price || group.imagePrices || group.imageQualityPrices)
        if (!pricedGroup) {
            return undefined
        }

        return {
            ...pricedGroup,
            priceMultiplier: 1,
            price: scaleModelPrice(pricedGroup.price, pricedGroup.priceMultiplier),
            imagePrices: scalePriceMap(pricedGroup.imagePrices, pricedGroup.priceMultiplier),
            imageQualityPrices: scaleImageQualityPriceMap(pricedGroup.imageQualityPrices, pricedGroup.priceMultiplier),
        }
    }

    const getBasePriceEntries = (item: ModelCardItem) => {
        const baseAccessGroup = getBaseAccessGroup(item)
        if (!baseAccessGroup) {
            return []
        }

        return getCompactPriceEntries(baseAccessGroup)
    }

    const getGroupPricingTableData = (accessGroup: ModelAccessGroup) => {
        const price = accessGroup.price
        const imageEntries = buildImagePriceEntries(accessGroup.imagePrices, accessGroup.imageQualityPrices)
        const input = formatPriceValue(price?.input_price, price?.input_price_unit)
            || formatPriceValue(price?.image_input_price, price?.image_input_price_unit)
            || formatPriceValue(price?.audio_input_price, price?.audio_input_price_unit)

        let output = formatPriceValue(price?.output_price, price?.output_price_unit)
            || formatPriceValue(price?.image_output_price, price?.image_output_price_unit)
            || formatPriceValue(price?.thinking_mode_output_price, price?.thinking_mode_output_price_unit)

        const request = price?.per_request_price != null ? formatPriceNumber(price.per_request_price) : null

        const extraEntries: Array<{ label: string, value: string }> = []
        const extraCandidates: Array<{ key: string, value: string | null }> = [
            { key: 'cached', value: formatPriceValue(price?.cached_price, price?.cached_price_unit) },
            { key: 'cacheCreate', value: formatPriceValue(price?.cache_creation_price, price?.cache_creation_price_unit) },
            { key: 'webSearch', value: formatPriceValue(price?.web_search_price, price?.web_search_price_unit) },
        ]

        extraCandidates.forEach((candidate) => {
            if (!candidate.value) {
                return
            }

            extraEntries.push({
                label: t(`portal.models.price.${candidate.key}`),
                value: candidate.value,
            })
        })

        if (!output && imageEntries.length > 0) {
            output = imageEntries[0].value
            extraEntries.push(...imageEntries.slice(1))
        } else if (imageEntries.length > 0) {
            extraEntries.push(...imageEntries)
        }

        return {
            input: input || t('portal.models.noPrice'),
            output: output || t('portal.models.noPrice'),
            request: request || t('portal.models.noPrice'),
            extras: extraEntries,
        }
    }

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

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {isLoading ? (
                    <>
                        <Skeleton className="h-40 rounded-xl" />
                        <Skeleton className="h-40 rounded-xl" />
                        <Skeleton className="h-40 rounded-xl" />
                    </>
                ) : filteredModels.length > 0 ? filteredModels.map((item) => {
                    const priceEntries = getBasePriceEntries(item)
                    const visiblePriceEntries = priceEntries.slice(0, 4)
                    const hiddenPriceCount = Math.max(0, priceEntries.length - visiblePriceEntries.length)
                    const previewCapabilities = item.capabilities.slice(0, 3)
                    const hiddenCapabilityCount = Math.max(0, item.capabilities.length - previewCapabilities.length)
                    const previewGroups = item.accessGroups.slice(0, 2)
                    const hiddenGroupCount = Math.max(0, item.accessGroups.length - previewGroups.length)

                    return (
                        <Card
                            key={item.model}
                            role="button"
                            tabIndex={0}
                            className="gap-0 overflow-hidden border-border/60 bg-background/90 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                            onClick={() => setSelectedModel(item)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    setSelectedModel(item)
                                }
                            }}
                        >
                            <CardHeader className="gap-2 px-3.5 py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 space-y-1.5">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                'h-5 rounded-full px-2 text-[10px]',
                                                providerFilter === item.provider && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                                            )}
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                setProviderFilter(item.provider)
                                            }}
                                        >
                                            {item.provider}
                                        </Button>
                                        <CardTitle className="break-all text-sm leading-5">{item.model}</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                                        1x
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2.5 px-3.5 pb-3.5 pt-0">
                                <div className="flex flex-wrap gap-1">
                                    {previewCapabilities.map((capability) => (
                                        <Button
                                            key={`${item.model}-${capability}`}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                'h-5 rounded-full px-2 text-[10px] font-normal',
                                                capabilityFilter === capability && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                                            )}
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                setCapabilityFilter(capability)
                                            }}
                                        >
                                            {t(`portal.models.capability.${capability}`)}
                                        </Button>
                                    ))}
                                    {hiddenCapabilityCount > 0 && (
                                        <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] font-normal">
                                            +{hiddenCapabilityCount}
                                        </Badge>
                                    )}
                                </div>

                                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            {t('portal.models.basePricing')}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            {t('portal.models.usageBilling')}
                                        </div>
                                    </div>
                                    {visiblePriceEntries.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {visiblePriceEntries.map((entry) => (
                                                <div
                                                    key={`${item.model}-${entry.label}`}
                                                    className="rounded-lg border border-border/40 bg-background/70 px-2 py-1"
                                                >
                                                    <div className="text-[10px] text-muted-foreground">{entry.label}</div>
                                                    <div className="truncate text-[11px] font-medium">{entry.value}</div>
                                                </div>
                                            ))}
                                            {hiddenPriceCount > 0 && (
                                                <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-background/40 px-2 py-1 text-[10px] text-muted-foreground">
                                                    {t('portal.models.morePrices', { count: hiddenPriceCount })}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-muted-foreground">-</div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1">
                                    {previewGroups.map((group) => (
                                        <Button
                                            key={`${item.model}-${group.group}`}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                'h-5 rounded-full px-2 text-[10px] font-normal',
                                                groupFilter === group.group && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                                            )}
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                setGroupFilter(group.group)
                                            }}
                                        >
                                            {group.group}
                                            <span className="ml-1 text-muted-foreground">x{group.priceMultiplier.toFixed(2)}</span>
                                        </Button>
                                    ))}
                                    {hiddenGroupCount > 0 && (
                                        <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] font-normal">
                                            +{hiddenGroupCount}
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription className="text-[11px] text-muted-foreground">
                                    {t('portal.models.groupCount', { count: item.accessGroups.length })}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    )
                }) : (
                    <Card className="gap-0 border-border/60 bg-background/80 shadow-sm md:col-span-2 xl:col-span-5">
                        <CardContent className="flex min-h-44 flex-col items-center justify-center space-y-3 p-8 text-center">
                            <div className="text-lg font-semibold">{t('portal.models.emptyTitle')}</div>
                            <p className="max-w-xl text-sm text-muted-foreground">{t('portal.models.emptyDescription')}</p>
                        </CardContent>
                    </Card>
                )}
            </section>

            <Sheet open={!!selectedModel} onOpenChange={(open) => !open && setSelectedModel(null)}>
                <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl">
                    {selectedModel && (
                        <>
                            <SheetHeader className="border-b border-border/60 px-6 py-5">
                                <div className="space-y-1 pr-8">
                                    <SheetTitle className="text-2xl tracking-tight">{selectedModel.model}</SheetTitle>
                                    <SheetDescription>{selectedModel.provider}</SheetDescription>
                                </div>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-6">
                                <div className="space-y-6">
                                    <section className="space-y-3">
                                        <div className="flex items-center gap-2 text-base font-semibold">
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                            <span>{t('portal.models.infoSection')}</span>
                                        </div>
                                        <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                                            <div className="grid gap-4 md:grid-cols-3">
                                                <div className="space-y-1">
                                                    <div className="text-sm text-muted-foreground">{t('portal.models.providerFilter')}</div>
                                                    <div className="font-medium">{selectedModel.provider}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-sm text-muted-foreground">{t('portal.models.billingType')}</div>
                                                    <Badge className="rounded-full px-2.5 py-1">
                                                        {t('portal.models.usageBilling')}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-sm text-muted-foreground">{t('portal.models.accessGroups')}</div>
                                                    <div className="font-medium">{selectedModel.accessGroups.length}</div>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-1.5">
                                                {selectedModel.capabilities.map((capability) => (
                                                    <Badge key={`${selectedModel.model}-sheet-${capability}`} variant="outline" className="rounded-full px-2 py-0.5">
                                                        {t(`portal.models.capability.${capability}`)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-3">
                                        <div className="text-base font-semibold">{t('portal.models.basePricing')}</div>
                                        <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                                            <div className="mb-3 text-sm text-muted-foreground">
                                                {t('portal.models.detailDescription')}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {getBasePriceEntries(selectedModel).length > 0 ? getBasePriceEntries(selectedModel).map((entry) => (
                                                    <div
                                                        key={`${selectedModel.model}-base-${entry.label}`}
                                                        className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                                                    >
                                                        <div className="text-[11px] text-muted-foreground">{entry.label}</div>
                                                        <div className="text-sm font-medium">{entry.value}</div>
                                                    </div>
                                                )) : (
                                                    <div className="text-sm text-muted-foreground">{t('portal.models.noPrice')}</div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-3">
                                        <div className="text-base font-semibold">{t('portal.models.groupPricing')}</div>
                                        <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/80">
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="px-4">{t('portal.models.groupColumn')}</TableHead>
                                                        <TableHead>{t('portal.models.inputColumn')}</TableHead>
                                                        <TableHead>{t('portal.models.outputColumn')}</TableHead>
                                                        <TableHead>{t('portal.models.requestColumn')}</TableHead>
                                                        <TableHead className="px-4">{t('portal.models.otherColumn')}</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedModel.accessGroups.map((group) => {
                                                        const pricing = getGroupPricingTableData(group)

                                                        return (
                                                            <TableRow key={`${selectedModel.model}-sheet-${group.group}`}>
                                                                <TableCell className="px-4 align-top">
                                                                    <div className="space-y-1">
                                                                        <Badge variant="outline" className="rounded-full px-2 py-0.5">
                                                                            {group.group}
                                                                        </Badge>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            x{group.priceMultiplier.toFixed(2)}
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="align-top text-sm">{pricing.input}</TableCell>
                                                                <TableCell className="align-top text-sm">{pricing.output}</TableCell>
                                                                <TableCell className="align-top text-sm">{pricing.request}</TableCell>
                                                                <TableCell className="px-4 align-top">
                                                                    {pricing.extras.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1.5 py-1">
                                                                            {pricing.extras.map((entry) => (
                                                                                <Badge
                                                                                    key={`${selectedModel.model}-${group.group}-${entry.label}`}
                                                                                    variant="outline"
                                                                                    className="rounded-full px-2 py-0.5 text-[11px] font-normal"
                                                                                >
                                                                                    {entry.label}: {entry.value}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-sm text-muted-foreground">{t('portal.models.noPrice')}</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
