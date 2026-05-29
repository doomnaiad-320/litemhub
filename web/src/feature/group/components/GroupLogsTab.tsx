// src/feature/group/components/GroupLogsTab.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { logApi } from '@/api/log'
import { LogExportDialog } from '@/feature/log/components/LogExportDialog'
import { LogTable } from '@/feature/log/components/LogTable'
import { LogFilters } from '@/feature/log/components/LogFilters'
import { Button } from '@/components/ui/button'
import type { LogFilters as LogFiltersType } from '@/types/log'
import { DEFAULT_TIMEZONE, zonedBoundaryToUnixMs } from '@/utils/timezone'

interface GroupLogsTabProps {
    groupId: string
    initialTokenName?: string
}

export function GroupLogsTab({ groupId, initialTokenName }: GroupLogsTabProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string

    const getDefaultFilters = (): LogFiltersType => {
        const today = new Date()
        const oneDayAgo = new Date()
        oneDayAgo.setDate(today.getDate() - 1)
        return {
            token_name: initialTokenName || undefined,
            code_type: 'all',
            page: 1,
            per_page: 10,
            start_timestamp: zonedBoundaryToUnixMs(oneDayAgo, DEFAULT_TIMEZONE, false),
            end_timestamp: zonedBoundaryToUnixMs(today, DEFAULT_TIMEZONE, true),
        }
    }

    const [filters, setFilters] = useState<LogFiltersType>(getDefaultFilters())

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['groupLogs', groupId, filters],
        queryFn: () => logApi.getLogsByGroup(groupId, filters),
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: false,
    })

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

    return (
        <div className="flex flex-col h-full gap-2">
            <div className="flex-shrink-0">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="h-9 px-3"
                        >
                            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                            {t('common.refresh')}
                        </Button>
                        <LogExportDialog
                            scope="group"
                            groupId={groupId}
                            currentFilters={filters}
                        />
                    </div>

                    <LogFilters
                        onFiltersChange={handleFiltersChange}
                        loading={isLoading}
                        availableModels={data?.models}
                        availableTokenNames={data?.token_names}
                        availableChannels={data?.channels}
                        tokenNameFirst
                        defaultTokenName={initialTokenName}
                    />
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <LogTable
                    data={data?.logs || []}
                    total={data?.total || 0}
                    loading={isLoading}
                    page={filters.page || 1}
                    pageSize={filters.per_page || 10}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                />
            </div>
        </div>
    )
}
