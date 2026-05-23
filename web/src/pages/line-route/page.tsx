import { useCallback, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import {
    Copy,
    MoreHorizontal,
    Pencil,
    Plus,
    RefreshCcw,
    Route,
    Search,
    Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { AnimatedRoute } from '@/components/layout/AnimatedRoute'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { AnimatedButton } from '@/components/ui/animation/components/animated-button'
import { AnimatedIcon } from '@/components/ui/animation/components/animated-icon'
import type { LineRoute, SaveLineRouteRequest } from '@/types/line-route'
import {
    useCreateLineRoute,
    useDeleteLineRoute,
    useLineRoutes,
    useUpdateLineRoute,
} from '@/feature/line-route/hooks'

const createEmptyForm = (): SaveLineRouteRequest => ({
    api_url: '',
    description: '',
    note: '',
})

const buildFormFromLineRoute = (lineRoute: LineRoute): SaveLineRouteRequest => ({
    api_url: lineRoute.api_url,
    description: lineRoute.description,
    note: lineRoute.note || '',
})

const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return '-'
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm')
}

export default function LineRoutePage() {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [searchInput, setSearchInput] = useState('')
    const [searchKeyword, setSearchKeyword] = useState<string | undefined>(undefined)
    const [isRefreshAnimating, setIsRefreshAnimating] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'update'>('create')
    const [selectedLineRoute, setSelectedLineRoute] = useState<LineRoute | null>(null)
    const [form, setForm] = useState<SaveLineRouteRequest>(createEmptyForm())
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { data, isLoading, refetch } = useLineRoutes(page, pageSize, searchKeyword)
    const { createLineRoute, isLoading: isCreating } = useCreateLineRoute()
    const { updateLineRoute, isLoading: isUpdating } = useUpdateLineRoute()
    const { deleteLineRoute, isLoading: isDeleting } = useDeleteLineRoute()

    const lineRoutes = useMemo(() => data?.line_routes || [], [data?.line_routes])
    const total = data?.total || 0
    const isSaving = isCreating || isUpdating

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value)
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        searchTimerRef.current = setTimeout(() => {
            setSearchKeyword(value.trim() || undefined)
            setPage(1)
        }, 300)
    }, [])

    const refreshLineRoutes = () => {
        setIsRefreshAnimating(true)
        refetch()
        setTimeout(() => setIsRefreshAnimating(false), 800)
    }

    const openCreateDialog = () => {
        setDialogMode('create')
        setSelectedLineRoute(null)
        setForm(createEmptyForm())
        setDialogOpen(true)
    }

    const openEditDialog = (lineRoute: LineRoute) => {
        setDialogMode('update')
        setSelectedLineRoute(lineRoute)
        setForm(buildFormFromLineRoute(lineRoute))
        setDialogOpen(true)
    }

    const handleSubmit = () => {
        const payload: SaveLineRouteRequest = {
            api_url: form.api_url.trim(),
            description: form.description.trim(),
            note: form.note?.trim(),
        }

        if (dialogMode === 'update' && selectedLineRoute) {
            updateLineRoute(
                { id: selectedLineRoute.id, data: payload },
                { onSuccess: () => setDialogOpen(false) },
            )
            return
        }

        createLineRoute(payload, {
            onSuccess: () => setDialogOpen(false),
        })
    }

    const copyToClipboard = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success('API 地址已复制')
        } catch {
            toast.error('复制失败')
        }
    }

    const columns: ColumnDef<LineRoute>[] = useMemo(() => [
        {
            accessorKey: 'description',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">线路描述</div>,
            cell: ({ row }) => (
                <div className="min-w-[160px] font-medium text-foreground">
                    {row.original.description}
                </div>
            ),
        },
        {
            accessorKey: 'api_url',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">API 地址</div>,
            cell: ({ row }) => (
                <div className="flex min-w-[260px] items-center gap-2">
                    <code className="min-w-0 max-w-[520px] truncate rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                        {row.original.api_url}
                    </code>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(event) => {
                            event.stopPropagation()
                            copyToClipboard(row.original.api_url)
                        }}
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
        {
            accessorKey: 'note',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">说明</div>,
            cell: ({ row }) => (
                <div className="line-clamp-2 max-w-[360px] text-sm text-muted-foreground">
                    {row.original.note || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'updated_at',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">更新时间</div>,
            cell: ({ row }) => (
                <div className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(row.original.updated_at)}
                </div>
            ),
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => deleteLineRoute(row.original.id)}
                                disabled={isDeleting}
                                className="text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [deleteLineRoute, isDeleting])

    const table = useReactTable({
        data: lineRoutes,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <AnimatedRoute>
            <div className="flex h-full min-h-0 flex-col">
                <Card className="flex min-h-0 flex-1 flex-col gap-0 rounded-md border-border bg-background p-0 shadow-none">
                    <div className="flex flex-col gap-5 border-b border-border/60 px-6 py-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-sm text-primary">
                                    <Route className="h-4 w-4" />
                                    线路设定
                                </div>
                                <h2 className="text-2xl font-semibold tracking-tight">线路设定</h2>
                                <p className="max-w-2xl text-sm text-muted-foreground">
                                    维护用户端 Key 管理页面展示的 API 访问线路，方便用户选择接入地址。
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="搜索线路..."
                                        value={searchInput}
                                        onChange={(event) => handleSearchChange(event.target.value)}
                                        className="h-10 w-56 rounded-md border-border bg-background pl-9 shadow-none"
                                    />
                                </div>

                                <AnimatedButton>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={refreshLineRoutes}
                                        className="h-10 rounded-md border-border bg-background px-4"
                                    >
                                        <AnimatedIcon
                                            animationVariant="continuous-spin"
                                            isAnimating={isRefreshAnimating}
                                            className="h-4 w-4"
                                        >
                                            <RefreshCcw className="h-4 w-4" />
                                        </AnimatedIcon>
                                        刷新
                                    </Button>
                                </AnimatedButton>

                                <AnimatedButton>
                                    <Button
                                        size="sm"
                                        onClick={openCreateDialog}
                                        className="h-10 rounded-md px-4"
                                    >
                                        <Plus className="h-4 w-4" />
                                        新建线路
                                    </Button>
                                </AnimatedButton>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex-1 overflow-auto px-6 py-4">
                            <div className="overflow-hidden rounded-md border border-border bg-background">
                                <DataTable
                                    table={table}
                                    columns={columns}
                                    isLoading={isLoading}
                                    loadingStyle="skeleton"
                                    fixedHeader={true}
                                    animatedRows={true}
                                    showScrollShadows={false}
                                    onRowClick={openEditDialog}
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

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{dialogMode === 'create' ? '新建线路' : '编辑线路'}</DialogTitle>
                            <DialogDescription>
                                保存后会同步展示到用户端 Key 管理页面。
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">API 地址</label>
                                <Input
                                    value={form.api_url}
                                    onChange={(event) => setForm((prev) => ({ ...prev, api_url: event.target.value }))}
                                    placeholder="例如：https://api.example.com/v1"
                                />
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">线路描述</label>
                                <Input
                                    value={form.description}
                                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                    placeholder="例如：默认线路"
                                />
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">说明</label>
                                <Textarea
                                    value={form.note || ''}
                                    onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                                    placeholder="填写线路用途、适用地区或其他提示"
                                    className="min-h-28"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                取消
                            </Button>
                            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                                {isSaving ? '保存中...' : '保存'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AnimatedRoute>
    )
}
