import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormDescription,
    FormMessage,
} from '@/components/ui/form'
import { useUserPortalLogin } from '@/feature/user-portal/hooks'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'
import { UserPortalAuthShell } from '@/feature/user-portal/components/UserPortalAuthShell'
import { UserPortalOAuthButtons } from '@/feature/user-portal/components/UserPortalOAuthButtons'
import { ROUTES } from '@/routes/constants'
import type { UserPortalAuthResponse } from '@/types/user-portal'

interface UserPortalLoginForm {
    email: string
    password: string
}

export default function UserPortalLoginPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const navigate = useNavigate()
    const loginMutation = useUserPortalLogin()
    const login = useUserPortalAuthStore((state) => state.login)

    const schema = useMemo(() => z.object({
        email: z.string().trim().email(t('portalAuth.emailInvalid')),
        password: z.string().trim().min(6, t('portalAuth.passwordMin')),
    }), [t])

    const form = useForm<UserPortalLoginForm>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: '',
            password: '',
        },
    })

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const oauthPayload = hashParams.get('oauth')
        const oauthError = hashParams.get('oauth_error')

        if (!oauthPayload && !oauthError) {
            return
        }

        window.history.replaceState(null, '', window.location.pathname + window.location.search)

        if (oauthError) {
            toast.error(oauthError)
            return
        }

        if (!oauthPayload) {
            toast.error(t('portalAuth.oauthLoginFailed'))
            return
        }

        try {
            const response = JSON.parse(oauthPayload) as UserPortalAuthResponse
            if (!response?.token || !response?.expires_at || !response?.user) {
                throw new Error('invalid oauth payload')
            }

            login({
                token: response.token,
                expiresAt: response.expires_at,
                user: response.user,
            })
            toast.success(t('portalAuth.loginSuccess'))
            navigate(ROUTES.HOME, { replace: true, state: null })
        } catch {
            toast.error(t('portalAuth.oauthLoginFailed'))
        }
    }, [login, navigate, t])

    const onSubmit = (values: UserPortalLoginForm) => {
        loginMutation.mutate({
            email: values.email.trim().toLowerCase(),
            password: values.password.trim(),
        })
    }

    return (
        <UserPortalAuthShell mode="login">
            <div className="mb-7 text-center">
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[26px] font-semibold leading-tight text-[#151515] dark:text-white">
                    {t('portalAuth.loginTitle')}
                </h1>
                <p className="mt-2 text-base leading-6 text-[#6b6b6b] dark:text-white/55">
                    {t('portalAuth.loginDescription')}
                </p>
            </div>

            <div className="mb-6">
                <UserPortalOAuthButtons />
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-white/85">
                                    {t('portalAuth.email')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="email"
                                        autoComplete="email"
                                        placeholder={t('portalAuth.emailPlaceholder')}
                                        className="h-9 rounded-[8px] border-[#d9d9d9] bg-white px-3 text-sm text-[#151515] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-[#151515] focus-visible:ring-[#151515]/10 dark:border-white/10 dark:bg-[#15181c] dark:text-white dark:focus-visible:border-white dark:focus-visible:ring-white/10"
                                    />
                                </FormControl>
                                <FormDescription className="text-xs text-[#7a7a7a] dark:text-white/40">
                                    {t('portalAuth.loginEmailHint')}
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-white/85">
                                    {t('portalAuth.password')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder={t('portalAuth.passwordPlaceholder')}
                                        className="h-9 rounded-[8px] border-[#d9d9d9] bg-white px-3 text-sm text-[#151515] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-[#151515] focus-visible:ring-[#151515]/10 dark:border-white/10 dark:bg-[#15181c] dark:text-white dark:focus-visible:border-white dark:focus-visible:ring-white/10"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="mt-1 h-9 w-full rounded-[8px] bg-[#151515] text-sm font-medium text-white shadow-none transition hover:bg-[#262626] active:translate-y-px dark:bg-white dark:text-[#111316] dark:hover:bg-white/90"
                        disabled={loginMutation.isPending}
                    >
                        {loginMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('portalAuth.loggingIn')}
                            </>
                        ) : (
                            <>
                                <KeyRound className="h-4 w-4" />
                                {t('portalAuth.login')}
                            </>
                        )}
                    </Button>
                </form>
            </Form>

            <div className="mt-7 text-center text-sm text-[#151515] dark:text-white/75">
                {t('portalAuth.noAccount')}
                <Link to={ROUTES.USER_REGISTER} className="ml-1 underline underline-offset-2 hover:text-[#4b4b4b] dark:hover:text-white">
                    {t('portalAuth.toRegister')}
                </Link>
            </div>
        </UserPortalAuthShell>
    )
}
