// src/feature/channel/components/ChannelForm.tsx
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { channelCreateSchema } from '@/validation/channel'
import { useChannelTypeMetas, useCreateChannel, useUpdateChannel, useUpdateChannelStatus, useTestChannel, useTestChannelPreviewAll, useChannelDefaultModels, useDiscoverChannelModels } from '../hooks'
import { useModels } from '@/feature/model/hooks'
import { useGroups } from '@/feature/group/hooks'
import { useTranslation } from 'react-i18next'
import { ChannelCreateForm } from '@/validation/channel'
import { ModelDialog } from '@/feature/model/components/ModelDialog'
import { Channel, ChannelDiscoveredModel } from '@/types/channel'
import { SingleSelectCombobox } from '@/components/select/SingleSelectCombobox'
import { MultiSelectCombobox } from '@/components/select/MultiSelectCombobox'
import { ConstructMappingComponent } from '@/components/select/ConstructMappingComponent'
import { AdvancedErrorDisplay } from '@/components/common/error/errorDisplay'
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedContainer } from '@/components/ui/animation/components/animated-container'
import { toast } from 'sonner'
import { DownloadCloud, FlaskConical, Loader2, Info, Power, PowerOff, Search } from 'lucide-react'
import { ChannelTestDialog } from './ChannelTestDialog'
import { DefaultModelsDialog } from './DefaultModelsDialog'
import { ChannelConfigEditor } from './ChannelConfigEditor'
import { useRuntimeMetrics } from '@/feature/monitor/runtime-hooks'
import { getChannelModelMetric } from '@/utils/runtime-metrics'
import { DEFAULT_PRIORITY } from '@/types/channel'

type ComparableChannelPayload = {
    type: number
    name: string
    key: string
    base_url: string
    proxy_url: string
    models: string[]
    model_mapping: Record<string, string>
    sets: string[]
    priority: number
    skip_tls_verify: boolean
    enabled_no_permission_ban: boolean
    warn_error_rate?: number
    max_error_rate?: number
    configs?: Record<string, unknown>
}

const stableSerialize = (value: unknown): string => {
    if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(',')}]`
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`)
        return `{${entries.join(',')}}`
    }

    return JSON.stringify(value) ?? 'undefined'
}

const normalizeChannelPayload = (
    payload: Partial<ComparableChannelPayload> & {
        type: number
        name: string
        key: string
    }
): ComparableChannelPayload => ({
    type: payload.type,
    name: payload.name,
    key: payload.key,
    base_url: payload.base_url ?? '',
    proxy_url: payload.proxy_url ?? '',
    models: payload.models ?? [],
    model_mapping: payload.model_mapping ?? {},
    sets: [...(payload.sets ?? [])].sort((left, right) => left.localeCompare(right)),
    priority: payload.priority ?? DEFAULT_PRIORITY,
    skip_tls_verify: payload.skip_tls_verify ?? false,
    enabled_no_permission_ban: payload.enabled_no_permission_ban ?? false,
    warn_error_rate: payload.warn_error_rate ?? undefined,
    max_error_rate: payload.max_error_rate && payload.max_error_rate > 0
        ? payload.max_error_rate
        : undefined,
    configs: payload.configs ?? undefined,
})

const normalizeModelName = (modelName: string) => modelName.trim()

const buildModelNameSet = (models?: Array<{ model: string }>) => {
    const names = new Set<string>()
    for (const model of models || []) {
        const modelName = normalizeModelName(model.model)
        if (modelName) {
            names.add(modelName)
        }
    }

    return names
}

interface ChannelFormProps {
    mode?: 'create' | 'update' | 'copy'
    channelId?: number
    channel?: Channel | null
    onSuccess?: () => void
    defaultValues?: {
        type: number
        name: string
        key: string
        base_url?: string
        proxy_url?: string
        models: string[]
        model_mapping?: Record<string, string>
        sets?: string[]
        priority?: number
        skip_tls_verify?: boolean
        enabled_no_permission_ban?: boolean
        warn_error_rate?: number
        max_error_rate?: number
        configs_text?: string
    }
}

export function ChannelForm({
    mode = 'create',
    channelId,
    channel,
    onSuccess,
    defaultValues = {
        type: 0,
        name: '',
        key: '',
        base_url: '',
        proxy_url: '',
        models: [],
        model_mapping: {},
        sets: [],
        priority: 10,
        skip_tls_verify: false,
        enabled_no_permission_ban: false,
        warn_error_rate: undefined,
        max_error_rate: undefined,
    },
}: ChannelFormProps) {
    const { t } = useTranslation()
    const [modelDialogOpen, setModelDialogOpen] = useState(false)
    const [isUserSubmitting, setIsUserSubmitting] = useState(false)
    const isCreateLikeMode = mode === 'create' || mode === 'copy'
    const [defaultModelsDialogOpen, setDefaultModelsDialogOpen] = useState(false)
    const [configsError, setConfigsError] = useState<string | null>(null)
    const [currentStatus, setCurrentStatus] = useState(channel?.status ?? 1)
    const [discoveredModels, setDiscoveredModels] = useState<ChannelDiscoveredModel[]>([])
    const [selectedDiscoveredModels, setSelectedDiscoveredModels] = useState<Record<string, boolean>>({})
    const [discoveredDialogOpen, setDiscoveredDialogOpen] = useState(false)
    const [discoveredSearch, setDiscoveredSearch] = useState('')

    // Determine initial useDefaultModels state
    const initialUseDefault = mode === 'create'
        ? true
        : (!defaultValues.models || defaultValues.models.length === 0)
    const [useDefaultModels, setUseDefaultModels] = useState(initialUseDefault)

    // 获取渠道类型元数据
    const { data: typeMetas, isLoading: isTypeMetasLoading } = useChannelTypeMetas()

    // 获取所有模型
    const { data: models, isLoading: isModelsLoading, refetch: refetchModels } = useModels()
    const { data: groupsData } = useGroups(1, 1000)

    // API hooks
    const {
        createChannel,
        isLoading: isCreating,
        error: createError,
        clearError: clearCreateError
    } = useCreateChannel()

    const {
        updateChannel,
        isLoading: isUpdating,
        error: updateError,
        clearError: clearUpdateError
    } = useUpdateChannel()

    const { discoverModels, isDiscovering } = useDiscoverChannelModels()

    const { updateStatus, isLoading: isStatusUpdating } = useUpdateChannelStatus()

    // Test channel hook
    const {
        testChannel: testSavedChannel,
        cancelTest: cancelSavedChannelTest,
        isTesting: isSavedChannelTesting,
        results: savedChannelTestResults,
        clearResults: clearSavedChannelTestResults
    } = useTestChannel()

    const {
        testChannelPreviewAll,
        cancelTest: cancelPreviewChannelTest,
        isTesting: isPreviewChannelTesting,
        results: previewChannelTestResults,
        clearResults: clearPreviewChannelTestResults
    } = useTestChannelPreviewAll()

    const [testDialogOpen, setTestDialogOpen] = useState(false)
    const [activeTestMode, setActiveTestMode] = useState<'saved' | 'preview' | null>(null)

    useEffect(() => {
        setCurrentStatus(channel?.status ?? 1)
    }, [channel?.status, channel?.id])

    // 动态状态
    const isLoading = isCreateLikeMode ? isCreating : isUpdating
    const error = isCreateLikeMode ? createError : updateError
    const clearError = isCreateLikeMode ? clearCreateError : clearUpdateError
    const isTesting = isSavedChannelTesting || isPreviewChannelTesting
    const testResults = activeTestMode === 'saved' ? savedChannelTestResults : previewChannelTestResults

    // 表单设置
    const form = useForm<ChannelCreateForm>({
        resolver: zodResolver(channelCreateSchema),
        defaultValues: {
            ...defaultValues,
            useDefaultModels: initialUseDefault,
        },
    })

    const watchedType = form.watch('type')
    // Fetch default models for the selected channel type
    const { data: defaultModelsData, isLoading: isDefaultModelsLoading } = useChannelDefaultModels(watchedType)
    const { data: runtimeMetrics } = useRuntimeMetrics()

    const hasDefaults = !!(defaultModelsData?.models && defaultModelsData.models.length > 0)
    const formatPercent = (value?: number) => `${((value || 0) * 100).toFixed(1)}%`

    // Effective flag follows user's selected mode even when no defaults exist yet.
    const effectiveUseDefault = useDefaultModels

    const openDefaultModelsEditor = () => {
        if (!watchedType) return
        setDefaultModelsDialogOpen(true)
    }

    const parseConfigsText = (rawConfigs?: string) => {
        const trimmedConfigs = rawConfigs?.trim()
        if (!trimmedConfigs) {
            return undefined
        }

        try {
            const parsed = JSON.parse(trimmedConfigs) as unknown
            if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
                const message = t('channel.dialog.configsJsonObjectError')
                setConfigsError(message)
                toast.error(message)
                return null
            }

            return parsed as Record<string, unknown>
        } catch {
            const message = t('channel.dialog.configsJsonInvalid')
            setConfigsError(message)
            toast.error(message)
            return null
        }
    }

    const clearDiscoveredModels = () => {
        setDiscoveredModels([])
        setSelectedDiscoveredModels({})
        setDiscoveredDialogOpen(false)
        setDiscoveredSearch('')
    }

    // 防止意外的表单提交
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.target !== e.currentTarget) {
            // 如果不是在提交按钮上按 Enter，则阻止默认行为
            const target = e.target as HTMLElement
            if (target.tagName !== 'BUTTON' || (target as HTMLButtonElement).type !== 'submit') {
                e.preventDefault()
            }
        }
    }

    // 表单提交处理
    const handleFormSubmit = (data: ChannelCreateForm) => {
        // 只有在用户主动提交时才处理
        if (!isUserSubmitting) {
            return
        }

        setIsUserSubmitting(false) // 重置状态

        // 清除之前的错误
        if (clearError) clearError()
        setConfigsError(null)

        let parsedConfigs: Record<string, unknown> | undefined
        const rawConfigs = data.configs_text?.trim()
        if (rawConfigs) {
            try {
                const parsed = JSON.parse(rawConfigs) as unknown
                if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
                    setConfigsError(t('channel.dialog.configsJsonObjectError'))
                    return
                }
                parsedConfigs = parsed as Record<string, unknown>
            } catch {
                setConfigsError(t('channel.dialog.configsJsonInvalid'))
                return
            }
        }

        // 准备提交数据 - when using defaults, send empty models/mapping
        const formData = {
            type: data.type,
            name: data.name,
            key: data.key,
            base_url: data.base_url || '',
            proxy_url: data.proxy_url || '',
            models: effectiveUseDefault ? [] : (data.models || []),
            model_mapping: effectiveUseDefault ? {} : (data.model_mapping || {}),
            sets: data.sets || [],
            priority: data.priority,
            skip_tls_verify: data.skip_tls_verify ?? false,
            enabled_no_permission_ban: data.enabled_no_permission_ban ?? false,
            warn_error_rate: data.warn_error_rate,
            max_error_rate: data.max_error_rate ?? 0,
            configs: parsedConfigs
        }

        if (isCreateLikeMode) {
            createChannel(formData, {
                onSuccess: () => {
                    form.reset()
                    if (onSuccess) onSuccess()
                },
            })
        } else if (mode === 'update') {
            if (!channelId) {
                toast.error('更新失败：缺少渠道ID');
                return;
            }

            updateChannel({
                id: channelId,
                data: formData
            }, {
                onSuccess: () => {
                    form.reset()
                    if (onSuccess) onSuccess()
                },
            })
        }
    }

    // 处理提交按钮点击
    const handleSubmitClick = () => {
        setIsUserSubmitting(true)
    }

    const handleStatusToggle = () => {
        if (mode !== 'update' || !channelId) {
            return
        }

        const nextStatus = currentStatus === 2 ? 1 : 2
        updateStatus(
            { id: channelId, status: { status: nextStatus } },
            {
                onSuccess: () => {
                    setCurrentStatus(nextStatus)
                },
            }
        )
    }

    // Handle toggle between default and custom models
    const handleToggleDefaultModels = (useDefault: boolean) => {
        setUseDefaultModels(useDefault)
        form.setValue('useDefaultModels', useDefault)

        if (useDefault) {
            // Switching to default: clear models and mapping
            form.setValue('models', [])
            form.setValue('model_mapping', {})
        } else {
            // Switching to custom: pre-populate with defaults if available
            if (defaultModelsData?.models && defaultModelsData.models.length > 0) {
                form.setValue('models', [...defaultModelsData.models])
                if (defaultModelsData.mapping && Object.keys(defaultModelsData.mapping).length > 0) {
                    form.setValue('model_mapping', { ...defaultModelsData.mapping })
                }
            }
        }
    }

    const handleDiscoverModels = async () => {
        const values = form.getValues()
        setConfigsError(null)

        if (!values.type) {
            toast.error('请先选择厂商')
            return
        }
        if (!values.key) {
            toast.error('请先填写密钥')
            return
        }

        const parsedConfigs = parseConfigsText(values.configs_text)
        if (parsedConfigs === null) {
            return
        }

        let result
        try {
            result = await discoverModels({
                type: values.type,
                key: values.key,
                base_url: values.base_url || '',
                proxy_url: values.proxy_url || '',
                skip_tls_verify: values.skip_tls_verify ?? false,
                configs: parsedConfigs,
            })
        } catch {
            return
        }

        let latestModels = models
        try {
            const refreshedModels = await refetchModels()
            latestModels = refreshedModels.data || latestModels
        } catch {
            latestModels = models
        }

        const modelNameSet = buildModelNameSet(latestModels)
        const discovered = (result.models || []).map((item) => ({
            ...item,
            exists: item.exists || modelNameSet.has(normalizeModelName(item.model)),
        }))
        const currentModelSet = new Set((values.models || []).map(normalizeModelName))

        setDiscoveredModels(discovered)
        setSelectedDiscoveredModels(Object.fromEntries(
            discovered.map((item) => [
                item.upstream_model,
                !currentModelSet.has(normalizeModelName(item.model)),
            ])
        ))
        setDiscoveredSearch('')
        setDiscoveredDialogOpen(true)
        if (effectiveUseDefault) {
            setUseDefaultModels(false)
            form.setValue('useDefaultModels', false)
        }
        toast.success(`获取到 ${discovered.length} 个模型`)
    }

    const handleImportDiscoveredModels = () => {
        const selectedModels = discoveredModels
            .filter((item) => selectedDiscoveredModels[item.upstream_model] && item.model.trim())

        if (selectedModels.length === 0) {
            toast.error('请选择要导入的模型')
            return
        }

        const currentModels = form.getValues('models') || []
        const currentMapping = form.getValues('model_mapping') || {}
        const nextModels = [...currentModels]
        const nextMapping = { ...currentMapping }
        const nextModelSet = new Set(nextModels.map(normalizeModelName))

        selectedModels.forEach((item) => {
            const modelName = normalizeModelName(item.model)
            if (!nextModelSet.has(modelName)) {
                nextModels.push(modelName)
                nextModelSet.add(modelName)
            }
            delete nextMapping[modelName]
        })

        setUseDefaultModels(false)
        form.setValue('useDefaultModels', false)
        form.setValue('models', nextModels)
        form.setValue('model_mapping', nextMapping)
        setDiscoveredDialogOpen(false)
        toast.success(`已导入 ${selectedModels.length} 个模型`)
    }

    const isChannelFormUnchanged = (
        formData: ChannelCreateForm,
        parsedConfigs?: Record<string, unknown>
    ) => {
        if (mode !== 'update' || !channel) {
            return false
        }

        const currentPayload = normalizeChannelPayload({
            type: formData.type,
            name: formData.name,
            key: formData.key,
            base_url: formData.base_url || '',
            proxy_url: formData.proxy_url || '',
            models: effectiveUseDefault ? [] : (formData.models || []),
            model_mapping: effectiveUseDefault ? {} : (formData.model_mapping || {}),
            sets: formData.sets || [],
            priority: formData.priority,
            skip_tls_verify: formData.skip_tls_verify ?? false,
            enabled_no_permission_ban: formData.enabled_no_permission_ban ?? false,
            warn_error_rate: formData.warn_error_rate,
            max_error_rate: formData.max_error_rate,
            configs: parsedConfigs,
        })

        const originalPayload = normalizeChannelPayload({
            type: channel.type,
            name: channel.name,
            key: channel.key,
            base_url: channel.base_url || '',
            proxy_url: channel.proxy_url || '',
            models: channel.models || [],
            model_mapping: channel.model_mapping || {},
            sets: channel.sets && channel.sets.length > 0
                ? channel.sets
                : (channel.group ? [channel.group] : []),
            priority: channel.priority,
            skip_tls_verify: channel.skip_tls_verify ?? false,
            enabled_no_permission_ban: channel.enabled_no_permission_ban ?? false,
            warn_error_rate: channel.warn_error_rate,
            max_error_rate: channel.max_error_rate,
            configs: channel.configs || undefined,
        })

        return stableSerialize(currentPayload) === stableSerialize(originalPayload)
    }

    // 处理测试按钮点击
    const handleTestClick = () => {
        const formData = form.getValues()
        setConfigsError(null)

        // 验证必填字段
        if (!formData.type) {
            toast.error('请先选择厂商')
            return
        }
        if (!formData.key) {
            toast.error('请先填写密钥')
            return
        }

        // When using defaults, use default models for testing
        const testModels = effectiveUseDefault
            ? (defaultModelsData?.models || [])
            : (formData.models || [])
        const testMapping = effectiveUseDefault
            ? (defaultModelsData?.mapping || {})
            : (formData.model_mapping || {})

        if (testModels.length === 0) {
            toast.error('请先选择要测试的模型')
            return
        }

        let parsedConfigs: Record<string, unknown> | undefined
        const rawConfigs = formData.configs_text?.trim()
        if (rawConfigs) {
            try {
                const parsed = JSON.parse(rawConfigs) as unknown
                if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
                    const message = t('channel.dialog.configsJsonObjectError')
                    setConfigsError(message)
                    toast.error(message)
                    return
                }
                parsedConfigs = parsed as Record<string, unknown>
            } catch {
                const message = t('channel.dialog.configsJsonInvalid')
                setConfigsError(message)
                toast.error(message)
                return
            }
        }

        setTestDialogOpen(true)
        const useSavedChannelTest = mode === 'update' && !!channelId && isChannelFormUnchanged(formData, parsedConfigs)

        if (useSavedChannelTest && channelId) {
            setActiveTestMode('saved')
            clearSavedChannelTestResults()
            testSavedChannel(channelId)
            return
        }

        setActiveTestMode('preview')
        clearPreviewChannelTestResults()
        testChannelPreviewAll({
            type: formData.type,
            key: formData.key,
            base_url: formData.base_url || '',
            proxy_url: formData.proxy_url || '',
            name: formData.name || '',
            models: testModels,
            model_mapping: testMapping,
            skip_tls_verify: formData.skip_tls_verify ?? false,
            configs: parsedConfigs
        })
    }

    // 处理取消测试
    const handleCancelTest = () => {
        if (activeTestMode === 'saved') {
            cancelSavedChannelTest()
        } else {
            cancelPreviewChannelTest()
        }
        setTestDialogOpen(false)
    }

    // 获取类型对应的字段提示
    const getTypeHelp = (typeId: number) => {
        if (!typeMetas || !typeId) return { keyHelp: '', defaultBaseUrl: '' }
        return typeMetas[typeId] || { keyHelp: '', defaultBaseUrl: '' }
    }

    // 表单骨架屏渲染
    const renderFormSkeleton = () => (
        <div className="space-y-6 animate-pulse">
            {/* 厂商字段骨架 */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-full" />
            </div>

            {/* 名称字段骨架 */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-9 w-full" />
            </div>

            {/* 模型选择字段骨架 */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-[72px] w-full rounded-md" />
            </div>

            {/* 模型映射字段骨架 */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-32 w-full" />
            </div>

            {/* 分组字段骨架 */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* 密钥字段骨架 */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-full" />
            </div>

            {/* 代理地址字段骨架 */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-9 w-full" />
            </div>

            {/* 提交按钮骨架 */}
            <div className="flex justify-end">
                <Skeleton className="h-9 w-24" />
            </div>
        </div>
    )

    // Render the default models read-only preview (only called when hasDefaults is true)
    const renderDefaultModelsPreview = () => {
        if (!hasDefaults) {
            return (
                <div className="space-y-3">
                    <div className="rounded-lg border border-dashed border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-700/60 dark:bg-amber-950/20">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                            {t('channel.dialog.defaultModelsEmpty')}
                        </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">
                            {t('channel.dialog.defaultModelsManageHint')}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={openDefaultModelsEditor}
                        >
                            {t('channel.dialog.configureDefaultModels')}
                        </Button>
                    </div>
                </div>
            )
        }

        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-dashed border-primary/20 bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Info className="h-3.5 w-3.5" />
                            {t('channel.dialog.defaultModelsHint')}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={openDefaultModelsEditor}
                        >
                            {t('channel.dialog.configureDefaultModels')}
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {defaultModelsData!.models.map((model) => (
                            <button
                                key={model}
                                type="button"
                                onClick={openDefaultModelsEditor}
                                className="inline-flex items-center rounded-md border border-transparent bg-secondary px-2 py-0.5 text-xs font-mono text-secondary-foreground transition-colors hover:border-primary/30 hover:bg-secondary/80"
                                title={t('channel.dialog.configureDefaultModels')}
                            >
                                <span>{model}</span>
                                {(() => {
                                    const pair = getChannelModelMetric(runtimeMetrics, channelId, model)
                                    const modelMetric = runtimeMetrics?.models?.[model]
                                    if (!pair && !modelMetric) return null
                                    const metric = pair || modelMetric
                                    return (
                                        <span className="ml-2 inline-flex items-center gap-1 text-[10px]">
                                            <span>RPM {metric?.rpm || 0}</span>
                                            <span>TPM {metric?.tpm || 0}</span>
                                            <span>ERR {formatPercent(metric?.error_rate)}</span>
                                            {pair?.banned && (
                                                <span className="rounded bg-destructive/10 px-1 py-0.5 text-destructive">
                                                    {t('channel.temporarilyExcluded')}
                                                </span>
                                            )}
                                        </span>
                                    )
                                })()}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Show default mapping if exists */}
                {defaultModelsData!.mapping && Object.keys(defaultModelsData!.mapping).length > 0 && (
                    <div className="space-y-2">
                        <FormLabel className="text-sm">{t('channel.dialog.defaultModelMapping')}</FormLabel>
                        <button
                            type="button"
                            onClick={openDefaultModelsEditor}
                            className="block w-full rounded-lg border border-dashed border-primary/20 bg-muted/30 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
                        >
                            <div className="space-y-1">
                                {Object.entries(defaultModelsData!.mapping).map(([from, to]) => (
                                    <div key={from} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                                        <span>{from}</span>
                                        <span className="text-muted-foreground/50">&rarr;</span>
                                        <span>{to}</span>
                                    </div>
                                ))}
                            </div>
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // Render the model mode toggle — only when defaults exist for this type
    const renderModelModeToggle = () => {
        if (watchedType === 0) return null
        if (isDefaultModelsLoading) return <Skeleton className="h-10 w-full rounded-lg" />

        return (
            <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
                <button
                    type="button"
                    onClick={() => handleToggleDefaultModels(true)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                        effectiveUseDefault
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('channel.dialog.useDefaultModels')}
                </button>
                <button
                    type="button"
                    onClick={() => handleToggleDefaultModels(false)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                        !effectiveUseDefault
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('channel.dialog.customModels')}
                </button>
            </div>
        )
    }

    const renderDiscoveredModelsDialog = () => {
        const query = discoveredSearch.trim().toLowerCase()
        const filteredModels = query
            ? discoveredModels.filter((item) => item.model.toLowerCase().includes(query))
            : discoveredModels
        const selectedCount = discoveredModels.filter((item) => selectedDiscoveredModels[item.upstream_model]).length
        const visibleSelectedCount = filteredModels.filter((item) => selectedDiscoveredModels[item.upstream_model]).length
        const allVisibleSelected = filteredModels.length > 0 && visibleSelectedCount === filteredModels.length

        const toggleVisibleModels = (checked: boolean) => {
            setSelectedDiscoveredModels((prev) => {
                const next = { ...prev }
                filteredModels.forEach((item) => {
                    next[item.upstream_model] = checked
                })
                return next
            })
        }

        return (
            <Dialog open={discoveredDialogOpen} onOpenChange={setDiscoveredDialogOpen}>
                <DialogContent className="max-h-[80vh] overflow-hidden p-0 sm:max-w-[50vw]">
                    <DialogHeader className="border-b px-5 py-4">
                        <DialogTitle>选择模型</DialogTitle>
                        <DialogDescription>
                            已获取 {discoveredModels.length} 个模型，已选择 {selectedCount} 个。已在模型列表中的同名模型会复用现有价格配置。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 px-5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={discoveredSearch}
                                onChange={(event) => setDiscoveredSearch(event.target.value)}
                                placeholder="搜索模型"
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toggleVisibleModels(!allVisibleSelected)}
                                disabled={filteredModels.length === 0}
                            >
                                {allVisibleSelected ? '取消当前结果' : '选择当前结果'}
                            </Button>
                            <Badge variant="secondary">{filteredModels.length} 个结果</Badge>
                        </div>
                    </div>
                    <div className="mx-5 max-h-[48vh] overflow-y-auto rounded-md border">
                        {filteredModels.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                没有匹配的模型
                            </div>
                        ) : (
                            filteredModels.map((item) => {
                                const checked = !!selectedDiscoveredModels[item.upstream_model]
                                return (
                                    <label
                                        key={item.upstream_model}
                                        className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/40"
                                    >
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={checked}
                                            onChange={(event) => {
                                                setSelectedDiscoveredModels((prev) => ({
                                                    ...prev,
                                                    [item.upstream_model]: event.target.checked,
                                                }))
                                            }}
                                        />
                                        <span className="min-w-0 flex-1 truncate font-mono text-sm">
                                            {item.model}
                                        </span>
                                        {item.exists ? (
                                            <Badge variant="secondary" className="shrink-0">
                                                已在模型列表
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="shrink-0">
                                                新模型
                                            </Badge>
                                        )}
                                        {item.exists && (
                                            <Badge variant="outline" className="shrink-0">
                                                {item.priced ? '已定价' : '未定价'}
                                            </Badge>
                                        )}
                                    </label>
                                )
                            })
                        )}
                    </div>
                    <DialogFooter className="border-t px-5 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDiscoveredDialogOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            type="button"
                            onClick={handleImportDiscoveredModels}
                            disabled={selectedCount === 0}
                        >
                            导入选中
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <AnimatedContainer>
            <div>
                {isTypeMetasLoading || !typeMetas || isModelsLoading || !models ? (
                    renderFormSkeleton()
                ) : (
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(handleFormSubmit)}
                            onKeyDown={handleKeyDown}
                            className="space-y-6"
                        >
                            {/* API错误提示 */}
                            {error && (
                                <AdvancedErrorDisplay error={error} />
                            )}

                            {/* 厂商字段 */}
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => {

                                    const availableChannels = Object.values(typeMetas).map(
                                        (type) => type.name
                                    )

                                    const initSelectedItem = field.value
                                        ? typeMetas[String(field.value)].name
                                        : undefined

                                    const getKeyByName = (name: string): string | undefined => {
                                        for (const key in typeMetas) {
                                            if (typeMetas[key].name === name) {
                                                return key
                                            }
                                        }
                                        return undefined
                                    }

                                    return (

                                        <SingleSelectCombobox
                                            dropdownItems={availableChannels}
                                            initSelectedItem={initSelectedItem}
                                            setSelectedItem={(channelName: string) => {
                                                if (channelName) {
                                                    const channelType = getKeyByName(channelName)
                                                    if (channelType) {
                                                        field.onChange(Number(channelType))
                                                        form.setValue('models', [])
                                                        form.setValue('model_mapping', {})
                                                        clearDiscoveredModels()
                                                        setUseDefaultModels(true)
                                                        form.setValue('useDefaultModels', true)
                                                    }
                                                }
                                            }}
                                            handleDropdownItemFilter={(
                                                dropdownItems: string[],
                                                inputValue: string
                                            ) => {
                                                const lowerCasedInput = inputValue.toLowerCase()

                                                return dropdownItems.filter((item) => {
                                                    return (
                                                        !inputValue ||
                                                        item.toLowerCase().includes(lowerCasedInput)
                                                    )
                                                })

                                            }}
                                            handleDropdownItemDisplay={(
                                                dropdownItem: string
                                            ) => {
                                                return (
                                                    dropdownItem
                                                )
                                            }}
                                        />
                                    )
                                }}
                            />

                            {/* Readme */}
                            {(() => {
                                const typeId = Number(form.watch('type'))
                                const meta = typeId ? typeMetas[String(typeId)] : null
                                if (!meta?.readme) return null
                                return (
                                    <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground whitespace-pre-line">
                                        {meta.readme}
                                    </div>
                                )
                            })()}

                            {/* 名称字段 */}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("channel.dialog.name")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t("channel.dialog.namePlaceholder")} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* 模型选择字段 - with default/custom toggle */}
                            {watchedType > 0 && (
                                <div className="space-y-3">
                                    <FormLabel>{t("channel.dialog.models")}</FormLabel>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <div className="flex-1">
                                            {renderModelModeToggle()}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDiscoverModels}
                                            disabled={isDiscovering}
                                            className="shrink-0"
                                        >
                                            {isDiscovering ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <DownloadCloud className="mr-2 h-4 w-4" />
                                            )}
                                            获取模型
                                        </Button>
                                    </div>

                                    {effectiveUseDefault ? (
                                        renderDefaultModelsPreview()
                                    ) : (
                                        <>
                                            <FormField
                                                control={form.control}
                                                name="models"
                                                render={({ field }) => {
                                                    const allModels = models.map((model) => model.model)

                                                    const handleModelFilteredDropdownItems = (
                                                        dropdownItems: string[],
                                                        selectedItems: string[],
                                                        inputValue: string
                                                    ) => {
                                                        const lowerCasedInputValue = inputValue.toLowerCase()

                                                        // 过滤匹配的模型
                                                        const filteredModels = dropdownItems.filter(
                                                            (item) =>
                                                                !selectedItems.includes(item) &&
                                                                item.toLowerCase().includes(lowerCasedInputValue)
                                                        )

                                                        // 始终添加"创建新模型"选项作为第一个选项
                                                        const createNewOption = t('model.dialog.createDescription')

                                                        // 只在搜索为空或选项匹配"创建"相关文字时显示创建选项
                                                        if (!inputValue || createNewOption.toLowerCase().includes(lowerCasedInputValue)) {
                                                            return [createNewOption, ...filteredModels]
                                                        }

                                                        return filteredModels
                                                    }

                                                    return (
                                                        <MultiSelectCombobox<string>
                                                            dropdownItems={allModels}
                                                            selectedItems={field.value || []}
                                                            setSelectedItems={(modelsOrFunction) => {
                                                                const nextModels = typeof modelsOrFunction === 'function'
                                                                    ? modelsOrFunction(field.value || [])
                                                                    : modelsOrFunction
                                                                const models = Array.isArray(nextModels) ? nextModels : []

                                                                // Now we can use includes safely
                                                                if (models.includes(t('model.dialog.createDescription'))) {
                                                                    const filteredModels = models.filter(m => m !== t('model.dialog.createDescription'))
                                                                    field.onChange(filteredModels)
                                                                    setModelDialogOpen(true)
                                                                } else {
                                                                    field.onChange(models)
                                                                }
                                                            }}
                                                            handleFilteredDropdownItems={handleModelFilteredDropdownItems}
                                                            handleDropdownItemDisplay={(item: string) => {
                                                                // 为"创建新模型"选项添加特殊样式
                                                                if (item === t('model.dialog.createDescription')) {
                                                                    return (
                                                                        <div className="flex items-center gap-2 text-primary">
                                                                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-primary">
                                                                                <span className="text-xs">+</span>
                                                                            </span>
                                                                            {item}
                                                                        </div>
                                                                    )
                                                                }
                                                                const pair = getChannelModelMetric(runtimeMetrics, channelId, item)
                                                                const modelMetric = runtimeMetrics?.models?.[item]
                                                                const metric = pair || modelMetric
                                                                return (
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span>{item}</span>
                                                                        {metric && (
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                RPM {metric.rpm} · TPM {metric.tpm} · ERR {formatPercent(metric.error_rate)}
                                                                            </span>
                                                                        )}
                                                                        {pair?.banned && (
                                                                            <span className="text-[10px] font-medium text-destructive">
                                                                                {t('channel.highErrorRateExcluded')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )
                                                            }}
                                                            handleSelectedItemDisplay={(item: string) => {
                                                                const pair = getChannelModelMetric(runtimeMetrics, channelId, item)
                                                                const modelMetric = runtimeMetrics?.models?.[item]
                                                                const metric = pair || modelMetric
                                                                return (
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span>{item}</span>
                                                                        {metric && (
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                RPM {metric.rpm} · TPM {metric.tpm} · ERR {formatPercent(metric.error_rate)}
                                                                            </span>
                                                                        )}
                                                                        {pair?.banned && (
                                                                            <span className="text-[10px] font-medium text-destructive">
                                                                                {t('channel.highErrorRateExcluded')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )
                                                            }}
                                                        />
                                                    )
                                                }}
                                            />

                                            {/* 模型映射字段 */}
                                            <FormField
                                                control={form.control}
                                                name="model_mapping"
                                                render={({ field }) => {
                                                    const selectedModels = form.watch('models')

                                                    return (
                                                        <ConstructMappingComponent
                                                            mapKeys={selectedModels}
                                                            mapData={field.value as Record<string, string>}
                                                            setMapData={(mapping) => {
                                                                field.onChange(mapping)
                                                            }}
                                                        />
                                                    )
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* 分组字段 */}
                            <FormField
                                control={form.control}
                                name="sets"
                                render={({ field }) => {
                                    const groupOptions = (groupsData?.groups || []).map((group) => group.id)
                                    const groupMultiplierMap = new Map(
                                        (groupsData?.groups || []).map((group) => [group.id, group.price_multiplier || 1]),
                                    )

                                    return (
                                        <FormItem>
                                            <FormLabel>{t("channel.dialog.group")}</FormLabel>
                                            <FormControl>
                                                <MultiSelectCombobox<string>
                                                    dropdownItems={groupOptions}
                                                    selectedItems={field.value || []}
                                                    setSelectedItems={(groupsOrFunction) => {
                                                        const nextGroups = typeof groupsOrFunction === 'function'
                                                            ? groupsOrFunction(field.value || [])
                                                            : groupsOrFunction
                                                        field.onChange(Array.isArray(nextGroups) ? nextGroups : [])
                                                    }}
                                                    handleFilteredDropdownItems={(dropdownItems, selectedItems, inputValue) => {
                                                        const lowerCasedInputValue = inputValue.toLowerCase()
                                                        return dropdownItems.filter((item) => (
                                                            !selectedItems.includes(item)
                                                            && item.toLowerCase().includes(lowerCasedInputValue)
                                                        ))
                                                    }}
                                                    handleDropdownItemDisplay={(item) => (
                                                        <span>{item} (x{(groupMultiplierMap.get(item) || 1).toFixed(2)})</span>
                                                    )}
                                                    handleSelectedItemDisplay={(item) => (
                                                        <span>{item} (x{(groupMultiplierMap.get(item) || 1).toFixed(2)})</span>
                                                    )}
                                                    placeholder={t("channel.dialog.groupPlaceholder")}
                                                    label={t("channel.dialog.group")}
                                                />
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t("channel.dialog.groupHelp")}
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />

                            {/* 密钥字段 */}
                            <FormField
                                control={form.control}
                                name="key"
                                render={({ field }) => {
                                    const typeId = Number(form.getValues('type'))
                                    const { keyHelp } = getTypeHelp(typeId)

                                    return (
                                        <FormItem>
                                            <FormLabel>{t("channel.dialog.key")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={keyHelp || t("channel.dialog.keyPlaceholder")}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="configs_text"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormLabel>{t("channel.dialog.configs")}</FormLabel>
                                            <span className="text-xs text-muted-foreground">{t("common.optional")}</span>
                                        </div>
                                        <FormControl>
                                            <div>
                                                <ChannelConfigEditor
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                    meta={watchedType > 0 ? typeMetas[String(watchedType)] : null}
                                                    error={configsError}
                                                />
                                            </div>
                                        </FormControl>
                                        {configsError && (
                                            <p className="text-sm font-medium text-destructive">{configsError}</p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* 代理地址字段 */}
                            <FormField
                                control={form.control}
                                name="base_url"
                                render={({ field }) => {
                                    const typeId = Number(form.getValues('type'))
                                    const { defaultBaseUrl } = getTypeHelp(typeId)
                                    const hasCustomUrl = !!(field.value && field.value.trim())

                                    return (
                                        <FormItem>
                                            <div className="flex items-center gap-2">
                                                <FormLabel>{t("channel.dialog.baseUrl")}</FormLabel>
                                                <span className="text-xs text-muted-foreground">{t("common.optional")}</span>
                                            </div>
                                            <FormControl>
                                                <Input
                                                    placeholder={defaultBaseUrl || t("channel.dialog.baseUrlPlaceholder")}
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                            {hasCustomUrl && defaultBaseUrl && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {t("channel.dialog.defaultBaseUrl")}: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{defaultBaseUrl}</code>
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t("channel.dialog.baseUrlOptionalHelp")}
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="proxy_url"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormLabel>{t("channel.dialog.proxyUrl")}</FormLabel>
                                            <span className="text-xs text-muted-foreground">{t("common.optional")}</span>
                                        </div>
                                        <FormControl>
                                            <Input
                                                placeholder={t("channel.dialog.proxyUrlPlaceholder")}
                                                {...field}
                                                value={field.value || ''}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t("channel.dialog.proxyUrlHelp")}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="skip_tls_verify"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border bg-muted/10 p-4">
                                        <div className="space-y-1">
                                            <FormLabel>{t('channel.dialog.skipTlsVerify')}</FormLabel>
                                            <p className="text-xs text-muted-foreground">
                                                {t('channel.dialog.skipTlsVerifyHelp')}
                                            </p>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value ?? false}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* 优先级字段 */}
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormLabel>{t("channel.dialog.priority")}</FormLabel>
                                            <span className="text-xs text-muted-foreground">{t("common.optional")}</span>
                                        </div>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={1000000}
                                                placeholder={t("channel.dialog.priorityPlaceholder")}
                                                {...field}
                                                value={field.value ?? ''}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    if (value === '') {
                                                        field.onChange(undefined)
                                                    } else {
                                                        field.onChange(parseInt(value, 10))
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t("channel.dialog.priorityHelp")}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid gap-4 md:grid-cols-2 rounded-lg border bg-muted/20 p-4">
                                <FormField
                                    control={form.control}
                                    name="enabled_no_permission_ban"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between gap-4 md:col-span-2">
                                            <div className="space-y-1">
                                                <FormLabel>{t('channel.dialog.enabledNoPermissionBan')}</FormLabel>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('channel.dialog.enabledNoPermissionBanHelp')}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('channel.temporarilyExcludedHelp')}
                                                </p>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value ?? false}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="warn_error_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('channel.dialog.warnErrorRate')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    placeholder={t('channel.dialog.warnErrorRatePlaceholder')}
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => field.onChange(
                                                        e.target.value === '' ? undefined : Number(e.target.value)
                                                    )}
                                                />
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground">
                                                {t('channel.dialog.warnErrorRateHelp')}
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="max_error_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('channel.dialog.maxErrorRate')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    placeholder={t('channel.dialog.maxErrorRatePlaceholder')}
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={(e) => field.onChange(
                                                        e.target.value === '' ? undefined : Number(e.target.value)
                                                    )}
                                                />
                                                </FormControl>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('channel.dialog.maxErrorRateHelp')}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('channel.temporarilyExcludedHelp')}
                                                </p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                />
                            </div>

                            {/* 提交和测试按钮 */}
                            <div className="flex justify-between items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleTestClick}
                                        disabled={isTesting || isLoading || isStatusUpdating}
                                        className="flex items-center gap-2"
                                    >
                                        {isTesting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {t("channel.testing")}
                                            </>
                                        ) : (
                                            <>
                                                <FlaskConical className="h-4 w-4" />
                                                {t("channel.test")}
                                            </>
                                        )}
                                    </Button>
                                    {mode === 'update' && channelId ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleStatusToggle}
                                            disabled={isLoading || isTesting || isStatusUpdating}
                                            className="flex items-center gap-2"
                                        >
                                            {isStatusUpdating ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {currentStatus === 2 ? t("channel.enable") : t("channel.disable")}
                                                </>
                                            ) : currentStatus === 2 ? (
                                                <>
                                                    <Power className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                                                    {t("channel.enable")}
                                                </>
                                            ) : (
                                                <>
                                                    <PowerOff className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                                                    {t("channel.disable")}
                                                </>
                                            )}
                                        </Button>
                                    ) : null}
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isLoading || isTesting || isStatusUpdating}
                                    onClick={handleSubmitClick}
                                >
                                    {isLoading ? t("channel.dialog.submitting") : isCreateLikeMode ? t("channel.dialog.create") : t("channel.dialog.update")}
                                </Button>
                            </div>
                        </form>
                    </Form>
                )}

                {/* 测试结果对话框 */}
                <ChannelTestDialog
                    open={testDialogOpen}
                    onOpenChange={setTestDialogOpen}
                    isTesting={isTesting}
                    results={testResults}
                    onCancel={handleCancelTest}
                />

                {/* 创建模型对话框 */}
                <ModelDialog
                    open={modelDialogOpen}
                    onOpenChange={setModelDialogOpen}
                    mode="create"
                    model={null}
                />

                <DefaultModelsDialog
                    open={defaultModelsDialogOpen}
                    onOpenChange={setDefaultModelsDialogOpen}
                    initialTypeId={watchedType || undefined}
                />

                {renderDiscoveredModelsDialog()}
            </div>
        </AnimatedContainer>
    )
}
