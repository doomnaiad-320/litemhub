import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'

import { useLogs, useLogStats } from '@/feature/log/hooks'
import { LogExportDialog } from '@/feature/log/components/LogExportDialog'
import { LogFilters } from '@/feature/log/components/LogFilters'
import { LogStatsCards } from '@/feature/log/components/LogStatsCards'
import { LogTable } from '@/feature/log/components/LogTable'
import { GroupDialog } from '@/feature/group/components/GroupDialog'
import { AdvancedErrorDisplay } from '@/components/common/error/errorDisplay'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { LogFilters as LogFiltersType } from '@/types/log'
import { DEFAULT_TIMEZONE, zonedBoundaryToUnixMs } from '@/utils/timezone'

const LOG_PAGE_SIZE_STORAGE_KEY = 'aiproxy.log.pageSize'
const LOG_AUTO_REFRESH_ENABLED_STORAGE_KEY = 'aiproxy.log.autoRefresh.enabled'
const LOG_AUTO_REFRESH_INTERVAL_STORAGE_KEY = 'aiproxy.log.autoRefresh.interval'
const DEFAULT_LOG_PAGE_SIZE = 20
const LOG_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50]
const AUTO_REFRESH_INTERVAL_OPTIONS = [10_000, 30_000, 60_000]
const DEFAULT_AUTO_REFRESH_INTERVAL = 30_000

function readStoredOption(key: string, options: number[], fallback: number) {
    if (typeof window === 'undefined') {
        return fallback
    }

    try {
        const value = Number(window.localStorage.getItem(key))
        return options.includes(value) ? value : fallback
    } catch {
        return fallback
    }
}

function readStoredBoolean(key: string, fallback: boolean) {
    if (typeof window === 'undefined') {
        return fallback
    }

    try {
        const value = window.localStorage.getItem(key)
        if (value === 'true') return true
        if (value === 'false') return false
        return fallback
    } catch {
        return fallback
    }
}

export default function LogPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string

    const getDefaultFilters = (): LogFiltersType => {
        const today = new Date()
        const oneDayAgo = new Date()
        oneDayAgo.setDate(today.getDate() - 1)

        return {
            code_type: 'all',
            page: 1,
            per_page: readStoredOption(LOG_PAGE_SIZE_STORAGE_KEY, LOG_PAGE_SIZE_OPTIONS, DEFAULT_LOG_PAGE_SIZE),
            start_timestamp: zonedBoundaryToUnixMs(oneDayAgo, DEFAULT_TIMEZONE, false),
            end_timestamp: zonedBoundaryToUnixMs(today, DEFAULT_TIMEZONE, true)
        }
    }

    const [filters, setFilters] = useState<LogFiltersType>(getDefaultFilters())
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => readStoredBoolean(LOG_AUTO_REFRESH_ENABLED_STORAGE_KEY, false))
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(() => readStoredOption(
        LOG_AUTO_REFRESH_INTERVAL_STORAGE_KEY,
        AUTO_REFRESH_INTERVAL_OPTIONS,
        DEFAULT_AUTO_REFRESH_INTERVAL
    ))
    const refetchInterval = autoRefreshEnabled ? autoRefreshInterval : false

    // GroupDialog 状态
    const [groupDialogOpen, setGroupDialogOpen] = useState(false)
    const [groupDialogGroupId, setGroupDialogGroupId] = useState<string | null>(null)
    const [groupDialogTokenName, setGroupDialogTokenName] = useState<string | undefined>()
    // H5 筛选器默认收起，避免 hero 区占满整屏
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

    const {
        data: logData,
        isLoading,
        isFetching,
        error,
        refetch
    } = useLogs(filters, { refetchInterval })
    const {
        data: statsData,
        isLoading: isStatsLoading,
        isFetching: isStatsFetching,
        refetch: refetchStats,
    } = useLogStats(filters, { refetchInterval })

    useEffect(() => {
        try {
            window.localStorage.setItem(LOG_PAGE_SIZE_STORAGE_KEY, String(filters.per_page || DEFAULT_LOG_PAGE_SIZE))
        } catch {
            // Ignore storage failures; the table still works for the current session.
        }
    }, [filters.per_page])

    useEffect(() => {
        try {
            window.localStorage.setItem(LOG_AUTO_REFRESH_ENABLED_STORAGE_KEY, String(autoRefreshEnabled))
        } catch {
            // Ignore storage failures; the control still works for the current session.
        }
    }, [autoRefreshEnabled])

    useEffect(() => {
        try {
            window.localStorage.setItem(LOG_AUTO_REFRESH_INTERVAL_STORAGE_KEY, String(autoRefreshInterval))
        } catch {
            // Ignore storage failures; the control still works for the current session.
        }
    }, [autoRefreshInterval])

    const handleFiltersChange = (newFilters: LogFiltersType) => {
        setFilters(prev => ({
            ...newFilters,
            page: 1,
            per_page: prev.per_page || 10,
        }))
    }

    const handlePageChange = (page: number) => {
        setFilters(prev => ({ ...prev, page }))
    }

    const handlePageSizeChange = (pageSize: number) => {
        setFilters(prev => ({ ...prev, per_page: pageSize, page: 1 }))
    }

    const handleAutoRefreshIntervalChange = (value: string) => {
        const interval = Number(value)
        if (AUTO_REFRESH_INTERVAL_OPTIONS.includes(interval)) {
            setAutoRefreshInterval(interval)
        }
    }

    const handleRetry = () => {
        refetch()
    }

    const handleRefresh = () => {
        refetch()
        refetchStats()
    }

    // 点击 group/token_name → 打开 GroupDialog 的日志标签
    const handleOpenGroupLog = useCallback((group: string, tokenName?: string) => {
        setGroupDialogGroupId(group)
        setGroupDialogTokenName(tokenName)
        setGroupDialogOpen(true)
    }, [])

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 p-4 pb-2 lg:p-6 lg:pb-2">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <div className="flex h-9 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm sm:flex-none">
                            <Switch
                                checked={autoRefreshEnabled}
                                onCheckedChange={setAutoRefreshEnabled}
                                aria-label={t('log.autoRefresh')}
                            />
                            <span className="whitespace-nowrap text-sm font-medium">{t('log.autoRefresh')}</span>
                            <Select
                                value={String(autoRefreshInterval)}
                                onValueChange={handleAutoRefreshIntervalChange}
                                disabled={!autoRefreshEnabled}
                            >
                                <SelectTrigger
                                    size="sm"
                                    className="ml-auto h-7 w-[78px] border-0 bg-muted/70 px-2 shadow-none sm:ml-0"
                                    aria-label={t('log.autoRefreshInterval')}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    {AUTO_REFRESH_INTERVAL_OPTIONS.map((interval) => (
                                        <SelectItem key={interval} value={String(interval)}>
                                            {t(`log.autoRefreshOptions.${interval / 1000}s`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                                aria-expanded={mobileFiltersOpen}
                                className="h-9 px-3 sm:hidden"
                            >
                                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                                {t('log.filters.toggle')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isFetching || isStatsFetching}
                                className="h-9 flex-1 px-3 sm:flex-none"
                            >
                                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching || isStatsFetching ? 'animate-spin' : ''}`} />
                                {t('common.refresh')}
                            </Button>
                            <LogExportDialog
                                scope="global"
                                currentFilters={filters}
                            />
                        </div>
                    </div>

                    <LogStatsCards
                        stats={statsData?.stats}
                        loading={isStatsLoading}
                    />

                    {/* H5 默认收起筛选器以压缩 hero 高度；lg 起常显 */}
                    <div className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}>
                        <LogFilters
                            onFiltersChange={handleFiltersChange}
                            loading={isLoading}
                            availableModels={logData?.models}
                            availableTokenNames={logData?.token_names}
                            availableChannels={logData?.channels}
                        />
                    </div>
                </div>

                {error && (
                    <div className="mt-6">
                        <AdvancedErrorDisplay
                            error={error}
                            onRetry={handleRetry}
                            useCardStyle={true}
                        />
                    </div>
                )}
            </div>

            <div className="flex-1 px-4 pb-4 min-h-0 lg:px-6 lg:pb-6">
                <LogTable
                    data={logData?.logs || []}
                    total={logData?.total || 0}
                    loading={isLoading}
                    page={filters.page || 1}
                    pageSize={filters.per_page || 10}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    onOpenGroupLog={handleOpenGroupLog}
                />
            </div>

            {/* 点击 group/token_name 打开 GroupDialog 日志标签 */}
            <GroupDialog
                open={groupDialogOpen}
                onOpenChange={setGroupDialogOpen}
                groupId={groupDialogGroupId}
                initialTab="logs"
                initialTokenName={groupDialogTokenName}
            />
        </div>
    )
}
