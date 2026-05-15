import { useCallback, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
    getCoreRowModel,
    type ColumnDef,
    useReactTable,
} from '@tanstack/react-table'
import {
    Bell,
    MoreHorizontal,
    Pencil,
    Plus,
    RefreshCcw,
    Search,
    Send,
    Trash2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AnimatedRoute } from '@/components/layout/AnimatedRoute'
import { Badge } from '@/components/ui/badge'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/table/motion-data-table'
import { ServerPagination } from '@/components/table/server-pagination'
import { AnimatedButton } from '@/components/ui/animation/components/animated-button'
import { AnimatedIcon } from '@/components/ui/animation/components/animated-icon'
import { normalizeMarkdownContent } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import {
    ANNOUNCEMENT_CATEGORIES,
    ANNOUNCEMENT_STATUS,
    type Announcement,
    type AnnouncementCategory,
    type AnnouncementStatus,
    type SaveAnnouncementRequest,
} from '@/types/announcement'
import {
    useAnnouncements,
    useAnnouncementCategories,
    useCreateAnnouncement,
    useDeleteAnnouncement,
    useUpdateAnnouncement,
    useUpdateAnnouncementStatus,
} from '@/feature/announcement/hooks'

const defaultMarkdown = `## 更新内容

- 

## 影响范围

- 

## 迁移建议

- `

const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return '-'
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm')
}

const toDateTimeLocal = (timestamp?: number) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const offsetMs = date.getTimezoneOffset() * 60 * 1000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const fromDateTimeLocal = (value: string) => {
    if (!value) return undefined
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : undefined
}

const createEmptyForm = (): SaveAnnouncementRequest => ({
    title: '',
    slug: '',
    summary: '',
    content: defaultMarkdown,
    category: ANNOUNCEMENT_CATEGORIES[0],
    version: '',
    status: ANNOUNCEMENT_STATUS.DRAFT,
    published_at: undefined,
})

const buildFormFromAnnouncement = (announcement: Announcement): SaveAnnouncementRequest => ({
    title: announcement.title,
    slug: announcement.slug || '',
    summary: announcement.summary || '',
    content: announcement.content,
    category: announcement.category || '',
    version: announcement.version || '',
    status: announcement.status,
    published_at: announcement.published_at,
})

const statusLabel = (status: AnnouncementStatus) =>
    status === ANNOUNCEMENT_STATUS.PUBLISHED ? '已发布' : '草稿'

export default function AnnouncementPage() {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [searchInput, setSearchInput] = useState('')
    const [searchKeyword, setSearchKeyword] = useState<string | undefined>(undefined)
    const [statusFilter, setStatusFilter] = useState('all')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [isRefreshAnimating, setIsRefreshAnimating] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'update'>('create')
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
    const [form, setForm] = useState<SaveAnnouncementRequest>(createEmptyForm())
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

    const statusValue = statusFilter === 'all' ? undefined : Number(statusFilter)
    const categoryValue = categoryFilter === 'all' ? undefined : categoryFilter
    const { data, isLoading, refetch } = useAnnouncements(page, pageSize, searchKeyword, statusValue, categoryValue)
    const { data: categoriesData } = useAnnouncementCategories()
    const { createAnnouncement, isLoading: isCreating } = useCreateAnnouncement()
    const { updateAnnouncement, isLoading: isUpdating } = useUpdateAnnouncement()
    const { updateAnnouncementStatus, isLoading: isStatusUpdating } = useUpdateAnnouncementStatus()
    const { deleteAnnouncement, isLoading: isDeleting } = useDeleteAnnouncement()

    const announcements = useMemo(() => data?.announcements || [], [data?.announcements])
    const categories = useMemo(() => {
        const remoteCategories = categoriesData?.categories || []
        return remoteCategories.length > 0 ? remoteCategories : [...ANNOUNCEMENT_CATEGORIES]
    }, [categoriesData?.categories])
    const total = data?.total || 0
    const isSaving = isCreating || isUpdating

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value)
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        searchTimerRef.current = setTimeout(() => {
            setSearchKeyword(value || undefined)
            setPage(1)
        }, 300)
    }, [])

    const refreshAnnouncements = () => {
        setIsRefreshAnimating(true)
        refetch()
        setTimeout(() => setIsRefreshAnimating(false), 800)
    }

    const openCreateDialog = () => {
        setDialogMode('create')
        setSelectedAnnouncement(null)
        setForm(createEmptyForm())
        setDialogOpen(true)
    }

    const openEditDialog = (announcement: Announcement) => {
        setDialogMode('update')
        setSelectedAnnouncement(announcement)
        setForm(buildFormFromAnnouncement(announcement))
        setDialogOpen(true)
    }

    const handleSubmit = () => {
        const payload = {
            ...form,
            title: form.title.trim(),
            slug: form.slug?.trim(),
            summary: form.summary?.trim(),
            content: form.content.trim(),
            category: form.category?.trim(),
            version: form.version?.trim(),
        }

        if (dialogMode === 'update' && selectedAnnouncement) {
            updateAnnouncement(
                { id: selectedAnnouncement.id, data: payload },
                { onSuccess: () => setDialogOpen(false) },
            )
            return
        }

        createAnnouncement(payload, {
            onSuccess: () => setDialogOpen(false),
        })
    }

    const handleToggleStatus = (announcement: Announcement) => {
        const nextStatus = announcement.status === ANNOUNCEMENT_STATUS.PUBLISHED
            ? ANNOUNCEMENT_STATUS.DRAFT
            : ANNOUNCEMENT_STATUS.PUBLISHED

        updateAnnouncementStatus({
            id: announcement.id,
            data: {
                status: nextStatus,
                published_at: nextStatus === ANNOUNCEMENT_STATUS.PUBLISHED
                    ? announcement.published_at || Date.now()
                    : undefined,
            },
        })
    }

    const columns: ColumnDef<Announcement>[] = useMemo(() => [
        {
            accessorKey: 'title',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">公告</div>,
            cell: ({ row }) => (
                <div className="space-y-1">
                    <div className="font-medium text-foreground">{row.original.title}</div>
                    <div className="line-clamp-1 max-w-[520px] text-xs text-muted-foreground">
                        {row.original.summary || row.original.slug || '无摘要'}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'category',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">分类</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">{row.original.category || '-'}</div>
            ),
        },
        {
            accessorKey: 'version',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">版本</div>,
            cell: ({ row }) => (
                <div className="font-mono text-sm text-muted-foreground">{row.original.version || '-'}</div>
            ),
        },
        {
            accessorKey: 'status',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">状态</div>,
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className={cn(
                        'border-transparent',
                        row.original.status === ANNOUNCEMENT_STATUS.PUBLISHED
                            ? 'bg-[#1456f0]/10 text-[#1456f0]'
                            : 'bg-zinc-200/80 text-zinc-700 dark:bg-zinc-700/70 dark:text-zinc-100',
                    )}
                >
                    {statusLabel(row.original.status)}
                </Badge>
            ),
        },
        {
            accessorKey: 'published_at',
            header: () => <div className="py-3.5 font-medium whitespace-nowrap">发布时间</div>,
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">{formatDateTime(row.original.published_at)}</div>
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
                                onClick={() => handleToggleStatus(row.original)}
                                disabled={isStatusUpdating}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                {row.original.status === ANNOUNCEMENT_STATUS.PUBLISHED ? '转为草稿' : '发布'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => deleteAnnouncement(row.original.id)}
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
    ], [deleteAnnouncement, isDeleting, isStatusUpdating, updateAnnouncementStatus])

    const table = useReactTable({
        data: announcements,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <AnimatedRoute>
            <div className="flex h-full min-h-0 flex-col">
                <Card className="flex min-h-0 flex-1 flex-col gap-0 rounded-[28px] border border-white/70 bg-white/75 p-0 shadow-[0_20px_44px_-30px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-card/80">
                    <div className="flex flex-col gap-5 border-b border-border/60 px-6 py-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-sm text-primary">
                                    <Bell className="h-4 w-4" />
                                    公告系统
                                </div>
                                <h2 className="text-2xl font-semibold tracking-tight">API 更新公告</h2>
                                <p className="max-w-2xl text-sm text-muted-foreground">
                                    在后台编写 Markdown 公告，发布后会展示到公开 API 更新页面。
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="搜索公告..."
                                        value={searchInput}
                                        onChange={(event) => handleSearchChange(event.target.value)}
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
                                    <SelectTrigger className="h-10 w-[140px] rounded-2xl border-border/70 bg-background/80 shadow-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部状态</SelectItem>
                                        <SelectItem value="1">草稿</SelectItem>
                                        <SelectItem value="2">已发布</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={categoryFilter}
                                    onValueChange={(value) => {
                                        setCategoryFilter(value)
                                        setPage(1)
                                    }}
                                >
                                    <SelectTrigger className="h-10 w-[150px] rounded-2xl border-border/70 bg-background/80 shadow-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部分类</SelectItem>
                                        {categories.map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {category}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <AnimatedButton>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={refreshAnnouncements}
                                        className="h-10 rounded-2xl border-border/70 bg-background/80 px-4"
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
                                        className="h-10 rounded-2xl px-4"
                                    >
                                        <Plus className="h-4 w-4" />
                                        新建公告
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
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                        <DialogHeader>
                            <DialogTitle>{dialogMode === 'create' ? '新建公告' : '编辑公告'}</DialogTitle>
                            <DialogDescription>
                                正文支持 Markdown。设置为已发布后，公告会出现在公开 API 更新页面。
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">标题</label>
                                    <Input
                                        value={form.title}
                                        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                        placeholder="例如：模型价格更新"
                                    />
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">分类</label>
                                        <Select
                                            value={form.category || ANNOUNCEMENT_CATEGORIES[0]}
                                            onValueChange={(value) => setForm((prev) => ({
                                                ...prev,
                                                category: value as AnnouncementCategory,
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((category) => (
                                                    <SelectItem key={category} value={category}>
                                                        {category}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">版本</label>
                                        <Input
                                            value={form.version || ''}
                                            onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
                                            placeholder="v1.2.0"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">状态</label>
                                        <Select
                                            value={String(form.status)}
                                            onValueChange={(value) => {
                                                const nextStatus = Number(value) as AnnouncementStatus
                                                setForm((prev) => ({
                                                    ...prev,
                                                    status: nextStatus,
                                                    published_at: nextStatus === ANNOUNCEMENT_STATUS.PUBLISHED
                                                        ? prev.published_at || Date.now()
                                                        : undefined,
                                                }))
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">草稿</SelectItem>
                                                <SelectItem value="2">已发布</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">发布时间</label>
                                        <Input
                                            type="datetime-local"
                                            value={toDateTimeLocal(form.published_at)}
                                            onChange={(event) => setForm((prev) => ({
                                                ...prev,
                                                published_at: fromDateTimeLocal(event.target.value),
                                            }))}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Slug</label>
                                    <Input
                                        value={form.slug || ''}
                                        onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                                        placeholder="可选，留空会自动生成"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">摘要</label>
                                    <Textarea
                                        value={form.summary || ''}
                                        onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                                        placeholder="一句话说明这次更新的重点"
                                        className="min-h-[88px]"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Markdown 正文</label>
                                    <Textarea
                                        value={form.content}
                                        onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                                        className="min-h-[360px] font-mono text-[13px] leading-6"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">预览</div>
                                <div className="min-h-[520px] rounded-[12px] border border-border/70 bg-background px-5 py-4">
                                    <div className="mb-4 border-b border-border/70 pb-4">
                                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            {form.category && <span>{form.category}</span>}
                                            {form.version && <span className="font-mono">{form.version}</span>}
                                            <span>{statusLabel(form.status)}</span>
                                        </div>
                                        <h3 className="text-xl font-semibold tracking-tight">{form.title || '公告标题'}</h3>
                                        {form.summary && (
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{form.summary}</p>
                                        )}
                                    </div>
                                    <div className="prose prose-neutral max-w-none text-sm dark:prose-invert prose-headings:font-semibold prose-h2:text-lg prose-p:leading-7 prose-li:leading-7">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {normalizeMarkdownContent(form.content) || ' '}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                取消
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSaving || !form.title.trim() || !form.content.trim()}
                            >
                                {isSaving ? '保存中...' : '保存'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AnimatedRoute>
    )
}
