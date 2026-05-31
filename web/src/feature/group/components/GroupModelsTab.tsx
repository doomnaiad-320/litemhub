// src/feature/group/components/GroupModelsTab.tsx
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { PriceDisplay } from '@/components/price/PriceDisplay'
import { toast } from 'sonner'
import { Copy, Search } from 'lucide-react'
import { useGroupModelMetrics } from '@/feature/monitor/runtime-hooks'

interface GroupModelsTabProps {
    groupId: string
}

export function GroupModelsTab({ groupId }: GroupModelsTabProps) {
    const { t } = useTranslation()
    const [searchKeyword, setSearchKeyword] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')

    const { data: models, isLoading, error } = useQuery({
        queryKey: ['groupModels', groupId],
        queryFn: () => dashboardApi.getGroupModels(groupId),
        enabled: !!groupId,
    })

    const categoryOptions = useMemo(() => {
        if (!models) return []
        const categorySet = new Set<string>()
        let hasEmptyCategory = false

        for (const model of models) {
            if (model.category) {
                categorySet.add(model.category)
            } else {
                hasEmptyCategory = true
            }
        }

        const options = [...categorySet].sort((a, b) => a.localeCompare(b))
        if (hasEmptyCategory) {
            options.push('__empty__')
        }
        return options
    }, [models])

    const filteredModels = useMemo(() => {
        if (!models) return []
        let filtered = models
        if (searchKeyword) {
            const keyword = searchKeyword.toLowerCase()
            filtered = filtered.filter(m =>
                m.model.toLowerCase().includes(keyword) ||
                (m.category || '').toLowerCase().includes(keyword)
            )
        }
        if (categoryFilter === '__empty__') {
            filtered = filtered.filter((model) => !model.category)
        } else if (categoryFilter && categoryFilter !== '__all__') {
            filtered = filtered.filter((model) => model.category === categoryFilter)
        }
        return filtered
    }, [models, searchKeyword, categoryFilter])
    const { data: runtimeMetrics } = useGroupModelMetrics(groupId, !!groupId && filteredModels.length > 0)
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(t('common.copied'))
        }).catch(() => {
            toast.error(t('common.copyFailed'))
        })
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>{t('error.loading')}</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
            </div>
        )
    }

    if (!models || models.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>{t('common.noResult')}</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('common.search')}
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
                <div className="w-44">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder={t('model.categoryFilterPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">{t('model.allCategories')}</SelectItem>
                            {categoryOptions.map((category) => (
                                <SelectItem key={category} value={category}>
                                    {category === '__empty__' ? t('model.emptyCategory') : category}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('group.models.model')}</TableHead>
                            <TableHead>{t('model.category')}</TableHead>
                            <TableHead>{t('group.models.type')}</TableHead>
                            <TableHead>{t('common.runtime')}</TableHead>
                            <TableHead>{t('group.models.rpm')}</TableHead>
                            <TableHead>{t('group.models.tpm')}</TableHead>
                            <TableHead>{t('group.price.title')}</TableHead>
                            <TableHead>{t('group.models.plugins')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredModels.map((model) => (
                            <TableRow key={model.model}>
                                <TableCell>
                                    <button
                                        className="font-mono text-sm hover:underline cursor-pointer text-left"
                                        onClick={() => copyToClipboard(model.model)}
                                    >
                                        <span className="flex items-center gap-1">
                                            {model.model}
                                            <Copy className="h-3 w-3 text-muted-foreground" />
                                        </span>
                                    </button>
                                </TableCell>
                                <TableCell>
                                    {model.category || (
                                        <span className="text-muted-foreground text-sm">{t('model.emptyCategory')}</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {t(`modeType.${model.type}` as never)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {(() => {
                                        const metric = runtimeMetrics?.models?.[model.model]
                                        if (!metric) return <span className="text-muted-foreground text-sm">-</span>
                                        return (
                                            <div className="flex flex-wrap gap-1">
                                                <Badge variant="outline" className="text-xs">RPM {metric.rpm.toLocaleString()}</Badge>
                                                <Badge variant="outline" className="text-xs">TPM {metric.tpm.toLocaleString()}</Badge>
                                            </div>
                                        )
                                    })()}
                                </TableCell>
                                <TableCell>{model.rpm || '-'}</TableCell>
                                <TableCell>{model.tpm || '-'}</TableCell>
                                <TableCell>
                                    <PriceDisplay price={model.price} />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {model.enabled_plugins && model.enabled_plugins.length > 0 ? (
                                            model.enabled_plugins.map((plugin) => (
                                                <Badge key={plugin} variant="secondary" className="text-xs">
                                                    {plugin}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredModels.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                                    {t('common.noResult')}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
