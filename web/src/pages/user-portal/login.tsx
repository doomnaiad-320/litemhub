import { useEffect, useMemo, useState } from 'react'
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
import { UserPortalAgreementConsent } from '@/feature/user-portal/components/UserPortalAgreementConsent'
import { ROUTES } from '@/routes/constants'
import type { UserPortalAuthResponse } from '@/types/user-portal'

interface UserPortalLoginForm {
    account: string
    password: string
}

export default function UserPortalLoginPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const navigate = useNavigate()
    const loginMutation = useUserPortalLogin()
    const login = useUserPortalAuthStore((state) => state.login)
    const [agreementAccepted, setAgreementAccepted] = useState(false)
    const [agreementError, setAgreementError] = useState(false)

    const schema = useMemo(() => z.object({
        account: z.string().trim().min(1, t('portalAuth.accountRequired')),
        password: z.string().trim().min(6, t('portalAuth.passwordMin')),
    }), [t])

    const form = useForm<UserPortalLoginForm>({
        resolver: zodResolver(schema),
        defaultValues: {
            account: '',
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

    const ensureAgreementAccepted = () => {
        if (agreementAccepted) {
            return true
        }

        setAgreementError(true)
        toast.error(t('portalAuth.agreementRequired'))
        return false
    }

    const handleAgreementChange = (checked: boolean) => {
        setAgreementAccepted(checked)
        if (checked) {
            setAgreementError(false)
        }
    }

    const onSubmit = (values: UserPortalLoginForm) => {
        if (!ensureAgreementAccepted()) {
            return
        }

        loginMutation.mutate({
            account: values.account.trim(),
            password: values.password.trim(),
            accepted_terms: true,
        })
    }

    return (
        <UserPortalAuthShell mode="login">
            <div className="mb-7 text-center">
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[26px] font-semibold leading-tight text-[#151515] dark:text-foreground">
                    {t('portalAuth.loginTitle')}
                </h1>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                        control={form.control}
                        name="account"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-foreground">
                                    {t('portalAuth.account')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="text"
                                        autoComplete="username"
                                        placeholder={t('portalAuth.accountPlaceholder')}
                                        className="h-9 rounded-[8px] border-[#d9d9d9] bg-white px-3 text-sm text-[#151515] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-[#151515] focus-visible:ring-[#151515]/10 dark:border-input dark:bg-muted dark:text-foreground dark:focus-visible:border-ring dark:focus-visible:ring-ring/20"
                                    />
                                </FormControl>
                                <FormDescription className="text-xs text-[#7a7a7a] dark:text-muted-foreground">
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
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-foreground">
                                    {t('portalAuth.password')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder={t('portalAuth.passwordPlaceholder')}
                                        className="h-9 rounded-[8px] border-[#d9d9d9] bg-white px-3 text-sm text-[#151515] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-[#151515] focus-visible:ring-[#151515]/10 dark:border-input dark:bg-muted dark:text-foreground dark:focus-visible:border-ring dark:focus-visible:ring-ring/20"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <UserPortalAgreementConsent
                        checked={agreementAccepted}
                        error={agreementError}
                        onCheckedChange={handleAgreementChange}
                    />

                    <Button
                        type="submit"
                        className="mt-1 h-9 w-full rounded-[8px] bg-[#151515] text-sm font-medium text-white shadow-none transition hover:bg-[#262626] active:translate-y-px dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
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

            <div className="mt-7 text-center text-sm text-[#151515] dark:text-muted-foreground">
                {t('portalAuth.noAccount')}
                <Link to={ROUTES.USER_REGISTER} className="ml-1 underline underline-offset-2 hover:text-[#4b4b4b] dark:text-foreground dark:hover:text-[#f6c177]">
                    {t('portalAuth.toRegister')}
                </Link>
            </div>

            <div className="mt-7">
                <UserPortalOAuthButtons dividerPosition="top" onBeforeStart={ensureAgreementAccepted} />
            </div>
        </UserPortalAuthShell>
    )
}
