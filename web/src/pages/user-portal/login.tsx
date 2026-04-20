import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CreditCard, Mail, Phone, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { LanguageSelector } from '@/components/common/LanguageSelector'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useUserPortalLogin } from '@/feature/user-portal/hooks'

interface UserPortalLoginForm {
    account: string
    password: string
}

export default function UserPortalLoginPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const navigate = useNavigate()
    const [loginType, setLoginType] = useState<'email' | 'phone'>('email')
    const loginMutation = useUserPortalLogin()

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

    const onSubmit = (values: UserPortalLoginForm) => {
        const payload = loginType === 'email'
            ? { email: values.account.trim(), password: values.password.trim() }
            : { phone: values.account.trim(), password: values.password.trim() }

        loginMutation.mutate(payload)
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.16),_transparent_30%),linear-gradient(180deg,_#f8faff_0%,_#eef2ff_100%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(106,109,230,0.2),_transparent_26%),linear-gradient(180deg,_#0f172a_0%,_#09111f_100%)]">
            <div className="mx-auto flex max-w-6xl items-start justify-between gap-6">
                <div className="hidden lg:block">
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="flex items-center gap-3 rounded-3xl border border-white/70 bg-white/85 px-4 py-3 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6A6DE6] to-[#8A8DF7] text-white shadow-lg">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                            <div className="text-sm text-muted-foreground">AI Proxy</div>
                            <div className="text-lg font-semibold tracking-tight">{t('portalAuth.title')}</div>
                        </div>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <LanguageSelector variant="minimal" />
                </div>
            </div>

            <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="hidden lg:flex flex-col justify-center rounded-[32px] border border-white/60 bg-white/55 p-10 shadow-[0_32px_64px_-48px_rgba(15,23,42,0.4)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
                    <div className="max-w-xl space-y-6">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                            <ShieldCheck className="h-4 w-4" />
                            {t('portalAuth.slogan')}
                        </div>
                        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                            {t('portalAuth.heroTitle')}
                        </h1>
                        <p className="text-lg leading-8 text-muted-foreground">
                            {t('portalAuth.heroDescription')}
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-3xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                                <div className="text-sm text-muted-foreground">{t('portalAuth.feature1Title')}</div>
                                <div className="mt-2 text-base font-medium">{t('portalAuth.feature1Desc')}</div>
                            </div>
                            <div className="rounded-3xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                                <div className="text-sm text-muted-foreground">{t('portalAuth.feature2Title')}</div>
                                <div className="mt-2 text-base font-medium">{t('portalAuth.feature2Desc')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <Card className="rounded-[32px] border-white/70 bg-white/82 shadow-[0_36px_72px_-50px_rgba(15,23,42,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/6">
                    <CardHeader className="space-y-4 px-8 pt-8">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6A6DE6] to-[#8A8DF7] text-white shadow-lg lg:hidden">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-semibold tracking-tight">
                                {t('portalAuth.loginTitle')}
                            </CardTitle>
                            <CardDescription className="mt-1 text-base">
                                {t('portalAuth.loginDescription')}
                            </CardDescription>
                        </div>
                        <div className="inline-flex rounded-2xl border border-border/70 bg-muted/40 p-1">
                            <button
                                type="button"
                                className={`rounded-xl px-4 py-2 text-sm transition ${loginType === 'email' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                onClick={() => setLoginType('email')}
                            >
                                <Mail className="mr-2 inline h-4 w-4" />
                                {t('portalAuth.email')}
                            </button>
                            <button
                                type="button"
                                className={`rounded-xl px-4 py-2 text-sm transition ${loginType === 'phone' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                onClick={() => setLoginType('phone')}
                            >
                                <Phone className="mr-2 inline h-4 w-4" />
                                {t('portalAuth.phone')}
                            </button>
                        </div>
                    </CardHeader>

                    <CardContent className="px-8 pb-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                <FormField
                                    control={form.control}
                                    name="account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{loginType === 'email' ? t('portalAuth.email') : t('portalAuth.phone')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder={loginType === 'email' ? t('portalAuth.emailPlaceholder') : t('portalAuth.phonePlaceholder')}
                                                    className="h-12 rounded-2xl"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('portalAuth.password')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="password"
                                                    placeholder={t('portalAuth.passwordPlaceholder')}
                                                    className="h-12 rounded-2xl"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={loginMutation.isPending}>
                                    {loginMutation.isPending ? t('portalAuth.loggingIn') : t('portalAuth.login')}
                                </Button>
                            </form>
                        </Form>

                        <div className="mt-6 text-center text-sm text-muted-foreground">
                            {t('portalAuth.noAccount')}
                            <Link to="/register" className="ml-2 font-medium text-primary hover:underline">
                                {t('portalAuth.toRegister')}
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
