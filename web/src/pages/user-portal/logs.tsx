import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
        <div className="space-y-4 sm:space-y-6">
            <section className="rounded-[18px] border border-white/60 bg-white/70 p-3 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:rounded-[24px] sm:p-4">
                <p className="max-w-3xl text-[12px] leading-5 text-muted-foreground">{t('portal.logs.description')}</p>
            </section>

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
        </div>
    )
}
