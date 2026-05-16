import { useQuery } from '@tanstack/react-query'
import { logApi } from '@/api/log'
import { userPortalApi } from '@/api/user-portal'
import { LogFilters } from '@/types/log'

export type LogDetailScope = 'admin' | 'user'

// 获取日志数据
export const useLogs = (filters?: LogFilters) => {
    const query = useQuery({
        queryKey: ['logs', filters],
        queryFn: () => logApi.getLogData(filters),
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: false,
    })

    return {
        ...query,
    }
}

export const useLogStats = (filters?: LogFilters) => {
    return useQuery({
        queryKey: ['logStats', filters],
        queryFn: () => logApi.getLogStats(filters),
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: false,
    })
}

// 获取日志详情
export const useLogDetail = (logId: number | null, scope: LogDetailScope = 'admin') => {
    const query = useQuery({
        queryKey: [scope === 'user' ? 'userPortalModelLogDetail' : 'logDetail', logId],
        queryFn: () => {
            if (!logId) return null
            return scope === 'user'
                ? userPortalApi.getModelLogDetail(logId)
                : logApi.getLogDetail(logId)
        },
        // 仅在有logId时启用查询
        enabled: !!logId,
        // 禁用自动重新获取
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        // 禁用重试
        retry: false,
    })

    return {
        ...query,
    }
} 
