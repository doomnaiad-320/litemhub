import { useEffect } from 'react'
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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { useRechargeAppUserBalance } from '../hooks'
import type { AppUser } from '@/types/app-user'

interface AppUserRechargeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: AppUser | null
}

interface RechargeFormValues {
    amount: number
    channel: string
    trade_no: string
    remark: string
    raw_payload: string
}

const rechargeSchema = z.object({
    amount: z.number().positive(),
    channel: z.string().trim(),
    trade_no: z.string().trim(),
    remark: z.string().trim(),
    raw_payload: z.string().trim(),
})

export function AppUserRechargeDialog({
    open,
    onOpenChange,
    user,
}: AppUserRechargeDialogProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const { rechargeAppUserBalance, isLoading } = useRechargeAppUserBalance()

    const form = useForm<RechargeFormValues>({
        resolver: zodResolver(rechargeSchema),
        defaultValues: {
            amount: 0,
            channel: 'manual',
            trade_no: '',
            remark: '',
            raw_payload: '',
        },
    })

    useEffect(() => {
        if (!open) {
            return
        }

        form.reset({
            amount: 0,
            channel: 'manual',
            trade_no: '',
            remark: '',
            raw_payload: '',
        })
    }, [form, open])

    const onSubmit = (values: RechargeFormValues) => {
        if (!user) {
            return
        }

        rechargeAppUserBalance({
            id: user.id,
            data: {
                amount: values.amount,
                channel: values.channel.trim() || 'manual',
                trade_no: values.trade_no.trim() || undefined,
                remark: values.remark.trim() || undefined,
                raw_payload: values.raw_payload.trim() || undefined,
            },
        }, {
            onSuccess: () => onOpenChange(false),
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-5">
                    <DialogTitle className="text-xl">{t('appUser.rechargeDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('appUser.rechargeDialog.description', {
                            account: user?.email || user?.phone || `#${user?.id ?? ''}`,
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('appUser.rechargeDialog.amount')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                placeholder="100"
                                                value={Number.isFinite(field.value) ? field.value : ''}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="channel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('appUser.rechargeDialog.channel')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('appUser.rechargeDialog.channelPlaceholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="trade_no"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('appUser.rechargeDialog.tradeNo')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('appUser.rechargeDialog.tradeNoPlaceholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="remark"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('appUser.rechargeDialog.remark')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={t('appUser.rechargeDialog.remarkPlaceholder')}
                                                className="min-h-[88px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="raw_payload"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('appUser.rechargeDialog.rawPayload')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={t('appUser.rechargeDialog.rawPayloadPlaceholder')}
                                                className="min-h-[88px]"
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
                                    {isLoading ? t('appUser.rechargeDialog.submitting') : t('appUser.recharge')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
