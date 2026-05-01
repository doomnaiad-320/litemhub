import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { appUserApi } from '@/api/app-user'
import type {
    CreateAppUserRequest,
    RechargeAppUserBalanceRequest,
    ResetAppUserPasswordRequest,
    UpdateAppUserGroupPriceMultiplierRequest,
    UpdateAppUserRequest,
    UpdateAppUserStatusRequest,
} from '@/types/app-user'

const invalidateAppUserQueries = (queryClient: ReturnType<typeof useQueryClient>, userId?: number) => {
    queryClient.invalidateQueries({ queryKey: ['appUsers'] })

    if (userId) {
        queryClient.invalidateQueries({ queryKey: ['appUser', userId] })
        queryClient.invalidateQueries({ queryKey: ['appUserWallet', userId] })
        queryClient.invalidateQueries({ queryKey: ['appUserGroupPriceMultipliers', userId] })
    }
}

export const useAppUsers = (
    page: number,
    perPage: number,
    keyword?: string,
    status?: number,
) => {
    const query = useQuery({
        queryKey: ['appUsers', page, perPage, keyword, status],
        queryFn: () => appUserApi.getAppUsers(page, perPage, keyword, status),
    })

    return {
        ...query,
    }
}

export const useAppRechargeLogs = (
    page: number,
    perPage: number,
    startTimestamp?: number,
    endTimestamp?: number,
    keyword?: string,
    status?: string,
    channel?: string,
) => {
    return useQuery({
        queryKey: ['appRechargeLogs', page, perPage, startTimestamp, endTimestamp, keyword, status, channel],
        queryFn: () => appUserApi.getAppRechargeLogs(
            page,
            perPage,
            startTimestamp,
            endTimestamp,
            keyword,
            status,
            channel,
        ),
    })
}

export const useAppRechargeStats = (
    startTimestamp?: number,
    endTimestamp?: number,
    keyword?: string,
    granularity?: string,
) => {
    return useQuery({
        queryKey: ['appRechargeStats', startTimestamp, endTimestamp, keyword, granularity],
        queryFn: () => appUserApi.getAppRechargeStats(startTimestamp, endTimestamp, keyword, granularity),
    })
}

export const useAppUser = (id?: number | null, enabled = true) => {
    const query = useQuery({
        queryKey: ['appUser', id],
        queryFn: () => appUserApi.getAppUser(id as number),
        enabled: enabled && !!id,
    })

    return {
        ...query,
    }
}

export const useAppUserWallet = (id?: number | null, enabled = true) => {
    const query = useQuery({
        queryKey: ['appUserWallet', id],
        queryFn: () => appUserApi.getAppUserWallet(id as number),
        enabled: enabled && !!id,
    })

    return {
        ...query,
    }
}

export const useAppUserGroupPriceMultipliers = (
    id?: number | null,
    page = 1,
    perPage = 50,
    keyword?: string,
    enabled = true,
) => {
    return useQuery({
        queryKey: ['appUserGroupPriceMultipliers', id, page, perPage, keyword],
        queryFn: () => appUserApi.getAppUserGroupPriceMultipliers(id as number, page, perPage, keyword),
        enabled: enabled && !!id,
    })
}

export const useCreateAppUser = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: (data: CreateAppUserRequest) => appUserApi.createAppUser(data),
        onSuccess: () => {
            invalidateAppUserQueries(queryClient)
            setError(null)
            toast.success('用户创建成功')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '创建用户失败')
        },
    })

    return {
        createAppUser: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useUpdateAppUser = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateAppUserRequest }) => appUserApi.updateAppUser(id, data),
        onSuccess: (_, variables) => {
            invalidateAppUserQueries(queryClient, variables.id)
            setError(null)
            toast.success('用户更新成功')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '更新用户失败')
        },
    })

    return {
        updateAppUser: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useUpdateAppUserStatus = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateAppUserStatusRequest }) =>
            appUserApi.updateAppUserStatus(id, data),
        onSuccess: (_, variables) => {
            invalidateAppUserQueries(queryClient, variables.id)
            setError(null)
            toast.success('用户状态已更新')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '更新用户状态失败')
        },
    })

    return {
        updateAppUserStatus: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useDeleteAppUser = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: (id: number) => appUserApi.deleteAppUser(id),
        onSuccess: (_, id) => {
            invalidateAppUserQueries(queryClient, id)
            setError(null)
            toast.success('用户已禁用')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '禁用用户失败')
        },
    })

    return {
        deleteAppUser: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useResetAppUserPassword = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ResetAppUserPasswordRequest }) =>
            appUserApi.resetAppUserPassword(id, data),
        onSuccess: (_, variables) => {
            invalidateAppUserQueries(queryClient, variables.id)
            setError(null)
            toast.success('密码重置成功')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '重置密码失败')
        },
    })

    return {
        resetAppUserPassword: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useRechargeAppUserBalance = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: RechargeAppUserBalanceRequest }) =>
            appUserApi.rechargeAppUserBalance(id, data),
        onSuccess: (_, variables) => {
            invalidateAppUserQueries(queryClient, variables.id)
            setError(null)
            toast.success('充值成功')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '充值失败')
        },
    })

    return {
        rechargeAppUserBalance: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useUpdateAppUserGroupPriceMultiplier = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateAppUserGroupPriceMultiplierRequest }) =>
            appUserApi.updateAppUserGroupPriceMultiplier(id, data),
        onSuccess: (_, variables) => {
            invalidateAppUserQueries(queryClient, variables.id)
            setError(null)
            toast.success('分组专属倍率已更新')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '更新分组专属倍率失败')
        },
    })

    return {
        updateAppUserGroupPriceMultiplier: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}
