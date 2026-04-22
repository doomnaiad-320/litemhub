import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogTable } from '@/feature/log/components/LogTable'
import { useUserPortalModelLogs } from '@/feature/user-portal/hooks'

export default function UserPortalLogsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const [modelPage, setModelPage] = useState(1)
    const [modelPageSize, setModelPageSize] = useState(20)

    const { data: modelData, isLoading: isModelLoading } = useUserPortalModelLogs(modelPage, modelPageSize, true)
    const modelLogs = modelData?.logs || []
    const modelTotal = modelData?.total || 0

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="space-y-2">
                    <div className="text-sm text-primary">{t('portal.logs.badge')}</div>
                    <h1 className="text-3xl font-semibold tracking-tight">{t('portal.logs.title')}</h1>
                    <p className="max-w-3xl text-muted-foreground">{t('portal.logs.description')}</p>
                </div>
            </section>

            <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/5">
                <CardHeader>
                    <CardTitle>{t('portal.logs.modelList')}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    <LogTable
                        data={modelLogs}
                        total={modelTotal}
                        loading={isModelLoading}
                        page={modelPage}
                        pageSize={modelPageSize}
                        onPageChange={setModelPage}
                        onPageSizeChange={(size) => {
                            setModelPageSize(size)
                            setModelPage(1)
                        }}
                        detailScope="user"
                    />
                </CardContent>
            </Card>
        </div>
    )
}
