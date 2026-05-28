import { useEffect, useMemo, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FlaskConical, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChannelModelTestSelectorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    models: string[]
    selectedModels: string[]
    onSelectedModelsChange: (models: string[]) => void
    onConfirm: () => void
    isTesting?: boolean
    title?: string
    sourceLabel?: string
}

export function ChannelModelTestSelectorDialog({
    open,
    onOpenChange,
    models,
    selectedModels,
    onSelectedModelsChange,
    onConfirm,
    isTesting = false,
    title = '选择测试模型',
    sourceLabel,
}: ChannelModelTestSelectorDialogProps) {
    const [search, setSearch] = useState('')

    const normalizedModels = useMemo(() => {
        const seen = new Set<string>()
        return models
            .map((model) => model.trim())
            .filter((model) => {
                if (!model || seen.has(model)) {
                    return false
                }
                seen.add(model)
                return true
            })
    }, [models])

    const filteredModels = useMemo(() => {
        const keyword = search.trim().toLowerCase()
        if (!keyword) {
            return normalizedModels
        }
        return normalizedModels.filter((model) => model.toLowerCase().includes(keyword))
    }, [normalizedModels, search])

    const selectedModelSet = useMemo(() => new Set(selectedModels), [selectedModels])
    const selectedCount = normalizedModels.filter((model) => selectedModelSet.has(model)).length
    const filteredSelectedCount = filteredModels.filter((model) => selectedModelSet.has(model)).length
    const allFilteredSelected = filteredModels.length > 0 && filteredSelectedCount === filteredModels.length

    useEffect(() => {
        if (open) {
            setSearch('')
        }
    }, [open])

    const handleOpenChange = (nextOpen: boolean) => {
        if (isTesting) {
            return
        }
        onOpenChange(nextOpen)
    }

    const commitSelectedModels = (nextSelectedSet: Set<string>) => {
        onSelectedModelsChange(normalizedModels.filter((model) => nextSelectedSet.has(model)))
    }

    const toggleModel = (model: string, checked: boolean) => {
        const nextSelectedSet = new Set(selectedModels)
        if (checked) {
            nextSelectedSet.add(model)
        } else {
            nextSelectedSet.delete(model)
        }
        commitSelectedModels(nextSelectedSet)
    }

    const toggleFilteredModels = () => {
        const nextSelectedSet = new Set(selectedModels)
        if (allFilteredSelected) {
            filteredModels.forEach((model) => nextSelectedSet.delete(model))
        } else {
            filteredModels.forEach((model) => nextSelectedSet.add(model))
        }
        commitSelectedModels(nextSelectedSet)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[82vh] overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="border-b px-5 py-4">
                    <div className="flex min-w-0 items-center gap-2 pr-6">
                        <DialogTitle className="truncate">{title}</DialogTitle>
                        <Badge variant="outline" className="shrink-0">
                            {normalizedModels.length} 个模型
                        </Badge>
                        {sourceLabel ? (
                            <Badge variant="secondary" className="shrink-0">
                                {sourceLabel}
                            </Badge>
                        ) : null}
                    </div>
                    <DialogDescription className="sr-only">
                        选择一个或多个模型进行渠道连通性测试
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 px-5 py-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="搜索模型"
                            className="pl-9"
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                            已选择 {selectedCount} 个模型
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={toggleFilteredModels}
                            disabled={filteredModels.length === 0 || isTesting}
                        >
                            {allFilteredSelected ? '取消当前结果' : '选择当前结果'}
                        </Button>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto rounded-md border p-1">
                        {filteredModels.length > 0 ? (
                            <div className="space-y-1">
                                {filteredModels.map((model) => {
                                    const isSelected = selectedModelSet.has(model)
                                    return (
                                        <label
                                            key={model}
                                            className={cn(
                                                "flex h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors",
                                                "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                isSelected && "bg-primary/10 text-primary"
                                            )}
                                            title={model}
                                        >
                                            <span className="flex min-w-0 items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 shrink-0"
                                                    checked={isSelected}
                                                    disabled={isTesting}
                                                    onChange={(event) => toggleModel(model, event.target.checked)}
                                                />
                                                <span className="min-w-0 truncate font-mono text-xs">
                                                    {model}
                                                </span>
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                                无匹配模型
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="border-t px-5 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isTesting}
                    >
                        取消
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={selectedCount === 0 || isTesting}
                        className="gap-2"
                    >
                        {isTesting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <FlaskConical className="h-4 w-4" />
                        )}
                        {selectedCount > 0 ? `测试 ${selectedCount} 个` : '测试'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
