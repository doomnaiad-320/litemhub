import { Activity, CircleCheck, CircleX, Clock3, Coins, Gauge, Timer, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import type { LogStats } from '@/types/log'

interface LogStatsCardsProps {
    stats?: LogStats
    loading?: boolean
}

const formatCount = (value?: number) => Number(value || 0).toLocaleString()
const formatMoney = (value?: number) => `$${Number(value || 0).toFixed(4)}`
const formatMs = (value?: number) => `${Math.round(Number(value || 0)).toLocaleString()}ms`

export function LogStatsCards({ stats, loading = false }: LogStatsCardsProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const total = stats?.total_count || 0
    const successRate = total > 0 ? ((stats?.success_count || 0) / total) * 100 : 0

    const cards = [
        {
            key: 'requests',
            icon: Activity,
            value: formatCount(stats?.total_count),
            detail: `${t('log.stats.success')}: ${formatCount(stats?.success_count)}`,
        },
        {
            key: 'successRate',
            icon: CircleCheck,
            value: `${successRate.toFixed(2)}%`,
            detail: `${t('log.stats.failed')}: ${formatCount(stats?.error_count)}`,
        },
        {
            key: 'failed',
            icon: CircleX,
            value: formatCount(stats?.error_count),
            detail: t('log.stats.failedDetail'),
        },
        {
            key: 'usedAmount',
            icon: Coins,
            value: formatMoney(stats?.used_amount),
            detail: t('log.stats.usedAmountDetail'),
        },
        {
            key: 'tokens',
            icon: Zap,
            value: formatCount(stats?.total_tokens),
            detail: `${t('log.inputTokens')}: ${formatCount(stats?.input_tokens)}`,
        },
        {
            key: 'outputTokens',
            icon: Gauge,
            value: formatCount(stats?.output_tokens),
            detail: t('log.outputTokens'),
        },
        {
            key: 'avgDuration',
            icon: Timer,
            value: formatMs(stats?.average_milliseconds),
            detail: t('log.stats.avgDurationDetail'),
        },
        {
            key: 'avgTtfb',
            icon: Clock3,
            value: formatMs(stats?.average_ttfb_milliseconds),
            detail: t('log.stats.avgTtfbDetail'),
        },
    ]

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            {cards.map((card) => {
                const Icon = card.icon

                return (
                    <div key={card.key} className="min-w-0 rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span className="truncate">{t(`log.stats.${card.key}`)}</span>
                        </div>
                        <div className="mt-2 font-mono text-xl font-semibold tracking-tight">
                            {loading ? <Skeleton className="h-7 w-24" /> : card.value}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                            {loading ? <Skeleton className="h-4 w-28" /> : card.detail}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
