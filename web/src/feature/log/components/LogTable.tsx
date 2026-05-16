import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { ExpandedLogContent } from './ExpandedLogContent'
import { toast } from 'sonner'
import type { LogRecord } from '@/types/log'
import type { LogDetailScope } from '@/feature/log/hooks'

const columnHelper = createColumnHelper<LogRecord>()

// 点击 group/token_name 时不展开行的列 ID
const NON_EXPAND_COLUMNS = new Set(['details', 'group', 'token_name', 'model'])
const RIGHT_ALIGNED_COLUMNS = new Set(['input_tokens', 'output_tokens', 'duration', 'used_amount'])

function useMediaQuery(query: string) {
    const getMatches = () => {
        if (typeof window === 'undefined') {
            return false
        }

        return window.matchMedia(query).matches
    }

    const [matches, setMatches] = useState(getMatches)

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const mediaQuery = window.matchMedia(query)
        const handleChange = () => setMatches(mediaQuery.matches)

        handleChange()
        mediaQuery.addEventListener('change', handleChange)

        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [query])

    return matches
}

interface LogTableProps {
    data: LogRecord[]
    total: number
    loading?: boolean
    page: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
    onOpenGroupLog?: (group: string, tokenName?: string) => void
    detailScope?: LogDetailScope
}

// 使用一个单独的组件来处理每行的展开内容，这样每一行都有自己的state
export function LogTable({
    data,
    total,
    loading = false,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    onOpenGroupLog,
    detailScope = 'admin',
}: LogTableProps) {
    const { t } = useTranslation()
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
    const [selectedMobileLog, setSelectedMobileLog] = useState<LogRecord | null>(null)
    const isDesktop = useMediaQuery('(min-width: 768px)')
    const desktopScrollRef = useRef<HTMLDivElement>(null)
    const mobileScrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isDesktop) {
            setSelectedMobileLog(null)
        }
    }, [isDesktop])

    const toggleRowExpansion = (rowId: number) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(rowId)) {
            newExpanded.delete(rowId)
        } else {
            newExpanded.add(rowId)
        }
        setExpandedRows(newExpanded)
    }

    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(t('common.copied'))
        }).catch(() => {
            toast.error(t('common.copyFailed'))
        })
    }, [t])

    const clickableCell = 'cursor-pointer hover:text-primary hover:underline underline-offset-4 transition-colors'

    const formatDuration = (log: LogRecord) => {
        if (!log.request_at || !log.created_at) {
            return '-'
        }

        const requestAt = new Date(log.request_at)
        const createdAt = new Date(log.created_at)
        const duration = (createdAt.getTime() - requestAt.getTime()) / 1000

        if (Number.isNaN(duration)) {
            return '-'
        }

        return `${duration.toFixed(2)}s`
    }

    const formatCreatedAt = (value?: string | number) => {
        if (!value) {
            return '-'
        }

        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
            return '-'
        }

        return format(date, 'yyyy-MM-dd HH:mm:ss')
    }

    const formatUsedAmount = (log: LogRecord) => `$${Number(log.amount?.used_amount ?? log.used_amount ?? 0).toFixed(4)}`

    const getPriceMultiplier = (log: LogRecord) => {
        const rawValue = log.metadata?.price_multiplier
            || log.metadata?.group_multiplier
            || log.metadata?.multiplier
        const multiplier = Number(rawValue)

        if (!rawValue || Number.isNaN(multiplier) || multiplier <= 0) {
            return 'x1'
        }

        return `x${Number(multiplier.toFixed(4)).toString()}`
    }

    const getAppUserAccount = (log: LogRecord) => log.app_user?.username || log.app_user?.email || log.app_user?.phone || ''

    const renderAppUser = (log: LogRecord) => {
        const userID = log.app_user?.id || log.owner_user_id
        const account = getAppUserAccount(log)

        if (!userID && !account) {
            return <div className="text-sm text-muted-foreground">-</div>
        }

        return (
            <div className="min-w-0 space-y-0.5">
                <div className="truncate text-sm font-medium" title={account || undefined}>
                    {account || '-'}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                    #{userID || '-'}
                </div>
            </div>
        )
    }

    const renderMobileMetric = (label: string, value: React.ReactNode) => (
        <div className="min-w-0 text-left">
            <div className="text-[11px] leading-4 text-muted-foreground">{label}</div>
            <div className="mt-0.5 truncate font-mono text-[12px] leading-5 text-foreground">{value}</div>
        </div>
    )

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: 'details',
                header: '',
                cell: ({ row }) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(row.original.id)}
                        className="h-8 w-8 p-0"
                    >
                        {expandedRows.has(row.original.id) ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>
                ),
                size: 40,
            }),
            columnHelper.accessor('group', {
                header: t('log.group'),
                cell: (info) => {
                    const value = info.getValue()
                    if (!value) return <div className="text-sm text-muted-foreground">-</div>
                    return (
                        <div
                            className={`text-sm font-medium ${onOpenGroupLog ? clickableCell : ''}`}
                            onClick={() => onOpenGroupLog?.(value)}
                        >
                            {value}
                        </div>
                    )
                },
                size: 100,
            }),
            columnHelper.accessor('token_name', {
                header: t('log.keyName'),
                cell: (info) => {
                    const value = info.getValue()
                    const group = info.row.original.group
                    if (!value) return <div className="font-medium text-muted-foreground">-</div>
                    return (
                        <div
                            className={`font-medium ${onOpenGroupLog ? clickableCell : ''}`}
                            onClick={() => group && onOpenGroupLog?.(group, value)}
                        >
                            {value}
                        </div>
                    )
                },
                size: 150,
            }),
            ...(detailScope === 'admin' ? [columnHelper.display({
                id: 'app_user',
                header: t('log.appUser'),
                cell: ({ row }) => renderAppUser(row.original),
                size: 160,
            })] : []),
            columnHelper.accessor('model', {
                header: t('log.model'),
                cell: (info) => {
                    const value = info.getValue()
                    if (!value) return <div className="font-mono text-sm text-muted-foreground">-</div>
                    return (
                        <div
                            className={`font-mono text-sm ${clickableCell}`}
                            onClick={() => copyToClipboard(value)}
                        >
                            {value}
                        </div>
                    )
                },
                size: 120,
            }),
            columnHelper.display({
                id: 'input_tokens',
                header: t('log.inputTokens'),
                cell: ({ row }) => (
                    <div className="text-right font-mono">
                        {row.original.usage?.input_tokens?.toLocaleString() || 0}
                    </div>
                ),
                size: 100,
            }),
            columnHelper.display({
                id: 'output_tokens',
                header: t('log.outputTokens'),
                cell: ({ row }) => (
                    <div className="text-right font-mono">
                        {row.original.usage?.output_tokens?.toLocaleString() || 0}
                    </div>
                ),
                size: 100,
            }),
            columnHelper.display({
                id: 'duration',
                header: t('log.duration'),
                cell: ({ row }) => <div className="text-right font-mono">{formatDuration(row.original)}</div>,
                size: 80,
            }),
            columnHelper.display({
                id: 'used_amount',
                header: t('log.usedAmount'),
                cell: ({ row }) => (
                    <div className="text-right font-mono">
                        ${Number(row.original.amount?.used_amount ?? row.original.used_amount ?? 0).toFixed(4)}
                    </div>
                ),
                size: 100,
            }),
            columnHelper.accessor('code', {
                header: t('log.state'),
                cell: (info) => {
                    const code = info.getValue()
                    const isSuccess = code === 200
                    return (
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={isSuccess ? 'secondary' : 'destructive'}
                                className={isSuccess ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : ''}
                            >
                                {isSuccess ? t('log.success') : t('log.failed')}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                                {code || '-'}
                            </span>
                        </div>
                    )
                },
                size: 80,
            }),
            columnHelper.accessor('created_at', {
                header: t('log.time'),
                cell: (info) => (
                    <div className="text-sm text-muted-foreground">
                        {formatCreatedAt(info.getValue())}
                    </div>
                ),
                size: 140,
            }),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, expandedRows, onOpenGroupLog, copyToClipboard]
    )

    const table = useReactTable({
        data: data || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: Math.ceil(total / pageSize),
    })
    const tableRows = table.getRowModel().rows
    const headerGroups = table.getHeaderGroups()
    const leafHeaders = headerGroups[0]?.headers ?? []
    const desktopGridTemplateColumns = leafHeaders
        .map((header) => `minmax(${header.getSize()}px, ${header.getSize()}fr)`)
        .join(' ')
    const desktopTableWidth = leafHeaders.reduce((width, header) => width + header.getSize(), 0)

    const desktopVirtualizer = useVirtualizer({
        count: tableRows.length,
        getScrollElement: () => desktopScrollRef.current,
        estimateSize: (index) => {
            const rowId = tableRows[index]?.original.id
            return rowId && expandedRows.has(rowId) ? 360 : 54
        },
        getItemKey: (index) => tableRows[index]?.original.id ?? index,
        overscan: 8,
    })

    const mobileVirtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => mobileScrollRef.current,
        estimateSize: () => 220,
        getItemKey: (index) => data[index]?.id ?? index,
        overscan: 6,
    })

    useEffect(() => {
        desktopVirtualizer.measure()
    }, [desktopVirtualizer, expandedRows, tableRows.length])

    useEffect(() => {
        mobileVirtualizer.measure()
    }, [mobileVirtualizer, data])

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                {isDesktop ? (
                    <div className="rounded-lg border border-border bg-card shadow-none h-full overflow-hidden">
                        <div ref={desktopScrollRef} className="overflow-auto h-full">
                            <div
                                className="w-full min-w-[980px]"
                                style={{ minWidth: Math.max(980, desktopTableWidth) }}
                            >
                                <div className="sticky top-0 z-10 bg-muted/50">
                                    {headerGroups.map((headerGroup) => (
                                        <div
                                            key={headerGroup.id}
                                            className="grid border-b border-border"
                                            style={{ gridTemplateColumns: desktopGridTemplateColumns }}
                                        >
                                            {headerGroup.headers.map((header, index) => {
                                                const isRightAligned = RIGHT_ALIGNED_COLUMNS.has(header.column.id)

                                                return (
                                                    <div
                                                        key={header.id}
                                                        className={`px-4 py-3 ${isRightAligned ? 'text-right' : 'text-left'} text-xs font-medium text-muted-foreground uppercase tracking-wider ${
                                                            index === 0 ? 'rounded-tl-lg' : ''
                                                        } ${
                                                            index === headerGroup.headers.length - 1 ? 'rounded-tr-lg' : ''
                                                        }`}
                                                    >
                                                        {header.isPlaceholder
                                                            ? null
                                                            : flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>

                                {loading ? (
                                    <div className="px-4 py-8 text-center">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                            <span className="ml-2">{t('common.loading')}</span>
                                        </div>
                                    </div>
                                ) : data.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-muted-foreground">
                                        {t('common.noResult')}
                                    </div>
                                ) : (
                                    <div
                                        className="relative"
                                        style={{ height: desktopVirtualizer.getTotalSize() }}
                                    >
                                        {desktopVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const row = tableRows[virtualRow.index]

                                            if (!row) {
                                                return null
                                            }

                                            return (
                                                <div
                                                    key={row.original.id}
                                                    ref={desktopVirtualizer.measureElement}
                                                    data-index={virtualRow.index}
                                                    className="absolute left-0 top-0 w-full border-b border-border bg-card"
                                                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                                                >
                                                    <div
                                                        className="grid cursor-pointer transition-colors hover:bg-muted/50"
                                                        style={{ gridTemplateColumns: desktopGridTemplateColumns }}
                                                        onClick={(e) => {
                                                            const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-column-id]')
                                                            const columnId = cell?.dataset.columnId

                                                            if (!columnId || !NON_EXPAND_COLUMNS.has(columnId)) {
                                                                toggleRowExpansion(row.original.id)
                                                            }
                                                        }}
                                                    >
                                                        {row.getVisibleCells().map((cell) => {
                                                            const isRightAligned = RIGHT_ALIGNED_COLUMNS.has(cell.column.id)

                                                            return (
                                                                <div
                                                                    key={cell.id}
                                                                    data-column-id={cell.column.id}
                                                                    className={`min-w-0 px-4 py-3 text-sm ${isRightAligned ? 'text-right' : ''}`}
                                                                >
                                                                    {flexRender(
                                                                        cell.column.columnDef.cell,
                                                                        cell.getContext()
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    {expandedRows.has(row.original.id) && (
                                                        <ExpandedLogContent log={row.original} scope={detailScope} />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div ref={mobileScrollRef} className="h-full min-h-[420px] overflow-auto pr-1">
                        {loading ? (
                            <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
                                {t('common.loading')}
                            </div>
                        ) : data.length === 0 ? (
                            <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                                {t('common.noResult')}
                            </div>
                        ) : (
                            <div
                                className="relative"
                                style={{ height: mobileVirtualizer.getTotalSize() }}
                            >
                                {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const log = data[virtualRow.index]

                                    if (!log) {
                                        return null
                                    }

                                    const isSuccess = log.code === 200

                                    return (
                                        <div
                                            key={log.id}
                                            ref={mobileVirtualizer.measureElement}
                                            data-index={virtualRow.index}
                                            className="absolute left-0 top-0 w-full pb-3"
                                            style={{ transform: `translateY(${virtualRow.start}px)` }}
                                        >
                                            <div className="rounded-md border border-border bg-card p-3 shadow-none">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate font-mono text-[14px] font-semibold leading-5 text-foreground">
                                                            {log.model || '-'}
                                                        </div>
                                                        <div className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">
                                                            {formatCreatedAt(log.created_at)}
                                                        </div>
                                                    </div>
                                                    <div className={isSuccess ? 'shrink-0 text-[14px] font-medium text-green-500' : 'shrink-0 text-[14px] font-medium text-destructive'}>
                                                        {isSuccess ? t('log.success') : t('log.failed')}
                                                    </div>
                                                </div>

                                                <div className="mt-5 flex items-center justify-between gap-3 text-[12px] leading-4 text-muted-foreground">
                                                    <button
                                                        type="button"
                                                        className={onOpenGroupLog && log.group ? 'min-w-0 truncate text-left transition-colors hover:text-primary' : 'min-w-0 truncate text-left'}
                                                        onClick={() => log.group && onOpenGroupLog?.(log.group, log.token_name || undefined)}
                                                    >
                                                        {t('log.group')}: {log.group || '-'}
                                                    </button>
                                                    <div className="shrink-0 whitespace-nowrap">倍率: {getPriceMultiplier(log)}</div>
                                                    <div className="shrink-0 whitespace-nowrap">消费: {formatUsedAmount(log)}</div>
                                                </div>

                                                <div className="mt-4 border-t border-border/70" />

                                                <div className="mt-4 grid w-full grid-cols-4 gap-1">
                                                    {renderMobileMetric(t('log.duration'), formatDuration(log))}
                                                    {renderMobileMetric(t('log.ttfb'), `${log.ttfb_milliseconds || 0}ms`)}
                                                    {renderMobileMetric(t('log.inputTokens'), (log.usage?.input_tokens || 0).toLocaleString())}
                                                    {renderMobileMetric(t('log.outputTokens'), (log.usage?.output_tokens || 0).toLocaleString())}
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="mt-5 h-8 w-full rounded-lg text-[14px] font-normal text-muted-foreground hover:text-foreground"
                                                    onClick={() => setSelectedMobileLog(log)}
                                                >
                                                    {t('log.details')}
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 分页控制 - 固定在底部 */}
            <div className="flex-shrink-0 pt-4">
                <div className="flex flex-col gap-3 px-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground md:flex-1">
                        {t('table.pageInfo', {
                            current: page,
                            total: Math.ceil(total / pageSize) || 1
                        })}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end lg:gap-8">
                        <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium whitespace-nowrap">{t('table.rowsPerPage')}</p>
                            <select
                                value={pageSize}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                className="h-8 max-w-[80px] rounded border border-input bg-background px-2 text-sm"
                            >
                                {[10, 20, 30, 40, 50].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 md:inline-flex"
                                onClick={() => onPageChange(1)}
                                disabled={page <= 1}
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => onPageChange(Math.max(1, page - 1))}
                                disabled={page <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => onPageChange(Math.min(Math.ceil(total / pageSize), page + 1))}
                                disabled={page >= Math.ceil(total / pageSize)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 md:inline-flex"
                                onClick={() => onPageChange(Math.ceil(total / pageSize))}
                                disabled={page >= Math.ceil(total / pageSize)}
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            {!isDesktop && (
                <Dialog open={!!selectedMobileLog} onOpenChange={(open) => !open && setSelectedMobileLog(null)}>
                    <DialogContent className="max-h-[88dvh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
                        <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-6">
                            <DialogTitle className="break-all pr-8 font-mono text-base leading-6">
                                {selectedMobileLog?.model || t('log.details')}
                            </DialogTitle>
                            <DialogDescription className="break-all text-xs">
                                {selectedMobileLog?.request_id || (selectedMobileLog ? `#${selectedMobileLog.id}` : '')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[calc(88dvh-92px)] overflow-y-auto p-3 sm:p-4">
                            {selectedMobileLog && <ExpandedLogContent log={selectedMobileLog} scope={detailScope} />}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
