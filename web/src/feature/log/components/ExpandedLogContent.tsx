import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Separator } from '@/components/ui/separator'
import { JsonViewer } from './JsonViewer'
import { useLogDetail, type LogDetailScope } from '@/feature/log/hooks'
import type { LogRecord, LogRequestDetail } from '@/types/log'
import { channelApi } from '@/api/channel'
import { useChannelTypeMetas } from '@/feature/channel/hooks'
import { ChannelLabel } from '@/components/common/ChannelLabel'
import { ChannelDialog } from '@/feature/channel/components/ChannelDialog'
import type { Channel } from '@/types/channel'
import { toast } from 'sonner'
import { openResourceDialog, showDeletedResourceToast } from '@/utils/resource-dialog'

// Format price with unit
const formatPrice = (price: number, unit: number): string => {
    if (!price) return '-'
    if (unit > 0) return `${price}/${unit}`
    return price.toString()
}

const HIDDEN_REQUEST_FIELDS = new Set(['message', 'messages'])

const sanitizeRequestBodyForDisplay = (body: string | null) => {
    if (!body) {
        return null
    }

    try {
        return sanitizeObjectForDisplay(JSON.parse(body))
    } catch {
        return body
    }
}

const sanitizeObjectForDisplay = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeObjectForDisplay(item))
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !HIDDEN_REQUEST_FIELDS.has(key))
                .map(([key, item]) => [key, sanitizeObjectForDisplay(item)]),
        )
    }

    return value
}

const getAppUserAccount = (log: LogRecord) => log.app_user?.username || log.app_user?.email || log.app_user?.phone || ''

const EmbeddedContext = createContext(false)

const DetailSection = ({ title, children }: { title: string; children: ReactNode }) => {
    const embedded = useContext(EmbeddedContext)

    return (
        <section className="min-w-0 rounded-md border border-border/70 bg-card">
            <h4 className={`border-b border-border/60 font-semibold ${embedded ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}>{title}</h4>
            <div className="divide-y divide-border/60">{children}</div>
        </section>
    )
}

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => {
    const embedded = useContext(EmbeddedContext)

    return (
        <div className={`grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3 ${embedded ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-sm'}`}>
            <div className="shrink-0 text-muted-foreground">{label}</div>
            <div className="min-w-0 text-right text-foreground [overflow-wrap:anywhere]">{children}</div>
        </div>
    )
}

export const ExpandedLogContent = ({
    log,
    scope = 'admin',
    embedded = false,
}: {
    log: LogRecord
    scope?: LogDetailScope
    embedded?: boolean
}) => {
    const { t } = useTranslation()
    const isAdminScope = scope === 'admin'
    const { data: typeMetas } = useChannelTypeMetas(isAdminScope)
    const [channelInfo, setChannelInfo] = useState<{ name: string; type: number } | null>(null)
    const [channelDialogOpen, setChannelDialogOpen] = useState(false)
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null)

    const openChannelEdit = (channelId: number) => {
        openResourceDialog({
            fetcher: () => channelApi.getChannel(channelId),
            onSuccess: (channel) => {
                setEditingChannel(channel)
                setChannelDialogOpen(true)
            },
            onNotFound: () => {
                showDeletedResourceToast(t('channel.deleted'))
            },
            onError: () => {
                showDeletedResourceToast(t('channel.fetchFailed'))
            },
        })
    }

    useEffect(() => {
        if (!isAdminScope || !log.channel) return
        channelApi.getChannelBatchInfo([log.channel])
            .then(infos => {
                if (infos.length > 0) setChannelInfo({ name: infos[0].name, type: infos[0].type })
            })
            .catch(() => {})
    }, [isAdminScope, log.channel])

    const needsDetail = !!log.request_detail
    const [requestDetail, setRequestDetail] = useState<LogRequestDetail | null>(null)

    const {
        data: logDetail,
        isLoading: isLoadingDetail,
        error: logDetailError
    } = useLogDetail(needsDetail ? log.id : null, scope)

    useEffect(() => {
        if (logDetail) {
            setRequestDetail(logDetail)
        }
    }, [logDetail])

    const requestBody = needsDetail && requestDetail ? requestDetail.request_body : null
    const responseBody = needsDetail && requestDetail ? requestDetail.response_body : null
    const sanitizedRequestBody = sanitizeRequestBodyForDisplay(requestBody)
    const requestTruncated = needsDetail && requestDetail ? requestDetail.request_body_truncated : false
    const responseTruncated = needsDetail && requestDetail ? requestDetail.response_body_truncated : false
    const isLoadingData = needsDetail && isLoadingDetail
    const hasError = needsDetail && logDetailError

    const calculateDuration = () => {
        if (!log.request_at || !log.created_at) return '-'
        const requestAt = new Date(log.request_at)
        const createdAt = new Date(log.created_at)
        const duration = (createdAt.getTime() - requestAt.getTime()) / 1000
        return `${duration.toFixed(2)}s`
    }

    const amount = log.amount
    const totalUsedAmount = Number(amount?.used_amount ?? log.used_amount ?? 0)

    const formatAmount = (value?: number) => {
        if (value === undefined || value === null) return '-'
        return `$${Number(value).toFixed(6)}`
    }

    const truncateMiddle = (value?: string, left = 8, right = 8) => {
        if (!value) return '-'
        if (value.length <= left + right + 3) return value
        return `${value.slice(0, left)}...${value.slice(-right)}`
    }

    const copyToClipboard = (text?: string) => {
        if (!text) return
        navigator.clipboard.writeText(text).then(() => {
            toast.success(t('common.copied'))
        }).catch(() => {
            toast.error(t('common.copyFailed'))
        })
    }

    const renderCopyValue = (value?: string, left = 8, right = 8) => {
        if (!value) return '-'

        return (
            <button
                type="button"
                className="inline-block max-w-full cursor-pointer truncate align-bottom font-mono text-xs underline-offset-4 transition-colors hover:text-primary hover:underline"
                title={value}
                onClick={() => copyToClipboard(value)}
            >
                {truncateMiddle(value, left, right)}
            </button>
        )
    }

    return (
        <EmbeddedContext.Provider value={embedded}>
        <div className={embedded ? 'space-y-3' : 'space-y-4 border-t bg-muted/50 p-4'}>
            <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${embedded ? 'gap-2.5' : 'gap-4'}`}>
                <DetailSection title={t('log.basicInfo')}>
                    <DetailRow label={t('log.id')}>{log.id}</DetailRow>
                    <DetailRow label={t('log.requestId')}>{renderCopyValue(log.request_id, 8, 8)}</DetailRow>
                    <DetailRow label={t('log.upstreamId')}>{renderCopyValue(log.upstream_id, 10, 10)}</DetailRow>
                    <DetailRow label={t('log.promptCacheKey')}>{renderCopyValue(log.prompt_cache_key, 10, 10)}</DetailRow>
                    <DetailRow label={t('log.group')}>{log.group || '-'}</DetailRow>
                    <DetailRow label={t('log.keyName')}>{log.token_name || '-'}</DetailRow>
                    {scope === 'admin' && (
                        <DetailRow label={t('log.appUser')}>
                            {log.app_user?.id || log.owner_user_id || getAppUserAccount(log)
                                ? `#${log.app_user?.id || log.owner_user_id || '-'} ${getAppUserAccount(log) || '-'}`
                                : '-'}
                        </DetailRow>
                    )}
                    <DetailRow label={t('log.model')}>{renderCopyValue(log.model, 18, 12)}</DetailRow>
                    <DetailRow label={t('log.channel')}>
                        {log.channel ? (
                            isAdminScope ? (
                                <span className="inline-flex max-w-full justify-end">
                                    <ChannelLabel
                                        id={log.channel}
                                        info={channelInfo || undefined}
                                        typeName={channelInfo ? typeMetas?.[channelInfo.type]?.name : undefined}
                                        compact
                                        className="max-w-full"
                                        onClick={() => openChannelEdit(log.channel)}
                                    />
                                </span>
                            ) : (
                                <span className="font-mono text-xs">{log.channel}</span>
                            )
                        ) : '-'}
                    </DetailRow>
                    <DetailRow label={t('log.mode')}>{t(`modeType.${log.mode}`, { defaultValue: log.mode?.toString() || '-' })}</DetailRow>
                    <DetailRow label={t('log.statusCode')}>{log.code || '-'}</DetailRow>
                    <DetailRow label={t('log.serviceTier')}>{log.service_tier || '-'}</DetailRow>
                    <DetailRow label={t('log.user')}>{log.user || '-'}</DetailRow>
                    <DetailRow label={t('log.ip')}>{log.ip || '-'}</DetailRow>
                    <DetailRow label={t('log.endpoint')}>{log.endpoint || '-'}</DetailRow>
                    {log.content && <DetailRow label={t('log.content')}>{log.content}</DetailRow>}
                </DetailSection>

                <DetailSection title={t('log.timeInfo')}>
                    <DetailRow label={t('log.created')}>{log.created_at ? format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss') : '-'}</DetailRow>
                    <DetailRow label={t('log.request')}>{log.request_at ? format(new Date(log.request_at), 'yyyy-MM-dd HH:mm:ss') : '-'}</DetailRow>
                    <DetailRow label={t('log.duration')}>{calculateDuration()}</DetailRow>
                    {log.retry_at && <DetailRow label={t('log.retry')}>{format(new Date(log.retry_at), 'yyyy-MM-dd HH:mm:ss')}</DetailRow>}
                    <DetailRow label={t('log.retryTimes')}>{log.retry_times || 0}</DetailRow>
                    <DetailRow label={t('log.ttfb')}>{log.ttfb_milliseconds || 0}ms</DetailRow>
                </DetailSection>

                <DetailSection title={t('log.tokenInfo')}>
                    <DetailRow label={t('log.inputTokens')}>{log.usage?.input_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.outputTokens')}>{log.usage?.output_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.total')}>{log.usage?.total_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.cacheCreation')}>{log.usage?.cache_creation_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.cached')}>{log.usage?.cached_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.imageInput')}>{log.usage?.image_input_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.audioInput')}>{log.usage?.audio_input_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.videoInput')}>{log.usage?.video_input_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.imageOutput')}>{log.usage?.image_output_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.audioOutput')}>{log.usage?.audio_output_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.reasoning')}>{log.usage?.reasoning_tokens?.toLocaleString() || 0}</DetailRow>
                    <DetailRow label={t('log.webSearchCount')}>{log.usage?.web_search_count || 0}</DetailRow>
                </DetailSection>

                <DetailSection title={t('log.priceInfo')}>
                    <DetailRow label={t('log.inputPrice')}>{formatPrice(log.price?.input_price, log.price?.input_price_unit)}</DetailRow>
                    <DetailRow label={t('log.outputPrice')}>{formatPrice(log.price?.output_price, log.price?.output_price_unit)}</DetailRow>
                    <DetailRow label={t('log.cacheCreationPrice')}>{formatPrice(log.price?.cache_creation_price, log.price?.cache_creation_price_unit)}</DetailRow>
                    <DetailRow label={t('log.cachedPrice')}>{formatPrice(log.price?.cached_price, log.price?.cached_price_unit)}</DetailRow>
                    <DetailRow label={t('log.imageInputPrice')}>{formatPrice(log.price?.image_input_price, log.price?.image_input_price_unit)}</DetailRow>
                    <DetailRow label={t('log.audioInputPrice')}>{formatPrice(log.price?.audio_input_price, log.price?.audio_input_price_unit)}</DetailRow>
                    <DetailRow label={t('log.videoInputPrice')}>{formatPrice(log.price?.video_input_price, log.price?.video_input_price_unit)}</DetailRow>
                    <DetailRow label={t('log.imageOutputPrice')}>{formatPrice(log.price?.image_output_price, log.price?.image_output_price_unit)}</DetailRow>
                    <DetailRow label={t('log.audioOutputPrice')}>{formatPrice(log.price?.audio_output_price, log.price?.audio_output_price_unit)}</DetailRow>
                    <DetailRow label={t('log.inputRequestPrice')}>{log.price?.input_request_price || '-'}</DetailRow>
                    <DetailRow label={t('log.outputRequestPrice')}>{log.price?.output_request_price || '-'}</DetailRow>
                    <DetailRow label={t('log.perRequestPrice')}>{log.price?.per_request_price || '-'}</DetailRow>
                    <DetailRow label={t('log.thinkingPrice')}>{formatPrice(log.price?.thinking_mode_output_price, log.price?.thinking_mode_output_price_unit)}</DetailRow>
                    <DetailRow label={t('log.webSearchPrice')}>{formatPrice(log.price?.web_search_price, log.price?.web_search_price_unit)}</DetailRow>
                </DetailSection>

                <DetailSection title={t('log.consumeInfo')}>
                    <DetailRow label={t('log.usedAmount')}>{formatAmount(totalUsedAmount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.inputRequest')}>{formatAmount(amount?.input_request_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.outputRequest')}>{formatAmount(amount?.output_request_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.input')}>{formatAmount(amount?.input_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.cached')}>{formatAmount(amount?.cached_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.cacheCreation')}>{formatAmount(amount?.cache_creation_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.imageInput')}>{formatAmount(amount?.image_input_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.audioInput')}>{formatAmount(amount?.audio_input_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.videoInput')}>{formatAmount(amount?.video_input_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.output')}>{formatAmount(amount?.output_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.imageOutput')}>{formatAmount(amount?.image_output_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.audioOutput')}>{formatAmount(amount?.audio_output_amount)}</DetailRow>
                    <DetailRow label={t('log.costBreakdown.webSearch')}>{formatAmount(amount?.web_search_amount)}</DetailRow>
                </DetailSection>
            </div>

            {/* Metadata display is intentionally disabled for the log detail view.
            {log.metadata && Object.keys(log.metadata).length > 0 && (
                <>
                    <Separator />
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">{t('log.metadata')}</h4>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(log.metadata).map(([key, value]) => (
                                <span key={key} className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                                    <span className="font-medium">{key}:</span>&nbsp;{value}
                                </span>
                            ))}
                        </div>
                    </div>
                </>
            )}
            */}

            <Separator />

            {/* Request and response body */}
            {needsDetail && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-semibold text-sm mb-2">{t('log.requestBody')}</h4>
                        {isLoadingData ? (
                            <div className="flex items-center justify-center p-4 border rounded">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                                <span className="text-sm">{t('common.loading')}</span>
                            </div>
                        ) : hasError ? (
                            <div className="text-sm text-red-500 p-2 border rounded">
                                {t('log.failed')}
                            </div>
                        ) : sanitizedRequestBody ? (
                            <>
                                <JsonViewer
                                    src={sanitizedRequestBody}
                                    collapsed={1}
                                    name={false}
                                    fallbackToRawText
                                />
                                {requestTruncated && (
                                    <div className="text-xs text-amber-600 mt-1">⚠️ {t('log.contentTruncated')}</div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground p-2 border rounded">
                                {t('log.noRequestBody')}
                            </div>
                        )}
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm mb-2">{t('log.responseBody')}</h4>
                        {isLoadingData ? (
                            <div className="flex items-center justify-center p-4 border rounded">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                                <span className="text-sm">{t('common.loading')}</span>
                            </div>
                        ) : hasError ? (
                            <div className="text-sm text-red-500 p-2 border rounded">
                                {t('log.failed')}
                            </div>
                        ) : responseBody ? (
                            <>
                                <JsonViewer
                                    src={responseBody}
                                    collapsed={1}
                                    name={false}
                                    fallbackToRawText
                                />
                                {responseTruncated && (
                                    <div className="text-xs text-amber-600 mt-1">⚠️ {t('log.contentTruncated')}</div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground p-2 border rounded">
                                {t('log.noResponseBody')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isAdminScope && editingChannel && (
                <ChannelDialog
                    open={channelDialogOpen}
                    onOpenChange={setChannelDialogOpen}
                    mode="update"
                    channel={editingChannel}
                />
            )}
        </div>
        </EmbeddedContext.Provider>
    )
}
