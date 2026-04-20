import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
} from '@tanstack/react-table'
import { Pencil, Wallet, Key, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { Separator } from '@/components/ui/separator'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { AppUser, AppWalletLog } from '@/types/app-user'
import { useAppUser, useAppUserWallet, useAppUserWalletLogs } from '../hooks'

interface AppUserDetailSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: AppUser | null
    onEdit?: (user: AppUser) => void
    onRecharge?: (user: AppUser) => void
    onResetPassword?: (user: AppUser) => void
}

const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return '-'
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm')
}

const formatMoney = (amount?: number) => {
    return `$${(amount || 0).toFixed(4)}`
}

function getStatusBadgeClass(status: number) {
    return status === 2
        ? 'border-transparent bg-zinc-200/80 text-zinc-700 dark:bg-zinc-700/70 dark:text-zinc-100'
        : 'border-transparent bg-primary/12 text-primary dark:bg-primary/20 dark:text-primary-foreground'
}

function getLogTypeBadgeClass(type: string) {
    switch (type) {
        case 'recharge':
            return 'border-transparent bg-primary/12 text-primary'
        case 'reserve':
            return 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        case 'settle':
            return 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        case 'release':
            return 'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'
        default:
            return 'border-transparent bg-muted text-muted-foreground'
    }
}

function getLogTypeLabel(type: string, t: (key: string) => string) {
    switch (type) {
        case 'recharge':
            return t('appUser.logTypes.recharge')
        case 'reserve':
            return t('appUser.logTypes.reserve')
        case 'settle':
            return t('appUser.logTypes.settle')
        case 'release':
            return t('appUser.logTypes.release')
        case 'adjust':
            return t('appUser.logTypes.adjust')
        default:
            return type
    }
}

function InfoRow({
    label,
    value,
}: {
    label: string
    value: string
}) {
    return (
        <div className="flex items-start justify-between gap-4 py-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="max-w-[70%] text-right text-sm font-medium break-all">{value || '-'}</span>
        </div>
    )
}

export function AppUserDetailSheet({
    open,
    onOpenChange,
    user,
    onEdit,
    onRecharge,
    onResetPassword,
}: AppUserDetailSheetProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const userId = user?.id

    useEffect(() => {
        setPage(1)
    }, [userId, open])

    const { data: userData, isLoading: isUserLoading } = useAppUser(userId, open && !!userId)
    const { data: walletData, isLoading: isWalletLoading } = useAppUserWallet(userId, open && !!userId)
    const { data: logData, isLoading: isLogsLoading } = useAppUserWalletLogs(
        userId,
        page,
        pageSize,
        open && !!userId,
    )

    const currentUser = userData?.user || user
    const wallet = walletData?.wallet
    const logs = logData?.wallet_logs || []
    const totalLogs = logData?.total || 0
    const account = currentUser?.email || currentUser?.phone || `#${currentUser?.id ?? ''}`

    const columns: ColumnDef<AppWalletLog>[] = useMemo(() => [
        {
            accessorKey: 'type',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.logType')}</div>,
            cell: ({ row }) => (
                <Badge variant="outline" className={cn('capitalize', getLogTypeBadgeClass(row.original.type))}>
                    {getLogTypeLabel(row.original.type, t)}
                </Badge>
            ),
        },
        {
            accessorKey: 'amount',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.amount')}</div>,
            cell: ({ row }) => (
                <div className="font-mono text-sm">{formatMoney(row.original.amount)}</div>
            ),
        },
        {
            id: 'balance',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.balanceChange')}</div>,
            cell: ({ row }) => (
                <div className="space-y-1 font-mono text-xs text-muted-foreground">
                    <div>{formatMoney(row.original.balance_before)} → {formatMoney(row.original.balance_after)}</div>
                    {row.original.request_id && (
                        <div className="truncate text-[11px]">{t('appUser.requestId')}: {row.original.request_id}</div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'remark',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.remark')}</div>,
            cell: ({ row }) => (
                <div className="max-w-[260px] text-sm text-muted-foreground break-words">
                    {row.original.remark || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'created_at',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.createdAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {formatDateTime(row.original.created_at)}
                </div>
            ),
        },
    ], [t])

    const table = useReactTable({
        data: logs,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl">
                <SheetHeader className="border-b border-border/60 px-6 py-5">
                    <div className="pr-8">
                        <SheetTitle className="text-xl">{t('appUser.detail.title')}</SheetTitle>
                        <SheetDescription>{t('appUser.detail.description')}</SheetDescription>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {currentUser && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onEdit?.(currentUser)}>
                                    <Pencil className="h-4 w-4" />
                                    {t('appUser.edit')}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => onRecharge?.(currentUser)}>
                                    <Wallet className="h-4 w-4" />
                                    {t('appUser.recharge')}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => onResetPassword?.(currentUser)}>
                                    <Key className="h-4 w-4" />
                                    {t('appUser.resetPassword')}
                                </Button>
                            </>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {(isUserLoading && !currentUser) ? (
                        <div className="space-y-4">
                            <Skeleton className="h-24 rounded-2xl" />
                            <Skeleton className="h-48 rounded-2xl" />
                        </div>
                    ) : currentUser ? (
                        <div className="space-y-6">
                            <div className="rounded-3xl border border-border/60 bg-white/75 p-5 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:bg-card/75">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="text-sm text-muted-foreground">{t('appUser.user')}</div>
                                        <div className="text-2xl font-semibold tracking-tight">{account}</div>
                                        <div className="text-sm text-muted-foreground">ID #{currentUser.id}</div>
                                    </div>

                                    <Badge variant="outline" className={getStatusBadgeClass(currentUser.status)}>
                                        {currentUser.status === 2 ? t('appUser.disabled') : t('appUser.enabled')}
                                    </Badge>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="h-11 rounded-2xl bg-muted/60 p-1">
                                    <TabsTrigger value="overview" className="rounded-xl px-4">
                                        {t('appUser.detail.overview')}
                                    </TabsTrigger>
                                    <TabsTrigger value="logs" className="rounded-xl px-4">
                                        {t('appUser.walletLogs')}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="m-0 space-y-4">
                                    <Card className="gap-0 rounded-3xl border-border/60 bg-white/70 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.4)] backdrop-blur-sm dark:bg-card/75">
                                        <CardHeader className="px-5 py-4">
                                            <CardTitle className="text-base">{t('appUser.detail.userInfo')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-5">
                                            <InfoRow label={t('appUser.email')} value={currentUser.email || '-'} />
                                            <Separator />
                                            <InfoRow label={t('appUser.phone')} value={currentUser.phone || '-'} />
                                            <Separator />
                                            <InfoRow label={t('appUser.createdAt')} value={formatDateTime(currentUser.created_at)} />
                                            <Separator />
                                            <InfoRow label={t('appUser.updatedAt')} value={formatDateTime(currentUser.updated_at)} />
                                        </CardContent>
                                    </Card>

                                    <Card className="gap-0 rounded-3xl border-border/60 bg-white/70 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.4)] backdrop-blur-sm dark:bg-card/75">
                                        <CardHeader className="px-5 py-4">
                                            <CardTitle className="text-base">{t('appUser.detail.walletInfo')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-5 pb-5">
                                            {isWalletLoading && !wallet ? (
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <Skeleton className="h-24 rounded-2xl" />
                                                    <Skeleton className="h-24 rounded-2xl" />
                                                    <Skeleton className="h-24 rounded-2xl" />
                                                </div>
                                            ) : wallet ? (
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                                                        <div className="text-sm text-muted-foreground">{t('appUser.availableBalance')}</div>
                                                        <div className="mt-2 text-2xl font-semibold">{formatMoney(wallet.available_balance)}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                                                        <div className="text-sm text-muted-foreground">{t('appUser.frozenBalance')}</div>
                                                        <div className="mt-2 text-2xl font-semibold">{formatMoney(wallet.frozen_balance)}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                                                        <div className="text-sm text-muted-foreground">{t('appUser.totalBalance')}</div>
                                                        <div className="mt-2 text-2xl font-semibold">
                                                            {formatMoney(wallet.available_balance + wallet.frozen_balance)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">{t('common.noResult')}</div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="logs" className="m-0">
                                    <Card className="gap-0 rounded-3xl border-border/60 bg-white/70 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.4)] backdrop-blur-sm dark:bg-card/75">
                                        <CardHeader className="px-5 py-4">
                                            <CardTitle className="text-base">{t('appUser.walletLogs')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-0 pb-0">
                                            <div className="px-5 pb-5">
                                                {isLogsLoading && (
                                                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        {t('common.loading')}
                                                    </div>
                                                )}
                                                <DataTable
                                                    table={table}
                                                    columns={columns}
                                                    isLoading={isLogsLoading}
                                                    loadingStyle="skeleton"
                                                    fixedHeader={true}
                                                    showScrollShadows={false}
                                                />
                                            </div>
                                            <div className="border-t border-border/60 px-3">
                                                <ServerPagination
                                                    page={page}
                                                    pageSize={pageSize}
                                                    total={totalLogs}
                                                    onPageChange={setPage}
                                                    onPageSizeChange={(size) => {
                                                        setPageSize(size)
                                                        setPage(1)
                                                    }}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">{t('common.noResult')}</div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
