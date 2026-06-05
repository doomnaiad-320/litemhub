import { Activity, CircleCheck, CircleX, Coins, Gauge, GaugeCircle, Timer, Zap } from 'lucide-react'
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
const formatRpm = (value?: number) => {
    const rpm = Number(value || 0)
    if (rpm >= 100) return Math.round(rpm).toLocaleString()
    if (rpm >= 10) return rpm.toFixed(1)
    return rpm.toFixed(2)
}

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
            key: 'rpm',
            icon: GaugeCircle,
            value: formatRpm(stats?.rpm),
            detail: t('log.stats.rpmDetail'),
        },
    ]

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4 2xl:grid-cols-8">
            {cards.map((card) => {
                const Icon = card.icon

                return (
                    <div key={card.key} className="min-w-0 rounded-lg border border-border bg-card p-2.5 lg:p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground lg:gap-2">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">{t(`log.stats.${card.key}`)}</span>
                        </div>
                        <div className="mt-1 font-mono text-base font-semibold tracking-tight lg:mt-2 lg:text-xl">
                            {loading ? <Skeleton className="h-6 w-20 lg:h-7 lg:w-24" /> : card.value}
                        </div>
                        {/* 说明文字：H5 隐藏以压缩 hero 高度，lg 起显示 */}
                        <div className="mt-2 hidden lg:block">
                            {loading ? (
                                <Skeleton className="h-5 w-24 rounded-full lg:w-28" />
                            ) : (
                                <span className="inline-flex max-w-full items-center truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {card.detail}
                                </span>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
