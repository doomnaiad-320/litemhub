import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { useAdjustAppUserWalletBalance } from '../hooks'
import type { AppUser } from '@/types/app-user'

interface AppUserBalanceAdjustDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: AppUser | null
}

interface BalanceAdjustFormValues {
    amount: number
    remark: string
}

const parseAmountInput = (value: string) => {
    if (value.trim() === '') {
        return Number.NaN
    }

    return Number(value)
}

const formatMoney = (amount?: number) => `$${(amount || 0).toFixed(4)}`

export function AppUserBalanceAdjustDialog({
    open,
    onOpenChange,
    user,
}: AppUserBalanceAdjustDialogProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const { adjustAppUserWalletBalance, isLoading } = useAdjustAppUserWalletBalance()

    const schema = useMemo(() => z.object({
        amount: z.number().finite(t('appUser.adjustDialog.amountInvalid')).refine((value) => value !== 0, {
            message: t('appUser.adjustDialog.amountInvalid'),
        }),
        remark: z.string().trim(),
    }), [t])

    const form = useForm<BalanceAdjustFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            amount: 0,
            remark: '',
        },
    })

    useEffect(() => {
        if (!open) {
            return
        }

        form.reset({
            amount: 0,
            remark: '',
        })
    }, [form, open])

    const onSubmit = (values: BalanceAdjustFormValues) => {
        if (!user) {
            return
        }

        adjustAppUserWalletBalance({
            id: user.id,
            data: {
                amount: values.amount,
                remark: values.remark.trim() || undefined,
            },
        }, {
            onSuccess: () => onOpenChange(false),
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-5">
                    <DialogTitle className="text-xl">{t('appUser.adjustDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('appUser.adjustDialog.description', {
                            account: user?.email || user?.phone || `#${user?.id ?? ''}`,
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-6">
                    <div className="mb-5 rounded-md border border-border bg-background px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                            {t('appUser.adjustDialog.currentAvailableBalance')}
                        </div>
                        <div className="mt-1 font-mono text-lg font-semibold">
                            {formatMoney(user?.available_balance)}
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('appUser.adjustDialog.amount')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="-10"
                                                value={Number.isFinite(field.value) ? field.value : ''}
                                                onChange={(event) => field.onChange(parseAmountInput(event.target.value))}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            {t('appUser.adjustDialog.amountHint')}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="remark"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('appUser.adjustDialog.remark')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={t('appUser.adjustDialog.remarkPlaceholder')}
                                                className="min-h-[96px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    disabled={isLoading}
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? t('appUser.adjustDialog.submitting') : t('appUser.adjustBalance')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
