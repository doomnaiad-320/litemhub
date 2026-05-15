import { useCallback, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
} from '@tanstack/react-table'
import {
    BadgeDollarSign,
    Eye,
    Gauge,
    Key,
    MoreHorizontal,
    Pencil,
    Plus,
    Power,
    PowerOff,
    RefreshCcw,
    Search,
    Trash2,
    User,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { AnimatedButton } from '@/components/ui/animation/components/animated-button'
import { AnimatedIcon } from '@/components/ui/animation/components/animated-icon'
import { cn } from '@/lib/utils'
import type { AppUser } from '@/types/app-user'
import { APP_USER_STATUS } from '@/types/app-user'
import {
    useAppUsers,
    useDeleteAppUser,
    useUpdateAppUserStatus,
} from '../hooks'
import { AppUserBalanceAdjustDialog } from './AppUserBalanceAdjustDialog'
import { AppUserDetailSheet } from './AppUserDetailSheet'
import { AppUserDialog } from './AppUserDialog'
import { AppUserGroupPriceMultiplierDialog } from './AppUserGroupPriceMultiplierDialog'
import { AppUserResetPasswordDialog } from './AppUserResetPasswordDialog'

const formatDateTime = (timestamp: number) => {
    if (!timestamp) return '-'
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm')
}

const formatMoney = (amount: number) => `$${(amount || 0).toFixed(4)}`

const getUserDisplayName = (user: AppUser) => user.username || user.email || user.phone || `#${user.id}`

const getStatusBadgeClass = (status: number) => status === APP_USER_STATUS.DISABLED
    ? 'border-transparent bg-zinc-200/80 text-zinc-700 dark:bg-zinc-700/70 dark:text-zinc-100'
    : 'border-transparent bg-primary/12 text-primary dark:bg-primary/20 dark:text-primary-foreground'

export function AppUserTable() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [searchInput, setSearchInput] = useState('')
    const [searchKeyword, setSearchKeyword] = useState<string | undefined>(undefined)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [isRefreshAnimating, setIsRefreshAnimating] = useState(false)
    const [detailOpen, setDetailOpen] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [balanceAdjustOpen, setBalanceAdjustOpen] = useState(false)
    const [passwordOpen, setPasswordOpen] = useState(false)
    const [groupPriceMultiplierOpen, setGroupPriceMultiplierOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)
    const [dialogMode, setDialogMode] = useState<'create' | 'update'>('create')
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

    const statusValue = statusFilter === 'all' ? undefined : Number(statusFilter)
    const { data, isLoading, refetch } = useAppUsers(page, pageSize, searchKeyword, statusValue)
    const { updateAppUserStatus, isLoading: isStatusUpdating } = useUpdateAppUserStatus()
    const { deleteAppUser, isLoading: isDeleting } = useDeleteAppUser()

    const users = useMemo(() => data?.app_users || [], [data?.app_users])
    const total = data?.total || 0

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value)
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        searchTimerRef.current = setTimeout(() => {
            setSearchKeyword(value || undefined)
            setPage(1)
        }, 300)
    }, [])

    const openCreateDialog = () => {
        setDialogMode('create')
        setSelectedUser(null)
        setDialogOpen(true)
    }

    const openEditDialog = (user: AppUser) => {
        setDialogMode('update')
        setSelectedUser(user)
        setDialogOpen(true)
    }

    const openDetail = (user: AppUser) => {
        setSelectedUser(user)
        setDetailOpen(true)
    }

    const openBalanceAdjustDialog = (user: AppUser) => {
        setSelectedUser(user)
        setBalanceAdjustOpen(true)
    }

    const openResetPasswordDialog = (user: AppUser) => {
        setSelectedUser(user)
        setPasswordOpen(true)
    }

    const openGroupPriceMultiplierDialog = (user: AppUser) => {
        setSelectedUser(user)
        setGroupPriceMultiplierOpen(true)
    }

    const openDeleteDialog = (user: AppUser) => {
        setSelectedUser(user)
        setDeleteOpen(true)
    }

    const refreshUsers = () => {
        setIsRefreshAnimating(true)
        refetch()
        setTimeout(() => {
            setIsRefreshAnimating(false)
        }, 1000)
    }

    const handleStatusChange = (user: AppUser) => {
        const nextStatus = user.status === APP_USER_STATUS.DISABLED
            ? APP_USER_STATUS.ENABLED
            : APP_USER_STATUS.DISABLED

        updateAppUserStatus({
            id: user.id,
            data: { status: nextStatus },
        })
    }

    const handleDelete = () => {
        if (!selectedUser) {
            return
        }

        deleteAppUser(selectedUser.id, {
            onSuccess: () => setDeleteOpen(false),
        })
    }

    const columns: ColumnDef<AppUser>[] = useMemo(() => [
        {
            accessorKey: 'id',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">ID</div>,
            cell: ({ row }) => (
                <div className="font-mono text-sm text-muted-foreground">#{row.original.id}</div>
            ),
        },
        {
            id: 'account',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.account')}</div>,
            cell: ({ row }) => (
                <div className="space-y-1">
                    <div className="font-medium">{getUserDisplayName(row.original)}</div>
                    <div className="text-xs text-muted-foreground">
                        {[row.original.email, row.original.phone].filter(Boolean).join(' / ') || t('appUser.emptyAccount')}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.status')}</div>,
            cell: ({ row }) => (
                <Badge variant="outline" className={getStatusBadgeClass(row.original.status)}>
                    {row.original.status === APP_USER_STATUS.DISABLED ? t('appUser.disabled') : t('appUser.enabled')}
                </Badge>
            ),
        },
        {
            accessorKey: 'available_balance',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.availableBalance')}</div>,
            cell: ({ row }) => (
                <div className="font-mono text-sm">{formatMoney(row.original.available_balance)}</div>
            ),
        },
        {
            accessorKey: 'frozen_balance',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.frozenBalance')}</div>,
            cell: ({ row }) => (
                <div className="font-mono text-sm text-muted-foreground">{formatMoney(row.original.frozen_balance)}</div>
            ),
        },
        {
            accessorKey: 'created_at',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">{t('appUser.createdAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">{formatDateTime(row.original.created_at)}</div>
            ),
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(row.original)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('appUser.view')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {t('appUser.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openBalanceAdjustDialog(row.original)}>
                                <BadgeDollarSign className="mr-2 h-4 w-4" />
                                {t('appUser.adjustBalance')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetPasswordDialog(row.original)}>
                                <Key className="mr-2 h-4 w-4" />
                                {t('appUser.resetPassword')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openGroupPriceMultiplierDialog(row.original)}>
                                <Gauge className="mr-2 h-4 w-4" />
                                {t('appUser.groupPriceMultiplier')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => handleStatusChange(row.original)}
                                disabled={isStatusUpdating}
                            >
                                {row.original.status === APP_USER_STATUS.DISABLED ? (
                                    <>
                                        <Power className="mr-2 h-4 w-4 text-emerald-600" />
                                        {t('appUser.enable')}
                                    </>
                                ) : (
                                    <>
                                        <PowerOff className="mr-2 h-4 w-4 text-amber-600" />
                                        {t('appUser.disable')}
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => openDeleteDialog(row.original)}
                                className="text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('appUser.delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [isStatusUpdating, t])

    const table = useReactTable({
        data: users,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="flex h-full min-h-0 flex-col">
            <Card className="flex min-h-0 flex-1 flex-col gap-0 rounded-[28px] border border-white/70 bg-white/75 p-0 shadow-[0_20px_44px_-30px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-card/80">
                <div className="flex flex-col gap-5 border-b border-border/60 px-6 py-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-primary">
                                <User className="h-4 w-4" />
                                {t('sidebar.appUsers')}
                            </div>
                            <h2 className="text-2xl font-semibold tracking-tight">{t('appUser.management')}</h2>
                            <p className="max-w-2xl text-sm text-muted-foreground">
                                {t('appUser.description')}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder={t('common.search')}
                                    value={searchInput}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="h-10 w-56 rounded-2xl border-border/70 bg-background/80 pl-9 shadow-none"
                                />
                            </div>

                            <Select
                                value={statusFilter}
                                onValueChange={(value) => {
                                    setStatusFilter(value)
                                    setPage(1)
                                }}
                            >
                                <SelectTrigger className="h-10 w-[160px] rounded-2xl border-border/70 bg-background/80 shadow-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('appUser.allStatus')}</SelectItem>
                                    <SelectItem value="1">{t('appUser.enabled')}</SelectItem>
                                    <SelectItem value="2">{t('appUser.disabled')}</SelectItem>
                                </SelectContent>
                            </Select>

                            <AnimatedButton>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={refreshUsers}
                                    className="h-10 rounded-2xl border-border/70 bg-background/80 px-4"
                                >
                                    <AnimatedIcon
                                        animationVariant="continuous-spin"
                                        isAnimating={isRefreshAnimating}
                                        className="h-4 w-4"
                                    >
                                        <RefreshCcw className="h-4 w-4" />
                                    </AnimatedIcon>
                                    {t('appUser.refresh')}
                                </Button>
                            </AnimatedButton>

                            <AnimatedButton>
                                <Button
                                    size="sm"
                                    onClick={openCreateDialog}
                                    className="h-10 rounded-2xl px-4"
                                >
                                    <Plus className="h-4 w-4" />
                                    {t('appUser.add')}
                                </Button>
                            </AnimatedButton>
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 overflow-auto px-6 py-4">
                        <div className="overflow-hidden rounded-[22px] border border-border/60 bg-background/80">
                            <DataTable
                                table={table}
                                columns={columns}
                                isLoading={isLoading}
                                loadingStyle="skeleton"
                                fixedHeader={true}
                                animatedRows={true}
                                showScrollShadows={false}
                                onRowClick={openDetail}
                            />
                        </div>
                    </div>

                    <div className="border-t border-border/60 px-4 pb-2">
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
                </div>
            </Card>

            <AppUserDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                mode={dialogMode}
                user={dialogMode === 'update' ? selectedUser : null}
            />

            <AppUserBalanceAdjustDialog
                open={balanceAdjustOpen}
                onOpenChange={setBalanceAdjustOpen}
                user={selectedUser}
            />

            <AppUserResetPasswordDialog
                open={passwordOpen}
                onOpenChange={setPasswordOpen}
                user={selectedUser}
            />

            <AppUserGroupPriceMultiplierDialog
                open={groupPriceMultiplierOpen}
                onOpenChange={setGroupPriceMultiplierOpen}
                user={selectedUser}
            />

            <AppUserDetailSheet
                open={detailOpen}
                onOpenChange={setDetailOpen}
                user={selectedUser}
                onEdit={openEditDialog}
                onAdjustBalance={openBalanceAdjustDialog}
                onResetPassword={openResetPasswordDialog}
                onSetGroupPriceMultiplier={openGroupPriceMultiplierDialog}
            />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('appUser.deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('appUser.deleteDialog.description', {
                                account: selectedUser ? getUserDisplayName(selectedUser) : '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className={cn(isDeleting && 'pointer-events-none opacity-60')}
                        >
                            {t('appUser.deleteDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
