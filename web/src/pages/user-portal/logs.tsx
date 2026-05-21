import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DateRange } from 'react-day-picker'
import { Activity, CircleCheck, CircleX, Coins, RotateCcw, RefreshCw } from 'lucide-react'
import { LogTable } from '@/feature/log/components/LogTable'
import { useUserPortalModelLogStats, useUserPortalModelLogs } from '@/feature/user-portal/hooks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/common/DateRangePicker'
import { TimezoneInput } from '@/components/common/TimezoneInput'
import type { LogFilters } from '@/types/log'
import { DEFAULT_TIMEZONE, zonedBoundaryToUnixMs } from '@/utils/timezone'

const ALL_VALUE = '__all__'

const getDefaultDateRange = (): DateRange => {
    const today = new Date()
    const oneDayAgo = new Date()
    oneDayAgo.setDate(today.getDate() - 1)
    return { from: oneDayAgo, to: today }
}

const withSelectedValue = (options: string[] | undefined, selected?: string) => {
    const next = new Set((options || []).filter(Boolean))
    if (selected) {
        next.add(selected)
    }

    return Array.from(next)
}

const formatCount = (value?: number) => Number(value || 0).toLocaleString()
const formatMoney = (value?: number) => `$${Number(value || 0).toFixed(4)}`

export default function UserPortalLogsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const [modelPage, setModelPage] = useState(1)
    const [modelPageSize, setModelPageSize] = useState(20)
    const [group, setGroup] = useState(ALL_VALUE)
    const [tokenName, setTokenName] = useState(ALL_VALUE)
    const [modelName, setModelName] = useState(ALL_VALUE)
    const [codeType, setCodeType] = useState<'all' | 'success' | 'error'>('all')
    const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange())
    const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)

    const activeGroup = group === ALL_VALUE ? '' : group
    const activeTokenName = tokenName === ALL_VALUE ? '' : tokenName
    const activeModelName = modelName === ALL_VALUE ? '' : modelName
    const effectiveTimezone = timezone.trim() || DEFAULT_TIMEZONE
    const filters: LogFilters = {
        group: activeGroup || undefined,
        token_name: activeTokenName || undefined,
        model: activeModelName || undefined,
        code_type: codeType,
        timezone: effectiveTimezone,
        start_timestamp: dateRange?.from
            ? zonedBoundaryToUnixMs(dateRange.from, effectiveTimezone, false)
            : undefined,
        end_timestamp: dateRange?.to
            ? zonedBoundaryToUnixMs(dateRange.to, effectiveTimezone, true)
            : undefined,
    }

    const {
        data: modelData,
        isLoading: isModelLoading,
        isFetching: isModelFetching,
        refetch: refetchModelLogs,
    } = useUserPortalModelLogs(modelPage, modelPageSize, filters, true)
    const {
        data: statsData,
        isLoading: isStatsLoading,
        isFetching: isStatsFetching,
        refetch: refetchModelStats,
    } = useUserPortalModelLogStats(filters, true)
    const modelLogs = modelData?.logs || []
    const modelTotal = modelData?.total || 0
    const stats = statsData?.stats
    const groupOptions = withSelectedValue(modelData?.groups, activeGroup)
    const tokenOptions = withSelectedValue(modelData?.token_names, activeTokenName)
    const modelOptions = withSelectedValue(modelData?.models, activeModelName)
    const statsLoading = isStatsLoading || isStatsFetching
    const statPills = [
        {
            key: 'usedAmount',
            icon: Coins,
            label: t('portal.logs.stats.usedAmount'),
            value: formatMoney(stats?.used_amount),
            className: 'text-primary',
        },
        {
            key: 'requests',
            icon: Activity,
            label: t('portal.logs.stats.requests'),
            value: formatCount(stats?.total_count),
            className: 'text-sky-600 dark:text-sky-400',
        },
        {
            key: 'success',
            icon: CircleCheck,
            label: t('portal.logs.stats.success'),
            value: formatCount(stats?.success_count),
            className: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            key: 'failed',
            icon: CircleX,
            label: t('portal.logs.stats.failed'),
            value: formatCount(stats?.error_count),
            className: 'text-destructive',
        },
    ]

    const resetPage = () => setModelPage(1)
    const handleRefresh = () => {
        refetchModelLogs()
        refetchModelStats()
    }
    const handleResetFilters = () => {
        setGroup(ALL_VALUE)
        setTokenName(ALL_VALUE)
        setModelName(ALL_VALUE)
        setCodeType('all')
        setDateRange(getDefaultDateRange())
        setTimezone(DEFAULT_TIMEZONE)
        setModelPage(1)
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <section className="rounded-md border border-border bg-background p-3 shadow-none dark:border-white/10 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-3xl text-[12px] leading-5 text-muted-foreground">{t('portal.logs.description')}</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isModelFetching || isStatsFetching}
                        className="h-9 px-3 sm:shrink-0"
                    >
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isModelFetching || isStatsFetching ? 'animate-spin' : ''}`} />
                        {t('common.refresh')}
                    </Button>
                </div>
            </section>

            <section className="flex flex-wrap gap-2">
                {statPills.map((item) => {
                    const Icon = item.icon

                    return (
                        <div
                            key={item.key}
                            className="flex min-h-10 min-w-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 shadow-none dark:border-white/10 sm:px-4"
                        >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${item.className}`} />
                            <span className="shrink-0 text-xs text-muted-foreground">{item.label}</span>
                            {statsLoading ? (
                                <Skeleton className="h-4 w-14 rounded-full" />
                            ) : (
                                <span className="font-mono text-sm font-semibold text-foreground">{item.value}</span>
                            )}
                        </div>
                    )
                })}
            </section>

            <section className="rounded-md border border-border bg-background p-3 shadow-none dark:border-white/10 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full min-w-0 sm:w-40">
                        <Select
                            value={group}
                            onValueChange={(value) => {
                                setGroup(value)
                                resetPage()
                            }}
                            disabled={isModelFetching}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder={t('portal.logs.groupFilter')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>{t('portal.logs.allGroups')}</SelectItem>
                                {groupOptions.map((item) => (
                                    <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full min-w-0 sm:w-44">
                        <Select
                            value={tokenName}
                            onValueChange={(value) => {
                                setTokenName(value)
                                resetPage()
                            }}
                            disabled={isModelFetching}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder={t('portal.logs.keyFilter')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>{t('portal.logs.allKeys')}</SelectItem>
                                {tokenOptions.map((item) => (
                                    <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full min-w-0 sm:w-48">
                        <Select
                            value={modelName}
                            onValueChange={(value) => {
                                setModelName(value)
                                resetPage()
                            }}
                            disabled={isModelFetching}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder={t('portal.logs.modelFilter')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>{t('portal.logs.allModels')}</SelectItem>
                                {modelOptions.map((item) => (
                                    <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full min-w-0 sm:w-32">
                        <Select
                            value={codeType}
                            onValueChange={(value: 'all' | 'success' | 'error') => {
                                setCodeType(value)
                                resetPage()
                            }}
                            disabled={isModelFetching}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('portal.logs.allStatus')}</SelectItem>
                                <SelectItem value="success">{t('portal.logs.success')}</SelectItem>
                                <SelectItem value="error">{t('portal.logs.failed')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full min-w-0 sm:w-56">
                        <DateRangePicker
                            value={dateRange}
                            onChange={(value) => {
                                setDateRange(value)
                                resetPage()
                            }}
                            placeholder={t('portal.logs.dateRangeFilter')}
                            disabled={isModelFetching}
                            className="h-9"
                        />
                    </div>

                    <TimezoneInput
                        value={timezone}
                        onChange={(value) => {
                            setTimezone(value)
                            resetPage()
                        }}
                        disabled={isModelFetching}
                        className="h-9 w-full sm:w-44"
                    />

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        disabled={isModelFetching}
                        className="h-9 w-full px-3 sm:w-auto"
                    >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        {t('portal.logs.resetFilters')}
                    </Button>
                </div>
            </section>

            <LogTable
                data={modelLogs}
                total={modelTotal}
                loading={isModelLoading}
                page={modelPage}
                pageSize={modelPageSize}
                onPageChange={setModelPage}
                onPageSizeChange={(size) => {
                    setModelPageSize(size)
                    setModelPage(1)
                }}
                detailScope="user"
            />
        </div>
    )
}
