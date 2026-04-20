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
import { APP_USER_STATUS, type AppUser } from '@/types/app-user'
import { useCreateAppUser, useUpdateAppUser } from '../hooks'

type AppUserDialogMode = 'create' | 'update'

interface AppUserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: AppUserDialogMode
    user?: AppUser | null
}

interface AppUserFormValues {
    email: string
    phone: string
    password: string
    status: '1' | '2'
}

export function AppUserDialog({
    open,
    onOpenChange,
    mode,
    user = null,
}: AppUserDialogProps) {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const { createAppUser, isLoading: isCreating } = useCreateAppUser()
    const { updateAppUser, isLoading: isUpdating } = useUpdateAppUser()
    const isLoading = mode === 'create' ? isCreating : isUpdating

    const schema = useMemo(() => z.object({
        email: z.string().trim().email(t('appUser.dialog.emailInvalid')).or(z.literal('')),
        phone: z.string().trim(),
        password: z.string(),
        status: z.enum(['1', '2']),
    }).superRefine((value, ctx) => {
        if (!value.email && !value.phone.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t('appUser.dialog.accountRequired'),
                path: ['email'],
            })
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t('appUser.dialog.accountRequired'),
                path: ['phone'],
            })
        }

        if (mode === 'create' && value.password.trim().length < 6) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t('appUser.dialog.passwordMin'),
                path: ['password'],
            })
        }
    }), [mode, t])

    const form = useForm<AppUserFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: '',
            phone: '',
            password: '',
            status: String(APP_USER_STATUS.ENABLED) as '1' | '2',
        },
    })

    useEffect(() => {
        if (!open) {
            return
        }

        form.reset({
            email: user?.email || '',
            phone: user?.phone || '',
            password: '',
            status: String(user?.status || APP_USER_STATUS.ENABLED) as '1' | '2',
        })
    }, [form, open, user])

    const onSubmit = (values: AppUserFormValues) => {
        const payload = {
            email: values.email.trim() || undefined,
            phone: values.phone.trim() || undefined,
        }

        if (mode === 'create') {
            createAppUser({
                ...payload,
                password: values.password.trim(),
                status: Number(values.status) as typeof APP_USER_STATUS[keyof typeof APP_USER_STATUS],
            }, {
                onSuccess: () => onOpenChange(false),
            })
            return
        }

        if (!user) {
            return
        }

        updateAppUser({
            id: user.id,
            data: payload,
        }, {
            onSuccess: () => onOpenChange(false),
        })
    }

    const title = mode === 'create' ? t('appUser.dialog.createTitle') : t('appUser.dialog.updateTitle')
    const description = mode === 'create'
        ? t('appUser.dialog.createDescription')
        : t('appUser.dialog.updateDescription')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-5">
                    <DialogTitle className="text-xl">{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="px-6 py-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('appUser.email')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('appUser.dialog.emailPlaceholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('appUser.phone')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('appUser.dialog.phonePlaceholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {mode === 'create' && (
                                <>
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('appUser.dialog.password')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        placeholder={t('appUser.dialog.passwordPlaceholder')}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('appUser.status')}</FormLabel>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="1">{t('appUser.enabled')}</SelectItem>
                                                        <SelectItem value="2">{t('appUser.disabled')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </>
                            )}

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
                                    {isLoading
                                        ? t('common.saving')
                                        : mode === 'create'
                                            ? t('appUser.dialog.createSubmit')
                                            : t('appUser.dialog.updateSubmit')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
