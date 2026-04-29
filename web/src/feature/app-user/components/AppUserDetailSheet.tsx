import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Pencil, Wallet, Key } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppUser } from '@/types/app-user'
import { useAppUser, useAppUserWallet } from '../hooks'

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
    const userId = user?.id

    const { data: userData, isLoading: isUserLoading } = useAppUser(userId, open && !!userId)
    const { data: walletData, isLoading: isWalletLoading } = useAppUserWallet(userId, open && !!userId)

    const currentUser = userData?.user || user
    const wallet = walletData?.wallet
    const account = currentUser?.email || currentUser?.phone || `#${currentUser?.id ?? ''}`

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

                            <div className="space-y-4">
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
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">{t('common.noResult')}</div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
