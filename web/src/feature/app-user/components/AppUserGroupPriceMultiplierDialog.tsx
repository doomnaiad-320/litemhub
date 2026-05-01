import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { AppUser, AppUserGroupPriceMultiplier } from '@/types/app-user'
import {
    useAppUserGroupPriceMultipliers,
    useUpdateAppUserGroupPriceMultiplier,
} from '../hooks'

interface AppUserGroupPriceMultiplierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: AppUser | null
}

const getInputValue = (item: AppUserGroupPriceMultiplier) =>
    String(item.price_multiplier_override ?? 0)

export function AppUserGroupPriceMultiplierDialog({
    open,
    onOpenChange,
    user,
}: AppUserGroupPriceMultiplierDialogProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const [groupKeyword, setGroupKeyword] = useState('')
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const { updateAppUserGroupPriceMultiplier, isLoading: isSaving } = useUpdateAppUserGroupPriceMultiplier()
    const { data, isLoading, refetch } = useAppUserGroupPriceMultipliers(
        user?.id,
        1,
        50,
        groupKeyword.trim() || undefined,
        open && !!user?.id,
    )

    const groups = useMemo(() => data?.groups || [], [data?.groups])

    useEffect(() => {
        if (!open) {
            return
        }

        setGroupKeyword('')
        setDrafts({})
    }, [open])

    useEffect(() => {
        if (!open) {
            return
        }

        setDrafts((current) => {
            const next = { ...current }
            for (const item of groups) {
                if (next[item.group] === undefined) {
                    next[item.group] = getInputValue(item)
                }
            }
            return next
        })
    }, [groups, open])

    const saveGroup = (item: AppUserGroupPriceMultiplier) => {
        if (!user) {
            return
        }

        const rawValue = drafts[item.group] ?? '0'
        const value = Number(rawValue)
        if (!Number.isFinite(value) || value < 0) {
            return
        }

        updateAppUserGroupPriceMultiplier({
            id: user.id,
            data: {
                group: item.group,
                price_multiplier_override: value,
            },
        }, {
            onSuccess: () => {
                setDrafts((current) => ({
                    ...current,
                    [item.group]: String(value),
                }))
                refetch()
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-border/60 px-5 py-4">
                    <DialogTitle className="text-xl">
                        {t('appUser.groupPriceMultiplierDialog.title')}
                    </DialogTitle>
                    <DialogDescription>{user?.email || user?.phone || `#${user?.id ?? ''}`}</DialogDescription>
                </DialogHeader>

                <div className="p-4">
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={groupKeyword}
                            onChange={(e) => setGroupKeyword(e.target.value)}
                            placeholder={t('appUser.groupPriceMultiplierDialog.searchPlaceholder')}
                            className="pl-9"
                        />
                    </div>

                    <div className="h-[420px] overflow-auto rounded-xl border border-border/60">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead>{t('appUser.groupPriceMultiplierDialog.group')}</TableHead>
                                    <TableHead className="w-28 text-right">
                                        {t('appUser.groupPriceMultiplierDialog.defaultMultiplier')}
                                    </TableHead>
                                    <TableHead className="w-40">
                                        <div className="flex flex-col">
                                            <span>{t('appUser.groupPriceMultiplierDialog.multiplier')}</span>
                                            <span className="text-xs font-normal text-muted-foreground">
                                                {t('appUser.groupPriceMultiplierDialog.zeroHint')}
                                            </span>
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-24 text-right">{t('common.save')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 8 }).map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell colSpan={4}>
                                                <Skeleton className="h-9 rounded-lg" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : groups.length > 0 ? (
                                    groups.map((item) => {
                                        const draft = drafts[item.group] ?? getInputValue(item)
                                        const value = Number(draft)
                                        const invalid = !Number.isFinite(value) || value < 0

                                        return (
                                            <TableRow key={item.group}>
                                                <TableCell>
                                                    <div className="font-medium">{item.group}</div>
                                                    {item.description && (
                                                        <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">
                                                    x{item.group_price_multiplier || 1}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        value={draft}
                                                        onChange={(event) => {
                                                            setDrafts((current) => ({
                                                                ...current,
                                                                [item.group]: event.target.value,
                                                            }))
                                                        }}
                                                        className="h-9"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={isSaving || invalid}
                                                        onClick={() => saveGroup(item)}
                                                    >
                                                        {t('common.save')}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                                            {t('common.noResult')}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
