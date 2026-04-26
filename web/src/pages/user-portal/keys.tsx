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
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { useUserPortalCreateKey, useUserPortalDeleteKey, useUserPortalGroups, useUserPortalKeys, useUserPortalUpdateKey } from '@/feature/user-portal/hooks'
import type { Token } from '@/types/token'

interface CreateKeyFormValues {
    name: string
    group: string
}

interface UpdateKeyGroupFormValues {
    group: string
}

export default function UserPortalKeysPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [groupFilter, setGroupFilter] = useState<string>('all')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingKey, setEditingKey] = useState<Token | null>(null)

    const { data: groupsData } = useUserPortalGroups(true)
    const { data, isLoading } = useUserPortalKeys(page, pageSize, groupFilter === 'all' ? undefined : groupFilter, true)
    const createKeyMutation = useUserPortalCreateKey()
    const deleteKeyMutation = useUserPortalDeleteKey()
    const updateKeyMutation = useUserPortalUpdateKey()

    const groups = groupsData?.groups || []
    const keys = data?.keys || []
    const total = data?.total || 0

    const schema = useMemo(() => z.object({
        name: z.string().trim().min(1, t('portal.keys.nameRequired')),
        group: z.string().trim().min(1, t('portal.keys.groupRequired')),
    }), [t])

    const form = useForm<CreateKeyFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            group: '',
        },
    })

    const editSchema = useMemo(() => z.object({
        group: z.string().trim().min(1, t('portal.keys.groupRequired')),
    }), [t])

    const editForm = useForm<UpdateKeyGroupFormValues>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            group: '',
        },
    })

    const onSubmit = (values: CreateKeyFormValues) => {
        createKeyMutation.mutate({
            name: values.name.trim(),
            group: values.group,
        }, {
            onSuccess: () => {
                setDialogOpen(false)
                form.reset({
                    name: '',
                    group: '',
                })
            },
        })
    }

    const copyToClipboard = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success(t('portal.keys.copied'))
        } catch {
            toast.error(t('portal.keys.copyFailed'))
        }
    }

    const openEditDialog = (token: Token) => {
        setEditingKey(token)
        editForm.reset({ group: token.group })
        setEditDialogOpen(true)
    }

    const onSubmitEdit = (values: UpdateKeyGroupFormValues) => {
        if (!editingKey) {
            return
        }

        updateKeyMutation.mutate({
            id: editingKey.id,
            data: { group: values.group },
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
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1">
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
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(row.original.key)}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
        {
            accessorKey: 'created_at',
            header: () => <div className="py-3.5 font-medium">{t('portal.keys.createdAt')}</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {format(new Date(row.original.created_at), 'yyyy-MM-dd HH:mm')}
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
    ], [deleteKeyMutation, t])

    const table = useReactTable({
        data: keys,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="space-y-4 sm:space-y-6">
            <section className="rounded-[18px] border border-white/60 bg-white/70 p-3 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:rounded-[24px] sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="text-sm text-primary">{t('portal.keys.badge')}</div>
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('portal.keys.title')}</h1>
                        <p className="max-w-3xl text-muted-foreground">{t('portal.keys.description')}</p>
                    </div>
                    <div className="grid gap-3 sm:flex sm:flex-wrap">
                        <Select value={groupFilter} onValueChange={(value) => {
                            setGroupFilter(value)
                            setPage(1)
                        }}>
                            <SelectTrigger className="w-full rounded-2xl sm:w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('portal.keys.allGroups')}</SelectItem>
                                {groups.map((group) => (
                                    <SelectItem key={group.group} value={group.group}>{group.group}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button className="rounded-2xl" onClick={() => setDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            {t('portal.keys.create')}
                        </Button>
                    </div>
                </div>
            </section>

            <Card className="rounded-[24px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5 sm:rounded-[28px]">
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>{t('portal.keys.list')}</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    <div className="px-4 pb-4 sm:px-6 sm:pb-5">
                        <div className="space-y-3 md:hidden">
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, index) => (
                                    <div key={index} className="h-36 rounded-2xl bg-muted/70" />
                                ))
                            ) : keys.length > 0 ? (
                                keys.map((token) => (
                                    <div key={token.id} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-base font-semibold">{token.name}</div>
                                                <Badge variant="outline" className="mt-2 rounded-full border-border/70 bg-background/80 px-3 py-1">
                                                    {token.group}
                                                </Badge>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(token)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteKeyMutation.mutate(token.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2">
                                            <code className="min-w-0 flex-1 truncate text-xs">{token.key}</code>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(token.key)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="mt-3 text-xs text-muted-foreground">
                                            {format(new Date(token.created_at), 'yyyy-MM-dd HH:mm')}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                                    {t('table.noData')}
                                </div>
                            )}
                        </div>
                        <div className="hidden md:block">
                        <DataTable
                            table={table}
                            columns={columns}
                            isLoading={isLoading}
                            loadingStyle="skeleton"
                            fixedHeader={true}
                            showScrollShadows={false}
                        />
                        </div>
                    </div>
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
                </CardContent>
            </Card>

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
                                                <Input {...field} className="h-11 rounded-2xl" placeholder={t('portal.keys.namePlaceholder')} />
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
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-2xl">
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
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-2xl">
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
