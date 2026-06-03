import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, useLocation } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserPortalMarketingHeader } from '@/feature/user-portal/components/UserPortalMarketingHeader'
import { ROUTES } from '@/routes/constants'
import termsMarkdown from '@/content/agreements/terms.md?raw'
import privacyMarkdown from '@/content/agreements/privacy.md?raw'

export default function PublicAgreementPage() {
    const { pathname } = useLocation()
    const isPrivacy = pathname === ROUTES.PUBLIC_PRIVACY
    const markdown = isPrivacy ? privacyMarkdown : termsMarkdown

    return (
        <div className="min-h-screen overflow-x-hidden bg-white font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] transition-colors duration-200 dark:bg-background dark:text-foreground">
            <UserPortalMarketingHeader />

            <main className="relative overflow-hidden border-b border-[#f2f3f5] bg-white dark:border-border dark:bg-background">
                <div className="pointer-events-none absolute right-[-10rem] top-[-16rem] h-[34rem] w-[34rem] rounded-full bg-[#1456f0]/10 blur-3xl dark:bg-primary/[0.10]" />
                <div className="pointer-events-none absolute bottom-[-14rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[#ea5ec1]/10 blur-3xl dark:bg-amber-500/[0.07]" />

                <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
                    <Button
                        asChild
                        variant="outline"
                        className="mb-6 h-10 rounded-[8px] border-[#e5e7eb] bg-white px-4 text-sm font-medium text-[#333333] shadow-[rgba(36,36,36,0.04)_0px_8px_18px] hover:bg-[#f5f7fb] dark:border-border dark:bg-card dark:text-foreground dark:shadow-none dark:hover:bg-muted"
                    >
                        <Link to={ROUTES.USER_LOGIN}>
                            <ArrowLeft className="h-4 w-4" />
                            返回登录
                        </Link>
                    </Button>

                    <article className="rounded-[13px] border border-[#f2f3f5] bg-white px-5 py-6 shadow-[rgba(36,36,36,0.04)_0px_12px_24px] dark:border-border dark:bg-card dark:shadow-none sm:px-8 sm:py-8">
                        <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] prose-headings:font-semibold prose-h1:text-[32px] prose-h1:leading-tight prose-h2:mt-8 prose-h2:text-xl prose-p:leading-7 prose-li:leading-7 prose-a:text-[#1456f0]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {markdown}
                            </ReactMarkdown>
                        </div>
                    </article>
                </div>
            </main>
        </div>
    )
}
