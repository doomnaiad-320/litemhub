import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { KeyRound, Loader2, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useUserPortalUpdatePassword } from '@/feature/user-portal/hooks'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'

interface ProfilePasswordFormValues {
    currentPassword: string
    newPassword: string
    confirmNewPassword: string
}

export default function UserPortalProfilePage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const user = useUserPortalAuthStore((state) => state.user)
    const updatePasswordMutation = useUserPortalUpdatePassword()

    const schema = useMemo(() => z.object({
        currentPassword: z.string().trim().min(1, t('portal.profile.currentPasswordRequired')),
        newPassword: z.string().trim().min(6, t('portal.profile.passwordMin')),
        confirmNewPassword: z.string().trim().min(6, t('portal.profile.passwordMin')),
    }).refine((value) => value.newPassword === value.confirmNewPassword, {
        path: ['confirmNewPassword'],
        message: t('portal.profile.passwordNotMatch'),
    }).refine((value) => value.currentPassword !== value.newPassword, {
        path: ['newPassword'],
        message: t('portal.profile.passwordSame'),
    }), [t])

    const form = useForm<ProfilePasswordFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
        },
    })

    const accountLabel = user?.username || user?.email || `#${user?.id ?? ''}`
    const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'

    const onSubmit = (values: ProfilePasswordFormValues) => {
        updatePasswordMutation.mutate(
            {
                current_password: values.currentPassword.trim(),
                new_password: values.newPassword.trim(),
                confirm_new_password: values.confirmNewPassword.trim(),
            },
            {
                onSuccess: () => {
                    form.reset()
                },
            },
        )
    }

    return (
        <div className="max-w-[520px] space-y-4 font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:text-white">
            <header className="space-y-2">
                <div className="text-sm font-medium text-primary">{t('portal.profile.badge')}</div>
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold tracking-tight text-[#18181b] dark:text-white">
                    {t('portal.profile.title')}
                </h1>
                <p className="text-sm leading-[1.6] text-muted-foreground">
                    {t('portal.profile.description')}
                </p>
            </header>

            <section
                aria-label={t('portal.profile.accountTitle')}
                className="rounded-md border border-border bg-background px-3 py-3 shadow-none dark:border-white/10"
            >
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#181e25] text-white dark:bg-white dark:text-[#181e25]">
                        <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">{accountLabel}</div>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{user?.email || '-'}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border border-border bg-muted/30 px-2 py-1 dark:border-white/10 dark:bg-white/[0.03]">
                        {t('portal.profile.userId', { id: user?.id ?? '-' })}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 dark:border-white/10 dark:bg-white/[0.03]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {createdAt}
                    </span>
                </div>
            </section>

            <Card className="rounded-md border-border bg-background shadow-none dark:border-white/10">
                <CardHeader className="space-y-1 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground dark:border-white/10">
                            <KeyRound className="h-4 w-4" />
                        </div>
                        <div>
                            <CardTitle className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-base">
                                {t('portal.profile.passwordTitle')}
                            </CardTitle>
                            <p className="mt-1 text-sm leading-[1.5] text-muted-foreground">
                                {t('portal.profile.passwordDescription')}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('portal.profile.currentPassword')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                autoComplete="current-password"
                                                className="h-10 rounded-md"
                                                placeholder={t('portal.profile.currentPasswordPlaceholder')}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('portal.profile.newPassword')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                autoComplete="new-password"
                                                className="h-10 rounded-md"
                                                placeholder={t('portal.profile.newPasswordPlaceholder')}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="confirmNewPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('portal.profile.confirmNewPassword')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                autoComplete="new-password"
                                                className="h-10 rounded-md"
                                                placeholder={t('portal.profile.confirmNewPasswordPlaceholder')}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormDescription className="text-xs leading-[1.6]">
                                {t('portal.profile.passwordHelp')}
                            </FormDescription>

                            <Button
                                type="submit"
                                className="h-10 w-full rounded-md bg-[#181e25] text-white hover:bg-[#111827] dark:bg-white dark:text-[#181e25] dark:hover:bg-white/90"
                                disabled={updatePasswordMutation.isPending}
                            >
                                {updatePasswordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                {updatePasswordMutation.isPending
                                    ? t('portal.profile.updatingPassword')
                                    : t('portal.profile.updatePassword')}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
