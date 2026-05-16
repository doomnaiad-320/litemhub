import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { LogTable } from '@/feature/log/components/LogTable'
import { useUserPortalModelLogs } from '@/feature/user-portal/hooks'
import { Button } from '@/components/ui/button'

export default function UserPortalLogsPage() {
    const { t: rawT } = useTranslation()
    const t = rawT as (key: string) => string
    const [modelPage, setModelPage] = useState(1)
    const [modelPageSize, setModelPageSize] = useState(20)

    const {
        data: modelData,
        isLoading: isModelLoading,
        isFetching: isModelFetching,
        refetch: refetchModelLogs,
    } = useUserPortalModelLogs(modelPage, modelPageSize, true)
    const modelLogs = modelData?.logs || []
    const modelTotal = modelData?.total || 0

    return (
        <div className="space-y-4 sm:space-y-6">
            <section className="rounded-md border border-border bg-background p-3 shadow-none dark:border-white/10 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-3xl text-[12px] leading-5 text-muted-foreground">{t('portal.logs.description')}</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => refetchModelLogs()}
                        disabled={isModelFetching}
                        className="h-9 px-3 sm:shrink-0"
                    >
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isModelFetching ? 'animate-spin' : ''}`} />
                        {t('common.refresh')}
                    </Button>
                </div>
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
