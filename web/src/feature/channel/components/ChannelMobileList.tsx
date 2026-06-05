import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
    Loader2,
    FlaskConical,
    Pencil,
    Copy,
    Power,
    PowerOff,
    Trash2,
    Download,
    ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from '@/components/ui/drawer'
import type { Channel } from '@/types/channel'

const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return '-'
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm')
}

export interface ChannelMobileActions {
    onTest: (channel: Channel) => void
    onEdit: (channel: Channel) => void
    onCopy: (channel: Channel) => void
    onToggleStatus: (id: number, status: number) => void
    onDelete: (id: number) => void
    onExport: (channel: Channel) => void
}

interface ChannelMobileListProps {
    channels: Channel[]
    isLoading: boolean
    getChannelTypeName: (typeId: number) => string
    getDisplayModels: (channel: Channel) => { models: string[]; usingDefaultModels: boolean }
    actions: ChannelMobileActions
    isTestingChannel: boolean
    isStatusUpdating: boolean
}

function StatusBadge({ status }: { status: number }) {
    const { t } = useTranslation()

    return status === 2 ? (
        <Badge variant="outline" className="bg-destructive text-white dark:bg-red-600/90 dark:text-white/90">
            {t('token.disabled')}
        </Badge>
    ) : (
        <Badge variant="outline" className="bg-primary text-white dark:bg-[#4A4DA0] dark:text-white/90">
            {t('token.enabled')}
        </Badge>
    )
}

// H5 渠道卡片列表：点卡片打开详情抽屉，桌面端不渲染本组件
export function ChannelMobileList({
    channels,
    isLoading,
    getChannelTypeName,
    getDisplayModels,
    actions,
    isTestingChannel,
    isStatusUpdating,
}: ChannelMobileListProps) {
    const { t } = useTranslation()
    const [detailChannel, setDetailChannel] = useState<Channel | null>(null)

    if (isLoading && channels.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        )
    }

    if (channels.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
                {t('common.noResult')}
            </div>
        )
    }

    const modelCount = (channel: Channel) => getDisplayModels(channel).models.length

    return (
        <>
            <div className="flex flex-col gap-3">
                {channels.map((channel) => (
                    <Card
                        key={channel.id}
                        onClick={() => setDetailChannel(channel)}
                        className="cursor-pointer gap-0 border border-border p-4 shadow-none transition-colors active:bg-muted/50"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-foreground">{channel.name}</div>
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {getChannelTypeName(channel.type)}
                                    {channel.group ? ` · ${channel.group}` : ''}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <StatusBadge status={channel.status} />
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                                {t('channel.priority')} {channel.priority}
                                <span className="mx-1.5">·</span>
                                {modelCount(channel)} {t('channel.models')}
                            </span>
                            <span className="font-mono text-foreground">
                                ${(channel.used_amount || 0).toFixed(4)}
                            </span>
                        </div>
                    </Card>
                ))}
            </div>

            <Drawer open={detailChannel !== null} onOpenChange={(open) => !open && setDetailChannel(null)}>
                <DrawerContent className="max-h-[88dvh]">
                    {detailChannel && (
                        <>
                            <DrawerHeader className="text-left">
                                <DrawerTitle className="flex items-center justify-between gap-3">
                                    <span className="min-w-0 truncate">{detailChannel.name}</span>
                                    <StatusBadge status={detailChannel.status} />
                                </DrawerTitle>
                                <DrawerDescription className="sr-only">
                                    {t('channel.management')}
                                </DrawerDescription>
                            </DrawerHeader>

                            <div className="overflow-y-auto px-4 pb-2">
                                <dl className="divide-y divide-border rounded-lg border border-border">
                                    {(
                                        [
                                            ['channel.id', String(detailChannel.id)],
                                            ['channel.type', getChannelTypeName(detailChannel.type)],
                                            ['channel.group', detailChannel.group || '-'],
                                            ['channel.priority', String(detailChannel.priority)],
                                            ['channel.models', String(modelCount(detailChannel))],
                                            ['channel.requestCount', String(detailChannel.request_count ?? 0)],
                                            ['channel.retryCount', String(detailChannel.retry_count ?? 0)],
                                            ['channel.usedAmount', `$${(detailChannel.used_amount || 0).toFixed(4)}`],
                                            ['channel.createdAt', formatTimestamp(detailChannel.created_at)],
                                            [
                                                'channel.accessedAt',
                                                detailChannel.accessed_at && detailChannel.accessed_at > 0
                                                    ? formatTimestamp(detailChannel.accessed_at)
                                                    : t('token.never'),
                                            ],
                                        ] as const
                                    ).map(([labelKey, value]) => (
                                        <div key={labelKey} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                            <dt className="shrink-0 text-xs text-muted-foreground">{t(labelKey)}</dt>
                                            <dd className="min-w-0 truncate text-right text-sm text-foreground">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-4">
                                <Button
                                    variant="outline"
                                    onClick={() => actions.onTest(detailChannel)}
                                    disabled={isTestingChannel}
                                >
                                    <FlaskConical className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-500" />
                                    {isTestingChannel ? t('channel.testing') : t('channel.test')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const channel = detailChannel
                                        setDetailChannel(null)
                                        actions.onEdit(channel)
                                    }}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {t('channel.edit')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const channel = detailChannel
                                        setDetailChannel(null)
                                        actions.onCopy(channel)
                                    }}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    {t('channel.copyFrom')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => actions.onToggleStatus(detailChannel.id, detailChannel.status)}
                                    disabled={isStatusUpdating}
                                >
                                    {detailChannel.status === 2 ? (
                                        <>
                                            <Power className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                                            {t('channel.enable')}
                                        </>
                                    ) : (
                                        <>
                                            <PowerOff className="mr-2 h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                                            {t('channel.disable')}
                                        </>
                                    )}
                                </Button>
                                <Button variant="outline" onClick={() => actions.onExport(detailChannel)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    {t('channel.export')}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="text-red-600 hover:text-red-600 dark:text-red-500"
                                    onClick={() => {
                                        const id = detailChannel.id
                                        setDetailChannel(null)
                                        actions.onDelete(id)
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('channel.delete')}
                                </Button>
                            </div>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </>
    )
}
