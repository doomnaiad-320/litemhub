import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Loader2, Mail, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import {
    useUserPortalRegister,
    useUserPortalSendRegisterEmailCode,
} from '@/feature/user-portal/hooks'
import { UserPortalAuthShell } from '@/feature/user-portal/components/UserPortalAuthShell'
import { UserPortalOAuthButtons } from '@/feature/user-portal/components/UserPortalOAuthButtons'
import { UserPortalAgreementConsent } from '@/feature/user-portal/components/UserPortalAgreementConsent'
import { ROUTES } from '@/routes/constants'

const INVITE_CODE_STORAGE_KEY = 'userPortalInviteCode'

interface UserPortalRegisterForm {
    username: string
    email: string
    code: string
    password: string
    confirmPassword: string
}

const authInputClassName = 'h-9 rounded-[8px] border-[#d9d9d9] bg-white px-3 text-sm text-[#151515] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-[#151515] focus-visible:ring-[#151515]/10 dark:border-white/10 dark:bg-[#15181c] dark:text-white dark:focus-visible:border-white dark:focus-visible:ring-white/10'

export default function UserPortalRegisterPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string, options?: Record<string, unknown>) => string
    const navigate = useNavigate()
    const registerMutation = useUserPortalRegister()
    const sendCodeMutation = useUserPortalSendRegisterEmailCode()
    const [now, setNow] = useState(() => Date.now())
    const [codeCooldownEndsAt, setCodeCooldownEndsAt] = useState<number | null>(null)
    const [codeEmail, setCodeEmail] = useState('')
    const [agreementAccepted, setAgreementAccepted] = useState(false)
    const [agreementError, setAgreementError] = useState(false)
    const [inviteCode, setInviteCode] = useState('')

    const schema = useMemo(() => z.object({
        username: z.string().trim().min(3, t('portalAuth.usernameMin')).max(32, t('portalAuth.usernameMax')).regex(/^[a-zA-Z0-9_-]+$/, t('portalAuth.usernameInvalid')),
        email: z.string().trim().email(t('portalAuth.emailInvalid')),
        code: z.string().trim().min(1, t('portalAuth.codeRequired')).regex(/^\d{6}$/, t('portalAuth.codeInvalid')),
        password: z.string().trim().min(6, t('portalAuth.passwordMin')),
        confirmPassword: z.string().trim().min(6, t('portalAuth.passwordMin')),
    }).refine((data) => data.password === data.confirmPassword, {
        path: ['confirmPassword'],
        message: t('portalAuth.passwordNotMatch'),
    }), [t])

    const form = useForm<UserPortalRegisterForm>({
        resolver: zodResolver(schema),
        defaultValues: {
            username: '',
            email: '',
            code: '',
            password: '',
            confirmPassword: '',
        },
    })

    const watchedEmail = useWatch({
        control: form.control,
        name: 'email',
    })
    const normalizedEmail = useMemo(() => (watchedEmail || '').trim().toLowerCase(), [watchedEmail])

    useEffect(() => {
        setInviteCode(window.localStorage.getItem(INVITE_CODE_STORAGE_KEY) || '')
    }, [])

    useEffect(() => {
        if (!codeEmail) {
            return
        }

        if (normalizedEmail === codeEmail) {
            return
        }

        setCodeEmail('')
        setCodeCooldownEndsAt(null)
        form.setValue('code', '', {
            shouldDirty: true,
            shouldTouch: false,
            shouldValidate: false,
        })
    }, [codeEmail, form, normalizedEmail])

    useEffect(() => {
        if (!codeCooldownEndsAt) {
            return
        }

        const timer = window.setInterval(() => {
            setNow(Date.now())
        }, 1000)

        return () => window.clearInterval(timer)
    }, [codeCooldownEndsAt])

    useEffect(() => {
        if (codeCooldownEndsAt && Date.now() >= codeCooldownEndsAt) {
            setCodeCooldownEndsAt(null)
        }
    }, [codeCooldownEndsAt, now])

    const codeCooldownSeconds = codeCooldownEndsAt
        ? Math.max(0, Math.ceil((codeCooldownEndsAt - now) / 1000))
        : 0
    const emailIsValid = z.string().trim().email().safeParse(normalizedEmail).success
    const canSendCode = emailIsValid && !sendCodeMutation.isPending && codeCooldownSeconds === 0

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

    const handleSendCode = async () => {
        if (!ensureAgreementAccepted()) {
            return
        }

        const emailValid = await form.trigger('email')
        if (!emailValid) {
            return
        }

        const email = form.getValues('email').trim().toLowerCase()
        if (!email) {
            return
        }

        sendCodeMutation.mutate(
            { email },
            {
                onSuccess: (response) => {
                    const cooldownSeconds = Math.max(1, Number(response.cooldown_seconds) || 0)
                    setCodeEmail(email)
                    setCodeCooldownEndsAt(Date.now() + cooldownSeconds * 1000)
                    form.setValue('code', '', {
                        shouldDirty: true,
                        shouldTouch: false,
                        shouldValidate: false,
                    })
                },
            },
        )
    }

    const onSubmit = (values: UserPortalRegisterForm) => {
        if (!ensureAgreementAccepted()) {
            return
        }

        registerMutation.mutate(
            {
                email: values.email.trim().toLowerCase(),
                username: values.username.trim().toLowerCase(),
                code: values.code.trim(),
                password: values.password.trim(),
                invite_code: inviteCode || undefined,
                accepted_terms: true,
            },
            {
                onSuccess: () => {
                    window.localStorage.removeItem(INVITE_CODE_STORAGE_KEY)
                    navigate(ROUTES.USER_LOGIN, { replace: true })
                },
            },
        )
    }

    return (
        <UserPortalAuthShell mode="register">
            <div className="mb-7 text-center">
                <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[26px] font-semibold leading-tight text-[#151515] dark:text-white">
                    {t('portalAuth.registerTitle')}
                </h1>
                <p className="mt-2 text-base leading-6 text-[#6b6b6b] dark:text-white/55">
                    {t('portalAuth.registerDescription')}
                </p>
            </div>

            <div className="mb-6">
                <UserPortalOAuthButtons onBeforeStart={ensureAgreementAccepted} />
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-white/85">
                                    {t('portalAuth.username')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="text"
                                        autoComplete="username"
                                        placeholder={t('portalAuth.usernamePlaceholder')}
                                        className={authInputClassName}
                                    />
                                </FormControl>
                                <FormDescription className="text-xs text-[#7a7a7a] dark:text-white/40">
                                    {t('portalAuth.usernameHint')}
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-white/85">
                                    {t('portalAuth.email')}
                                </FormLabel>
                                <div className="flex gap-2">
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="email"
                                            autoComplete="email"
                                            placeholder={t('portalAuth.emailPlaceholder')}
                                            className={`min-w-0 flex-1 ${authInputClassName}`}
                                        />
                                    </FormControl>
                                    <Button
                                        type="button"
                                        onClick={handleSendCode}
                                        disabled={!canSendCode}
                                        className="h-9 shrink-0 rounded-[8px] bg-[#151515] px-3 text-sm font-medium text-white shadow-none transition hover:bg-[#262626] active:translate-y-px disabled:translate-y-0 dark:bg-white dark:text-[#111316] dark:hover:bg-white/90"
                                    >
                                        {sendCodeMutation.isPending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {t('portalAuth.sendingCode')}
                                            </>
                                        ) : codeCooldownSeconds > 0 ? (
                                            <>
                                                <Mail className="h-4 w-4" />
                                                {t('portalAuth.codeResendIn', { seconds: codeCooldownSeconds })}
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" />
                                                {t('portalAuth.sendCode')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <FormDescription className="text-xs text-[#7a7a7a] dark:text-white/40">
                                    {t('portalAuth.registerEmailHint')}
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-white/85">
                                    {t('portalAuth.verificationCode')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        placeholder={t('portalAuth.codePlaceholder')}
                                        className={authInputClassName}
                                    />
                                </FormControl>
                                <FormDescription className="text-xs text-[#7a7a7a] dark:text-white/40">
                                    {t('portalAuth.codeHint')}
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
                                        autoComplete="new-password"
                                        placeholder={t('portalAuth.passwordPlaceholder')}
                                        className={authInputClassName}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium text-[#151515] dark:text-white/85">
                                    {t('portalAuth.confirmPassword')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder={t('portalAuth.confirmPasswordPlaceholder')}
                                        className={authInputClassName}
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
                        className="mt-1 h-9 w-full rounded-[8px] bg-[#151515] text-sm font-medium text-white shadow-none transition hover:bg-[#262626] active:translate-y-px dark:bg-white dark:text-[#111316] dark:hover:bg-white/90"
                        disabled={registerMutation.isPending}
                    >
                        {registerMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('portalAuth.registering')}
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="h-4 w-4" />
                                {t('portalAuth.register')}
                            </>
                        )}
                    </Button>
                </form>
            </Form>

            <div className="mt-7 text-center text-sm text-[#151515] dark:text-white/75">
                {t('portalAuth.hasAccount')}
                <Link to={ROUTES.USER_LOGIN} className="ml-1 underline underline-offset-2 hover:text-[#4b4b4b] dark:hover:text-white">
                    {t('portalAuth.toLogin')}
                </Link>
            </div>
        </UserPortalAuthShell>
    )
}
