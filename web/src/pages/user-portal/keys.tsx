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
import { Copy, Plus, Trash2 } from 'lucide-react'
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
import { useUserPortalCreateKey, useUserPortalDeleteKey, useUserPortalGroups, useUserPortalKeys } from '@/feature/user-portal/hooks'
import type { Token } from '@/types/token'

interface CreateKeyFormValues {
    name: string
    group: string
}

export default function UserPortalKeysPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [groupFilter, setGroupFilter] = useState<string>('all')
    const [dialogOpen, setDialogOpen] = useState(false)

    const { data: groupsData } = useUserPortalGroups(true)
    const { data, isLoading } = useUserPortalKeys(page, pageSize, groupFilter === 'all' ? undefined : groupFilter, true)
    const createKeyMutation = useUserPortalCreateKey()
    const deleteKeyMutation = useUserPortalDeleteKey()

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
            ),
        },
    ], [deleteKeyMutation, t])

    const table = useReactTable({
        data: keys,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="text-sm text-primary">{t('portal.keys.badge')}</div>
                        <h1 className="text-3xl font-semibold tracking-tight">{t('portal.keys.title')}</h1>
                        <p className="max-w-3xl text-muted-foreground">{t('portal.keys.description')}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Select value={groupFilter} onValueChange={(value) => {
                            setGroupFilter(value)
                            setPage(1)
                        }}>
                            <SelectTrigger className="w-[180px] rounded-2xl">
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

            <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                <CardHeader>
                    <CardTitle>{t('portal.keys.list')}</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    <div className="px-6 pb-5">
                        <DataTable
                            table={table}
                            columns={columns}
                            isLoading={isLoading}
                            loadingStyle="skeleton"
                            fixedHeader={true}
                            showScrollShadows={false}
                        />
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
        </div>
    )
}
