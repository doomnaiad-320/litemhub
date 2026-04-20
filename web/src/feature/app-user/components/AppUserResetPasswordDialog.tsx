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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { useResetAppUserPassword } from '../hooks'
import type { AppUser } from '@/types/app-user'

interface AppUserResetPasswordDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: AppUser | null
}

interface ResetPasswordFormValues {
    password: string
    confirmPassword: string
}

const resetPasswordSchema = z.object({
    password: z.string().trim().min(6),
    confirmPassword: z.string().trim().min(6),
}).refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password-not-match',
})

export function AppUserResetPasswordDialog({
    open,
    onOpenChange,
    user,
}: AppUserResetPasswordDialogProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const { resetAppUserPassword, isLoading } = useResetAppUserPassword()

    const form = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        },
    })

    useEffect(() => {
        if (open) {
            form.reset({
                password: '',
                confirmPassword: '',
            })
        }
    }, [form, open])

    const onSubmit = (values: ResetPasswordFormValues) => {
        if (!user) {
            return
        }

        resetAppUserPassword({
            id: user.id,
            data: {
                password: values.password.trim(),
            },
        }, {
            onSuccess: () => onOpenChange(false),
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-5">
                    <DialogTitle className="text-xl">{t('appUser.passwordDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('appUser.passwordDialog.description', {
                            account: user?.email || user?.phone || `#${user?.id ?? ''}`,
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('appUser.passwordDialog.password')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder={t('appUser.passwordDialog.passwordPlaceholder')}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage>
                                            {form.formState.errors.password?.message === 'String must contain at least 6 character(s)'
                                                ? t('appUser.dialog.passwordMin')
                                                : null}
                                        </FormMessage>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('appUser.passwordDialog.confirmPassword')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder={t('appUser.passwordDialog.confirmPasswordPlaceholder')}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage>
                                            {form.formState.errors.confirmPassword?.message === 'password-not-match'
                                                ? t('appUser.passwordDialog.passwordNotMatch')
                                                : form.formState.errors.confirmPassword?.message === 'String must contain at least 6 character(s)'
                                                    ? t('appUser.dialog.passwordMin')
                                                    : null}
                                        </FormMessage>
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
                                    {isLoading ? t('appUser.passwordDialog.submitting') : t('appUser.resetPassword')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
