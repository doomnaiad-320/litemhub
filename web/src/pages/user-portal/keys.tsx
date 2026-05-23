import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
} from '@tanstack/react-table'
import { CalendarIcon, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { MultiSelectCombobox } from '@/components/select/MultiSelectCombobox'
import { useUserPortalCreateKey, useUserPortalDeleteKey, useUserPortalGroups, useUserPortalKeys, useUserPortalLineRoutes, useUserPortalUpdateKey } from '@/feature/user-portal/hooks'
import type { Token } from '@/types/token'
import type { UserPortalLineRoute } from '@/types/user-portal'

interface CreateKeyFormValues {
    name: string
    group: string
    models: string[]
    unlimitedQuota: boolean
    quota?: number
    expiredDate?: string
    expiredTime: string
}

interface UpdateKeyGroupFormValues {
    group: string
    models: string[]
    unlimitedQuota: boolean
    quota?: number
    expiredDate?: string
    expiredTime: string
}

const formatQuota = (quota?: number) => {
    if (!quota || quota <= 0) return '∞'

    return `$${quota.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

const formatExpirationDate = (value?: number) => {
    if (!value) return ''

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const pad = (number: number) => String(number).padStart(2, '0')

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const formatExpirationTime = (value?: number) => {
    if (!value) return '23:59'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '23:59'

    const pad = (number: number) => String(number).padStart(2, '0')

    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const expirationInputToTimestamp = (dateValue?: string, timeValue = '23:59') => {
    if (!dateValue) return 0

    const date = new Date(`${dateValue}T${timeValue || '23:59'}`)
    if (Number.isNaN(date.getTime())) return 0

    return date.getTime()
}

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const minuteOptions = ['00', '15', '30', '45']

function DateTimePicker({
    dateValue,
    timeValue,
    onDateChange,
    onTimeChange,
    placeholder,
    clearLabel,
}: {
    dateValue?: string
    timeValue: string
    onDateChange: (value: string) => void
    onTimeChange: (value: string) => void
    placeholder: string
    clearLabel: string
}) {
    const selectedDate = dateValue ? new Date(`${dateValue}T00:00`) : undefined
    const [hour = '23', minute = '59'] = (timeValue || '23:59').split(':')
    const displayValue = dateValue
        ? format(new Date(`${dateValue}T${timeValue || '23:59'}`), 'yyyy-MM-dd HH:mm')
        : placeholder

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={`h-11 w-full justify-start rounded-md border-border bg-background text-left font-normal shadow-none ${!dateValue ? 'text-muted-foreground' : ''}`}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {displayValue}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    autoFocus
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                        if (!date) {
                            onDateChange('')
                            return
                        }

                        onDateChange(format(date, 'yyyy-MM-dd'))
                    }}
                />
                <div className="flex items-center gap-2 border-t border-border p-3">
                    <Select value={hour} onValueChange={(value) => onTimeChange(`${value}:${minute}`)}>
                        <SelectTrigger className="h-10 w-[92px] rounded-md">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                            {hourOptions.map((value) => (
                                <SelectItem key={value} value={value}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">:</span>
                    <Select value={minute} onValueChange={(value) => onTimeChange(`${hour}:${value}`)}>
                        <SelectTrigger className="h-10 w-[92px] rounded-md">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {minuteOptions.map((value) => (
                                <SelectItem key={value} value={value}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {dateValue && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="ml-auto h-10 px-3 text-xs"
                            onClick={() => onDateChange('')}
                        >
                            {clearLabel}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

type PortalT = (key: string, options?: Record<string, unknown>) => string
const LINE_ROUTE_PREVIEW_LIMIT = 2

const formatDateTime = (value?: number) => {
    if (!value) return ''

    return format(new Date(value), 'yyyy-MM-dd HH:mm')
}

const getExpirationText = (t: PortalT, value?: number) => {
    return value ? formatDateTime(value) : t('portal.keys.neverExpires')
}

const getModelLimitText = (t: PortalT, token: Token) => {
    return token.models && token.models.length > 0
        ? t('portal.keys.modelLimitCount', { count: token.models.length })
        : t('portal.keys.allModels')
}

function ApiEndpointRow({
    lineRoute,
    onCopy,
    t,
}: {
    lineRoute: UserPortalLineRoute
    onCopy: (value: string) => void
    t: PortalT
}) {
    return (
        <div className="flex items-center gap-3 py-2.5">
            <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onCopy(lineRoute.api_url)}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{lineRoute.description}</span>
                    {lineRoute.note && (
                        <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{lineRoute.note}</span>
                    )}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
                    {lineRoute.api_url}
                </div>
            </button>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-md"
                onClick={() => onCopy(lineRoute.api_url)}
            >
                <Copy className="h-3.5 w-3.5" />
                <span className="sr-only">{t('portal.keys.copyApiUrl')}</span>
            </Button>
        </div>
    )
}

function ApiEndpointList({
    lineRoutes,
    onCopy,
    t,
    limit,
}: {
    lineRoutes: UserPortalLineRoute[]
    onCopy: (value: string) => void
    t: PortalT
    limit?: number
}) {
    if (lineRoutes.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground dark:border-white/10">
                {t('portal.keys.noLineRoutes')}
            </div>
        )
    }

    const visibleLineRoutes = typeof limit === 'number' ? lineRoutes.slice(0, limit) : lineRoutes

    return (
        <div className="divide-y divide-border/60 border-y border-border/60 dark:divide-white/10 dark:border-white/10">
            {visibleLineRoutes.map((lineRoute) => (
                <ApiEndpointRow
                    key={lineRoute.id}
                    lineRoute={lineRoute}
                    onCopy={onCopy}
                    t={t}
                />
            ))}
        </div>
    )
}

function KeyMobileCard({
    token,
    onCopy,
    onEdit,
    onDelete,
    t,
}: {
    token: Token
    onCopy: (value: string) => void
    onEdit: (token: Token) => void
    onDelete: (id: number) => void
    t: PortalT
}) {
    return (
        <div className="rounded-md border border-border bg-background p-4 shadow-none dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{token.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(token.created_at)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(token)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(token.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            </div>

            <button
                type="button"
                className="mt-4 flex w-full items-center gap-2 rounded-md bg-muted/70 px-3 py-2 text-left transition-colors hover:bg-muted"
                onClick={() => onCopy(token.key)}
            >
                <code className="min-w-0 flex-1 truncate text-xs">{token.key}</code>
                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
                <div className="min-w-0">
                    <div className="text-muted-foreground">{t('portal.keys.group')}</div>
                    <div className="mt-1 truncate text-sm font-medium">{token.group}</div>
                </div>
                <div className="min-w-0">
                    <div className="text-muted-foreground">{t('portal.keys.quota')}</div>
                    <div className="mt-1 truncate font-mono text-sm font-semibold">{formatQuota(token.quota)}</div>
                </div>
                <div className="min-w-0">
                    <div className="text-muted-foreground">{t('portal.keys.expiredAt')}</div>
                    <div className="mt-1 truncate text-sm font-medium">{getExpirationText(t, token.expired_at)}</div>
                </div>
            </div>
        </div>
    )
}

export default function UserPortalKeysPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const groupFilter = 'all'
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [lineRoutesDialogOpen, setLineRoutesDialogOpen] = useState(false)
    const [editingKey, setEditingKey] = useState<Token | null>(null)

    const { data: groupsData } = useUserPortalGroups(true)
    const { data: lineRoutesData } = useUserPortalLineRoutes(true)
    const { data, isLoading } = useUserPortalKeys(page, pageSize, groupFilter === 'all' ? undefined : groupFilter, true)
    const createKeyMutation = useUserPortalCreateKey()
    const deleteKeyMutation = useUserPortalDeleteKey()
    const updateKeyMutation = useUserPortalUpdateKey()

    const groups = groupsData?.groups || []
    const lineRoutes = lineRoutesData?.line_routes || []
    const hasMoreLineRoutes = lineRoutes.length > LINE_ROUTE_PREVIEW_LIMIT
    const keys = data?.keys || []
    const total = data?.total || 0
    const groupModelsByGroup = useMemo(() => {
        return new Map(groups.map((group) => [group.group, group.models || []]))
    }, [groups])

    const schema = useMemo((): z.ZodType<CreateKeyFormValues> => z.object({
        name: z.string().trim().min(1, t('portal.keys.nameRequired')),
        group: z.string().trim().min(1, t('portal.keys.groupRequired')),
        models: z.array(z.string()),
        unlimitedQuota: z.boolean(),
        quota: z.coerce.number().optional(),
        expiredDate: z.string().optional(),
        expiredTime: z.string(),
    }).refine((value) => value.unlimitedQuota || (value.quota ?? 0) > 0, {
        path: ['quota'],
        message: t('portal.keys.quotaRequired'),
    }), [t])

    const form = useForm<CreateKeyFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            group: '',
            models: [],
            unlimitedQuota: true,
            quota: undefined,
            expiredDate: '',
            expiredTime: '23:59',
        },
    })

    const editSchema = useMemo((): z.ZodType<UpdateKeyGroupFormValues> => z.object({
        group: z.string().trim().min(1, t('portal.keys.groupRequired')),
        models: z.array(z.string()),
        unlimitedQuota: z.boolean(),
        quota: z.coerce.number().optional(),
        expiredDate: z.string().optional(),
        expiredTime: z.string(),
    }).refine((value) => value.unlimitedQuota || (value.quota ?? 0) > 0, {
        path: ['quota'],
        message: t('portal.keys.quotaRequired'),
    }), [t])

    const editForm = useForm<UpdateKeyGroupFormValues>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            group: '',
            models: [],
            unlimitedQuota: true,
            quota: undefined,
            expiredDate: '',
            expiredTime: '23:59',
        },
    })
    const selectedCreateGroup = form.watch('group')
    const selectedEditGroup = editForm.watch('group')
    const createGroupModels = groupModelsByGroup.get(selectedCreateGroup) || []
    const editGroupModels = groupModelsByGroup.get(selectedEditGroup) || []

    const onSubmit = (values: CreateKeyFormValues) => {
        createKeyMutation.mutate({
            name: values.name.trim(),
            group: values.group,
            models: values.models,
            quota: values.unlimitedQuota ? 0 : (values.quota || 0),
            expired_at: expirationInputToTimestamp(values.expiredDate, values.expiredTime),
        }, {
            onSuccess: () => {
                setDialogOpen(false)
                form.reset({
                    name: '',
                    group: '',
                    models: [],
                    unlimitedQuota: true,
                    quota: undefined,
                    expiredDate: '',
                    expiredTime: '23:59',
                })
            },
        })
    }

    const copyValueToClipboard = async (value: string, successMessage: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success(successMessage)
        } catch {
            toast.error(t('portal.keys.copyFailed'))
        }
    }

    const copyKeyToClipboard = (value: string) => {
        copyValueToClipboard(value, t('portal.keys.copied'))
    }

    const copyApiUrlToClipboard = (value: string) => {
        copyValueToClipboard(value, t('portal.keys.apiUrlCopied'))
    }

    const openEditDialog = (token: Token) => {
        setEditingKey(token)
        editForm.reset({
            group: token.group,
            models: token.models || [],
            unlimitedQuota: !token.quota || token.quota <= 0,
            quota: token.quota && token.quota > 0 ? token.quota : undefined,
            expiredDate: formatExpirationDate(token.expired_at),
            expiredTime: formatExpirationTime(token.expired_at),
        })
        setEditDialogOpen(true)
    }

    const onSubmitEdit = (values: UpdateKeyGroupFormValues) => {
        if (!editingKey) {
            return
        }

        updateKeyMutation.mutate({
            id: editingKey.id,
            data: {
                group: values.group,
                models: values.models,
                quota: values.unlimitedQuota ? 0 : (values.quota || 0),
                expired_at: expirationInputToTimestamp(values.expiredDate, values.expiredTime),
            },
        }, {
            onSuccess: () => {
                setEditDialogOpen(false)
                setEditingKey(null)
            },
        })
    }

    const columns: ColumnDef<Token>[] = useMemo(() => [
        {
            accessorKey: 'name',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.name')}</div>,
            cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
        },
        {
            accessorKey: 'group',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.group')}</div>,
            cell: ({ row }) => (
                <Badge variant="outline" className="rounded-md border-border bg-background px-3 py-1">
                    {row.original.group}
                </Badge>
            ),
        },
        {
            accessorKey: 'key',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.key')}</div>,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <code className="max-w-[220px] truncate rounded-lg bg-muted px-2 py-1 text-xs">
                        {row.original.key}
                    </code>
                    <Button variant="ghost" size="icon" onClick={() => copyKeyToClipboard(row.original.key)}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
        {
            accessorKey: 'models',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.models')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {getModelLimitText(t, row.original)}
                </div>
            ),
        },
        {
            accessorKey: 'quota',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.quota')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {formatQuota(row.original.quota)}
                </div>
            ),
        },
        {
            accessorKey: 'expired_at',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.expiredAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {getExpirationText(t, row.original.expired_at)}
                </div>
            ),
        },
        {
            accessorKey: 'created_at',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.createdAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {formatDateTime(row.original.created_at)}
                </div>
            ),
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(row.original)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                deleteKeyMutation.mutate(row.original.id)
                            }}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            ),
        },
    ], [deleteKeyMutation, t, updateKeyMutation])

    const table = useReactTable({
        data: keys,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="space-y-4 sm:space-y-6">
            <section className="space-y-4 rounded-md border border-border bg-background p-4 shadow-none dark:border-white/10 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-medium text-foreground">{t('portal.keys.apiEndpointTitle')}</div>
                        <div className="mt-1 hidden text-xs text-muted-foreground sm:block">{t('portal.keys.apiEndpointHint')}</div>
                    </div>
                    {hasMoreLineRoutes && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 rounded-md px-2 text-xs"
                            onClick={() => setLineRoutesDialogOpen(true)}
                        >
                            {t('portal.keys.viewAllLineRoutes', { count: lineRoutes.length })}
                        </Button>
                    )}
                </div>
                <ApiEndpointList
                    lineRoutes={lineRoutes}
                    onCopy={copyApiUrlToClipboard}
                    t={t}
                    limit={LINE_ROUTE_PREVIEW_LIMIT}
                />
            </section>

            <Dialog open={lineRoutesDialogOpen} onOpenChange={setLineRoutesDialogOpen}>
                <DialogContent className="max-h-[82vh] max-w-3xl gap-0 overflow-hidden p-0">
                    <DialogHeader className="border-b border-border/60 px-5 py-4 dark:border-white/10 sm:px-6">
                        <DialogTitle className="text-lg">{t('portal.keys.allLineRoutesTitle')}</DialogTitle>
                        <DialogDescription>{t('portal.keys.allLineRoutesDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[62vh] overflow-y-auto px-5 py-3 sm:px-6">
                        <ApiEndpointList
                            lineRoutes={lineRoutes}
                            onCopy={copyApiUrlToClipboard}
                            t={t}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{t('portal.keys.keyListTitle')}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {t('portal.keys.keyTotal', { count: total })}
                    </div>
                </div>
                <Button className="shrink-0 rounded-md" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t('portal.keys.create')}
                </Button>
            </div>

            <div className="space-y-3 md:hidden">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-36 rounded-md bg-muted/70" />
                    ))
                ) : keys.length > 0 ? (
                    keys.map((token) => (
                        <KeyMobileCard
                            key={token.id}
                            token={token}
                            onCopy={copyKeyToClipboard}
                            onEdit={openEditDialog}
                            onDelete={(id) => deleteKeyMutation.mutate(id)}
                            t={t}
                        />
                    ))
                ) : (
                    <div className="rounded-md border border-dashed border-border bg-background p-6 text-center dark:border-white/10">
                        <div className="text-sm font-medium text-foreground">{t('portal.keys.emptyKeysTitle')}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{t('portal.keys.emptyKeysDescription')}</div>
                        <Button className="mt-4 rounded-md" onClick={() => setDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            {t('portal.keys.create')}
                        </Button>
                    </div>
                )}
            </div>

            <div className="hidden overflow-hidden rounded-md border border-border bg-background shadow-none dark:border-white/10 md:block">
                <DataTable
                    table={table}
                    columns={columns}
                    isLoading={isLoading}
                    loadingStyle="skeleton"
                    fixedHeader={true}
                    showScrollShadows={false}
                />
                <div className="border-t border-border/60 px-3">
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

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
                    <DialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-5">
                        <DialogTitle className="text-xl">{t('portal.keys.createTitle')}</DialogTitle>
                        <DialogDescription>{t('portal.keys.createDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="px-6 py-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('portal.keys.name')}</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="h-11 rounded-md" placeholder={t('portal.keys.namePlaceholder')} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="group"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('portal.keys.group')}</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value)
                                                    form.setValue('models', [], { shouldDirty: true, shouldValidate: true })
                                                }}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-md">
                                                        <SelectValue placeholder={t('portal.keys.groupPlaceholder')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {groups.map((group) => (
                                                        <SelectItem key={group.group} value={group.group}>
                                                            {group.group} (x{group.price_multiplier.toFixed(2)})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="models"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MultiSelectCombobox<string>
                                                    label={t('portal.keys.models')}
                                                    placeholder={t('portal.keys.modelSelectPlaceholder')}
                                                    dropdownItems={createGroupModels}
                                                    selectedItems={field.value || []}
                                                    setSelectedItems={(value) => {
                                                        const next = typeof value === 'function'
                                                            ? value(field.value || [])
                                                            : value
                                                        field.onChange(next)
                                                    }}
                                                    handleFilteredDropdownItems={(items, selectedItems, inputValue) => items.filter((item) => {
                                                        return !selectedItems.includes(item) &&
                                                            item.toLowerCase().includes(inputValue.toLowerCase())
                                                    })}
                                                    handleDropdownItemDisplay={(item) => item}
                                                    handleSelectedItemDisplay={(item) => item}
                                                />
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground">{t('portal.keys.modelLimitHint')}</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="unlimitedQuota"
                                    render={({ field }) => (
                                        <FormItem className="rounded-md border border-border p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <FormLabel>{t('portal.keys.unlimitedQuota')}</FormLabel>
                                                    <p className="mt-1 text-xs text-muted-foreground">{t('portal.keys.unlimitedQuotaHint')}</p>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {!form.watch('unlimitedQuota') && (
                                    <FormField
                                        control={form.control}
                                        name="quota"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('portal.keys.quota')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={field.value ?? ''}
                                                        onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                                                        className="h-11 rounded-md"
                                                        placeholder={t('portal.keys.quotaPlaceholder')}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <FormField
                                    control={form.control}
                                    name="expiredDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('portal.keys.expiredAt')}</FormLabel>
                                            <FormField
                                                control={form.control}
                                                name="expiredTime"
                                                render={({ field: timeField }) => (
                                                    <FormControl>
                                                        <DateTimePicker
                                                            dateValue={field.value}
                                                            timeValue={timeField.value}
                                                            onDateChange={field.onChange}
                                                            onTimeChange={timeField.onChange}
                                                            placeholder={t('portal.keys.neverExpires')}
                                                            clearLabel={t('portal.keys.clearExpiration')}
                                                        />
                                                    </FormControl>
                                                )}
                                            />
                                            <p className="text-xs text-muted-foreground">{t('portal.keys.expiredAtHint')}</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                        {t('portal.common.cancel')}
                                    </Button>
                                    <Button type="submit" disabled={createKeyMutation.isPending}>
                                        {createKeyMutation.isPending ? t('portal.keys.creating') : t('portal.keys.create')}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
                    <DialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-5">
                        <DialogTitle className="text-xl">{t('portal.keys.editTitle')}</DialogTitle>
                        <DialogDescription>{t('portal.keys.editDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="px-6 py-6">
                        <Form {...editForm}>
                            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-5">
                                <FormField
                                    control={editForm.control}
                                    name="group"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('portal.keys.group')}</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value)
                                                    editForm.setValue('models', [], { shouldDirty: true, shouldValidate: true })
                                                }}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-md">
                                                        <SelectValue placeholder={t('portal.keys.groupPlaceholder')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {groups.map((group) => (
                                                        <SelectItem key={group.group} value={group.group}>
                                                            {group.group} (x{group.price_multiplier.toFixed(2)})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={editForm.control}
                                    name="models"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MultiSelectCombobox<string>
                                                    label={t('portal.keys.models')}
                                                    placeholder={t('portal.keys.modelSelectPlaceholder')}
                                                    dropdownItems={editGroupModels}
                                                    selectedItems={field.value || []}
                                                    setSelectedItems={(value) => {
                                                        const next = typeof value === 'function'
                                                            ? value(field.value || [])
                                                            : value
                                                        field.onChange(next)
                                                    }}
                                                    handleFilteredDropdownItems={(items, selectedItems, inputValue) => items.filter((item) => {
                                                        return !selectedItems.includes(item) &&
                                                            item.toLowerCase().includes(inputValue.toLowerCase())
                                                    })}
                                                    handleDropdownItemDisplay={(item) => item}
                                                    handleSelectedItemDisplay={(item) => item}
                                                />
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground">{t('portal.keys.modelLimitHint')}</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={editForm.control}
                                    name="unlimitedQuota"
                                    render={({ field }) => (
                                        <FormItem className="rounded-md border border-border p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <FormLabel>{t('portal.keys.unlimitedQuota')}</FormLabel>
                                                    <p className="mt-1 text-xs text-muted-foreground">{t('portal.keys.unlimitedQuotaHint')}</p>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {!editForm.watch('unlimitedQuota') && (
                                    <FormField
                                        control={editForm.control}
                                        name="quota"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('portal.keys.quota')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={field.value ?? ''}
                                                        onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                                                        className="h-11 rounded-md"
                                                        placeholder={t('portal.keys.quotaPlaceholder')}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <FormField
                                    control={editForm.control}
                                    name="expiredDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('portal.keys.expiredAt')}</FormLabel>
                                            <FormField
                                                control={editForm.control}
                                                name="expiredTime"
                                                render={({ field: timeField }) => (
                                                    <FormControl>
                                                        <DateTimePicker
                                                            dateValue={field.value}
                                                            timeValue={timeField.value}
                                                            onDateChange={field.onChange}
                                                            onTimeChange={timeField.onChange}
                                                            placeholder={t('portal.keys.neverExpires')}
                                                            clearLabel={t('portal.keys.clearExpiration')}
                                                        />
                                                    </FormControl>
                                                )}
                                            />
                                            <p className="text-xs text-muted-foreground">{t('portal.keys.expiredAtHint')}</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                                        {t('portal.common.cancel')}
                                    </Button>
                                    <Button type="submit" disabled={updateKeyMutation.isPending}>
                                        {updateKeyMutation.isPending ? t('portal.keys.updating') : t('portal.keys.update')}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
