import { useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import type { EChartsOption } from 'echarts'
import {
    Banknote,
    CalendarClock,
    CreditCard,
    Percent,
    ReceiptText,
    RefreshCcw,
    Search,
    TrendingUp,
    WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/common/DateRangePicker'
import { EChart } from '@/components/ui/echarts'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { ServerPagination } from '@/components/table/server-pagination'
import { DEFAULT_TIMEZONE, zonedBoundaryToUnixMs } from '@/utils/timezone'
import {
    useAppBillingSettings,
    useAppRechargeLogs,
    useAppRechargeStats,
    useUpdateAppBillingSettings,
} from '../hooks'

type Granularity = 'day' | 'week' | 'month'

const formatMoney = (amount?: number) => `$${(amount || 0).toFixed(2)}`

const formatDateTime = (value?: number) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'

    return format(date, 'yyyy-MM-dd HH:mm')
}

const formatBucket = (value: number, granularity: Granularity) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    if (granularity === 'month') return format(date, 'yyyy-MM')
    if (granularity === 'week') return `${format(date, 'MM-dd')} ${'~'}`

    return format(date, 'MM-dd')
}

const getAccount = (email?: string, phone?: string, userID?: number) => {
    return email || phone || (userID ? `#${userID}` : '-')
}

const metricCards = [
    {
        key: 'paidAmount',
        icon: CreditCard,
        getValue: (stats?: { paid_amount?: number }) => formatMoney(stats?.paid_amount),
    },
    {
        key: 'paidCount',
        icon: ReceiptText,
        getValue: (stats?: { paid_count?: number }) => stats?.paid_count || 0,
    },
    {
        key: 'topChannel',
        icon: TrendingUp,
        getValue: (_stats?: unknown, topChannel?: { channel?: string }) => topChannel?.channel || '-',
    },
    {
        key: 'totalAmount',
        icon: Banknote,
        getValue: (stats?: { total_amount?: number }) => formatMoney(stats?.total_amount),
    },
]

export function AppRechargeOverview() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
        from: subDays(new Date(), 29),
        to: new Date(),
    }))
    const [keywordInput, setKeywordInput] = useState('')
    const [keyword, setKeyword] = useState('')
    const [statusFilter, setStatusFilter] = useState('success')
    const [channelFilter, setChannelFilter] = useState('all')
    const [granularity, setGranularity] = useState<Granularity>('day')
    const [discountInput, setDiscountInput] = useState('')

    const startTimestamp = dateRange?.from
        ? zonedBoundaryToUnixMs(dateRange.from, DEFAULT_TIMEZONE, false)
        : undefined
    const endTimestamp = dateRange?.to
        ? zonedBoundaryToUnixMs(dateRange.to, DEFAULT_TIMEZONE, true)
        : undefined
    const normalizedStatus = statusFilter === 'all' ? undefined : statusFilter
    const normalizedChannel = channelFilter === 'all' ? undefined : channelFilter

    const { data: statsData, isLoading: isStatsLoading, refetch: refetchStats } = useAppRechargeStats(
        startTimestamp,
        endTimestamp,
        keyword || undefined,
        granularity,
    )
    const { data: logsData, isLoading: isLogsLoading, refetch: refetchLogs } = useAppRechargeLogs(
        page,
        pageSize,
        startTimestamp,
        endTimestamp,
        keyword || undefined,
        normalizedStatus,
        normalizedChannel,
    )
    const { data: billingSettingsData, isLoading: isBillingSettingsLoading } = useAppBillingSettings()
    const updateBillingSettingsMutation = useUpdateAppBillingSettings()

    const stats = statsData?.stats
    const rechargeDiscount = billingSettingsData?.settings.recharge_discount ?? 1
    const logs = logsData?.recharge_logs || []
    const total = logsData?.total || 0
    const channels = stats?.by_channel || []
    const topChannel = channels[0]

    useEffect(() => {
        if (billingSettingsData?.settings.recharge_discount) {
            setDiscountInput(String(billingSettingsData.settings.recharge_discount))
        }
    }, [billingSettingsData?.settings.recharge_discount])

    const chartOption: EChartsOption = useMemo(() => {
        const series = stats?.time_series || []
        const labels = series.map((point) => formatBucket(point.timestamp, granularity))

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                borderWidth: 0,
                borderRadius: 12,
                padding: 12,
                formatter: (params: unknown) => {
                    const items = Array.isArray(params) ? params : []
                    const amount = Number((items[0] as { value?: number })?.value || 0)
                    const count = Number((items[1] as { value?: number })?.value || 0)
                    return `${(items[0] as { axisValue?: string })?.axisValue || ''}<br/>${t('appUser.rechargeStats.amount')}: ${formatMoney(amount)}<br/>${t('appUser.rechargeStats.count')}: ${count}`
                },
            },
            legend: {
                top: 0,
                right: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 12 },
            },
            grid: { left: 8, right: 8, top: 44, bottom: 0, containLabel: true },
            xAxis: {
                type: 'category',
                data: labels,
                boundaryGap: true,
                axisTick: { show: false },
                axisLine: { lineStyle: { color: '#e5e7eb' } },
                axisLabel: { color: '#64748b', fontSize: 11 },
            },
            yAxis: [
                {
                    type: 'value',
                    axisLabel: {
                        color: '#64748b',
                        fontSize: 11,
                        formatter: (value: number) => `$${value}`,
                    },
                    splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
                },
                {
                    type: 'value',
                    axisLabel: { color: '#94a3b8', fontSize: 11 },
                    splitLine: { show: false },
                },
            ],
            series: [
                {
                    name: t('appUser.rechargeStats.amount'),
                    type: 'bar',
                    data: series.map((point) => Number(point.amount.toFixed(2))),
                    itemStyle: {
                        color: '#2563eb',
                        borderRadius: [7, 7, 0, 0],
                    },
                    barMaxWidth: granularity === 'day' ? 20 : 34,
                },
                {
                    name: t('appUser.rechargeStats.count'),
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: true,
                    showSymbol: false,
                    data: series.map((point) => point.count),
                    lineStyle: { color: '#059669', width: 2.5 },
                    itemStyle: { color: '#059669' },
                },
            ],
        }
    }, [granularity, stats?.time_series, t])

    const submitSearch = () => {
        setKeyword(keywordInput.trim())
        setPage(1)
    }

    const resetFilters = () => {
        setKeywordInput('')
        setKeyword('')
        setStatusFilter('success')
        setChannelFilter('all')
        setGranularity('day')
        setDateRange({ from: subDays(new Date(), 29), to: new Date() })
        setPage(1)
    }

    const refresh = () => {
        refetchStats()
        refetchLogs()
    }

    const submitDiscount = async () => {
        const discount = Number(discountInput)
        if (!Number.isFinite(discount) || discount <= 0 || discount > 1) {
            return
        }

        await updateBillingSettingsMutation.mutateAsync({
            recharge_discount: discount,
        })
        setDiscountInput(String(discount))
    }

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden rounded-md border-border bg-background shadow-none">
                <CardHeader className="space-y-5 border-b border-border/60 px-6 py-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                <WalletCards className="h-4 w-4 shrink-0" />
                                {t('appUser.rechargeStats.badge')}
                            </div>
                            <CardTitle className="text-2xl font-semibold tracking-tight">
                                {t('appUser.rechargeStats.title')}
                            </CardTitle>
                            <p className="max-w-3xl text-sm text-muted-foreground">
                                {t('appUser.rechargeStats.description')}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={refresh}
                            className="h-10 rounded-md border-border bg-background px-4 xl:self-start"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            {t('appUser.refresh')}
                        </Button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_320px_150px_150px_auto]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={keywordInput}
                                onChange={(event) => setKeywordInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') submitSearch()
                                }}
                                placeholder={t('appUser.rechargeStats.searchPlaceholder')}
                                className="h-10 rounded-md border-border bg-background pl-9 shadow-none"
                            />
                        </div>
                        <DateRangePicker
                            value={dateRange}
                            onChange={(value) => {
                                setDateRange(value)
                                setPage(1)
                            }}
                            className="h-10 w-full whitespace-nowrap rounded-md bg-background"
                        />
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                                setStatusFilter(value)
                                setPage(1)
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-md border-border bg-background shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('appUser.rechargeStats.allStatus')}</SelectItem>
                                <SelectItem value="success">{t('appUser.rechargeStats.success')}</SelectItem>
                                <SelectItem value="unpaid">{t('appUser.rechargeStats.unpaid')}</SelectItem>
                                <SelectItem value="failed">{t('appUser.rechargeStats.failed')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={channelFilter}
                            onValueChange={(value) => {
                                setChannelFilter(value)
                                setPage(1)
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-md border-border bg-background shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('appUser.rechargeStats.allChannels')}</SelectItem>
                                <SelectItem value="dulupay">{t('appUser.rechargeStats.dulupay')}</SelectItem>
                                <SelectItem value="manual">{t('appUser.rechargeStats.manual')}</SelectItem>
                                <SelectItem value="alipay">alipay</SelectItem>
                                <SelectItem value="wxpay">wxpay</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                            <Button onClick={submitSearch} className="h-10 rounded-md px-4">
                                {t('appUser.rechargeStats.search')}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={resetFilters}
                                className="h-10 rounded-md border-border bg-background px-4"
                            >
                                {t('appUser.rechargeStats.reset')}
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-5 p-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {metricCards.map((metric) => {
                            const Icon = metric.icon
                            return (
                                <div key={metric.key} className="rounded-md border border-border bg-background p-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Icon className="h-4 w-4 text-primary" />
                                        {t(`appUser.rechargeStats.${metric.key}`)}
                                    </div>
                                    <div className="mt-3 font-mono text-2xl font-semibold">
                                        {isStatsLoading ? (
                                            <Skeleton className="h-8 w-28" />
                                        ) : (
                                            metric.getValue(stats, topChannel)
                                        )}
                                    </div>
                                    {metric.key === 'topChannel' && !isStatsLoading ? (
                                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                                            {formatMoney(topChannel?.amount)}
                                        </div>
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                        <div className="rounded-md border border-border bg-background p-4">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <CalendarClock className="h-4 w-4 text-primary" />
                                        {t('appUser.rechargeStats.trend')}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {t('appUser.rechargeStats.trendHint')}
                                    </div>
                                </div>
                                <Tabs
                                    value={granularity}
                                    onValueChange={(value) => setGranularity(value as Granularity)}
                                >
                                    <TabsList className="h-9 rounded-md bg-muted/70 p-1">
                                        <TabsTrigger value="day" className="rounded-sm px-3">
                                            {t('appUser.rechargeStats.daily')}
                                        </TabsTrigger>
                                        <TabsTrigger value="week" className="rounded-sm px-3">
                                            {t('appUser.rechargeStats.weekly')}
                                        </TabsTrigger>
                                        <TabsTrigger value="month" className="rounded-sm px-3">
                                            {t('appUser.rechargeStats.monthly')}
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            {isStatsLoading ? (
                                <Skeleton className="h-[320px] rounded-md" />
                            ) : (
                                <EChart option={chartOption} style={{ height: 320, width: '100%' }} />
                            )}
                        </div>

                        <div className="rounded-md border border-border bg-background p-4">
                            <div className="mb-3 text-sm font-medium">{t('appUser.rechargeStats.channelBreakdown')}</div>
                            <div className="space-y-3">
                                {isStatsLoading ? (
                                    Array.from({ length: 4 }).map((_, index) => (
                                        <Skeleton key={index} className="h-12 rounded-md" />
                                    ))
                                ) : channels.length > 0 ? (
                                    channels.slice(0, 6).map((channel) => {
                                        const percent = stats?.paid_amount
                                            ? Math.min(100, (channel.amount / stats.paid_amount) * 100)
                                            : 0
                                        return (
                                            <div key={channel.channel || 'empty'} className="space-y-2">
                                                <div className="flex items-center justify-between gap-3 text-sm">
                                                    <span className="truncate font-medium">{channel.channel || '-'}</span>
                                                    <span className="font-mono text-muted-foreground">
                                                        {formatMoney(channel.amount)}
                                                    </span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-primary"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        {t('common.noResult')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-md border-border bg-background shadow-none">
                <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <Percent className="h-4 w-4 shrink-0" />
                            {t('appUser.rechargeStats.discountSetting')}
                        </div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight">
                            {isBillingSettingsLoading ? (
                                <Skeleton className="h-8 w-28 rounded-md" />
                            ) : (
                                t('appUser.rechargeStats.currentDiscount', {
                                    discount: rechargeDiscount,
                                    percent: Math.round(rechargeDiscount * 10000) / 100,
                                })
                            )}
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                            {t('appUser.rechargeStats.discountDescription')}
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <label htmlFor="recharge-discount" className="text-xs font-medium text-muted-foreground">
                            {t('appUser.rechargeStats.discountInput')}
                        </label>
                        <div className="flex gap-2">
                            <Input
                                id="recharge-discount"
                                type="number"
                                min="0.01"
                                max="1"
                                step="0.01"
                                value={discountInput}
                                onChange={(event) => setDiscountInput(event.target.value)}
                                className="h-10 rounded-md border-border bg-background font-mono shadow-none"
                            />
                            <Button
                                onClick={submitDiscount}
                                disabled={isBillingSettingsLoading || updateBillingSettingsMutation.isPending}
                                className="h-10 rounded-md px-4"
                            >
                                {updateBillingSettingsMutation.isPending
                                    ? t('appUser.rechargeStats.savingDiscount')
                                    : t('appUser.rechargeStats.saveDiscount')}
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {t('appUser.rechargeStats.discountHint')}
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="overflow-hidden rounded-md border-border bg-background shadow-none">
                <div className="flex flex-col gap-2 border-b border-border/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-lg font-semibold">{t('appUser.rechargeStats.logTitle')}</div>
                        <div className="text-sm text-muted-foreground">{t('appUser.rechargeStats.logDescription')}</div>
                    </div>
                    <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
                        {t('appUser.rechargeStats.totalRecords', { count: total })}
                    </Badge>
                </div>
                <div className="overflow-auto px-6 py-4">
                    <div className="overflow-hidden rounded-md border border-border bg-background">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('appUser.account')}</TableHead>
                                    <TableHead>{t('appUser.amount')}</TableHead>
                                    <TableHead>{t('appUser.rechargeStats.channel')}</TableHead>
                                    <TableHead>{t('appUser.status')}</TableHead>
                                    <TableHead>{t('appUser.rechargeStats.tradeNo')}</TableHead>
                                    <TableHead>{t('appUser.createdAt')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLogsLoading ? (
                                    Array.from({ length: 6 }).map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell colSpan={6}>
                                                <Skeleton className="h-8 w-full" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="min-w-[180px]">
                                                <div className="font-medium">
                                                    {getAccount(log.user_email, log.user_phone, log.user_id)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">#{log.user_id}</div>
                                            </TableCell>
                                            <TableCell className="font-mono font-medium">{formatMoney(log.amount)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="rounded-full">
                                                    {log.channel || '-'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full border-transparent bg-primary/10 text-primary"
                                                >
                                                    {t(`appUser.rechargeStats.statuses.${log.status}`)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                                                {log.trade_no || '-'}
                                            </TableCell>
                                            <TableCell className="min-w-[150px] text-muted-foreground">
                                                {formatDateTime(log.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                                            {t('common.noResult')}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <div className="border-t border-border/60 px-4">
                    <ServerPagination
                        page={page}
                        pageSize={pageSize}
                        total={total}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => {
                            setPageSize(size)
                            setPage(1)
                        }}
                    />
                </div>
            </Card>
        </div>
    )
}
