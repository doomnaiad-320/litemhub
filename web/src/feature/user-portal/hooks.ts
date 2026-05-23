import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { LogFilters } from '@/types/log'
import type {
    UserPortalCreateKeyRequest,
    UserPortalEmailCodeRequest,
    UserPortalEmailCodeResponse,
    UserPortalLoginRequest,
    UserPortalPlaygroundChatRequest,
    UserPortalRechargeRequest,
    UserPortalRegisterRequest,
    UserPortalUpdatePasswordRequest,
    UserPortalUpdateKeyRequest,
} from '@/types/user-portal'
import { userPortalApi } from '@/api/user-portal'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'
import { ROUTES } from '@/routes/constants'

const invalidatePortalQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
    queryClient.invalidateQueries({ queryKey: ['userPortalMe'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalWallet'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalWalletLogs'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalRechargeLogs'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalReferralRecords'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalModelLogs'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalGroups'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalLineRoutes'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalKeys'] })
}

export const useUserPortalRegister = () => {
    return useMutation({
        mutationFn: (data: UserPortalRegisterRequest) => userPortalApi.register(data),
        onSuccess: () => {
            toast.success('注册成功，请登录')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '注册失败'
            toast.error(message)
        },
    })
}

export const useUserPortalSendRegisterEmailCode = () => {
    return useMutation({
        mutationFn: (data: UserPortalEmailCodeRequest) => userPortalApi.sendRegisterEmailCode(data),
        onSuccess: (_response: UserPortalEmailCodeResponse) => {
            toast.success('验证码已发送')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '发送验证码失败'
            toast.error(message)
        },
    })
}

export const useUserPortalLogin = () => {
    const navigate = useNavigate()
    const login = useUserPortalAuthStore((state) => state.login)

    return useMutation({
        mutationFn: (data: UserPortalLoginRequest) => userPortalApi.login(data),
        onSuccess: (response) => {
            login({
                token: response.token,
                expiresAt: response.expires_at,
                user: response.user,
            })
            toast.success('登录成功')
            navigate(ROUTES.HOME, { replace: true, state: null })
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '登录失败'
            toast.error(message)
        },
    })
}

export const useUserPortalMe = (enabled = true) => {
    const setUser = useUserPortalAuthStore((state) => state.setUser)
    const logout = useUserPortalAuthStore((state) => state.logout)

    return useQuery({
        queryKey: ['userPortalMe'],
        queryFn: async () => {
            const response = await userPortalApi.me()
            setUser(response.user)
            return response
        },
        enabled,
        retry: false,
        staleTime: 60 * 1000,
        meta: {
            onError: () => logout(),
        },
    })
}

export const useUserPortalUpdatePassword = () => {
    const queryClient = useQueryClient()
    const setUser = useUserPortalAuthStore((state) => state.setUser)

    return useMutation({
        mutationFn: (data: UserPortalUpdatePasswordRequest) => userPortalApi.updatePassword(data),
        onSuccess: (response) => {
            setUser(response.user)
            queryClient.invalidateQueries({ queryKey: ['userPortalMe'] })
            toast.success('密码已更新')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '更新密码失败'
            toast.error(message)
        },
    })
}

export const useUserPortalWallet = (enabled = true) => {
    return useQuery({
        queryKey: ['userPortalWallet'],
        queryFn: () => userPortalApi.getWallet(),
        enabled,
    })
}

export const useUserPortalWalletLogs = (page: number, perPage: number, enabled = true) => {
    return useQuery({
        queryKey: ['userPortalWalletLogs', page, perPage],
        queryFn: () => userPortalApi.getWalletLogs(page, perPage),
        enabled,
    })
}

export const useInfiniteUserPortalWalletLogs = (perPage = 20, enabled = true) => {
    return useInfiniteQuery({
        queryKey: ['userPortalWalletLogs', 'infinite', perPage],
        queryFn: ({ pageParam }) => userPortalApi.getWalletLogs(Number(pageParam), perPage),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            const loadedCount = allPages.reduce(
                (count, page) => count + (page.wallet_logs?.length || 0),
                0,
            )

            if (loadedCount >= lastPage.total || (lastPage.wallet_logs?.length || 0) < perPage) {
                return undefined
            }

            return allPages.length + 1
        },
        enabled,
    })
}

export const useUserPortalRechargeLogs = (page: number, perPage: number, enabled = true) => {
    return useQuery({
        queryKey: ['userPortalRechargeLogs', page, perPage],
        queryFn: () => userPortalApi.getRechargeLogs(page, perPage),
        enabled,
    })
}

export const useInfiniteUserPortalRechargeLogs = (perPage = 20, enabled = true) => {
    return useInfiniteQuery({
        queryKey: ['userPortalRechargeLogs', 'infinite', perPage],
        queryFn: ({ pageParam }) => userPortalApi.getRechargeLogs(Number(pageParam), perPage),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            const loadedCount = allPages.reduce(
                (count, page) => count + (page.recharge_logs?.length || 0),
                0,
            )

            if (loadedCount >= lastPage.total || (lastPage.recharge_logs?.length || 0) < perPage) {
                return undefined
            }

            return allPages.length + 1
        },
        enabled,
    })
}

export const useUserPortalDiscountCode = (enabled = true) => {
    return useQuery({
        queryKey: ['userPortalDiscountCode'],
        queryFn: () => userPortalApi.getDiscountCode(),
        enabled,
    })
}

export const useUserPortalReferralRecords = (page: number, perPage: number, enabled = true) => {
    return useQuery({
        queryKey: ['userPortalReferralRecords', page, perPage],
        queryFn: () => userPortalApi.getReferralRecords(page, perPage),
        enabled,
    })
}

export const useInfiniteUserPortalReferralRecords = (perPage = 20, enabled = true) => {
    return useInfiniteQuery({
        queryKey: ['userPortalReferralRecords', 'infinite', perPage],
        queryFn: ({ pageParam }) => userPortalApi.getReferralRecords(Number(pageParam), perPage),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            const loadedCount = allPages.reduce(
                (count, page) => count + (page.referral_records?.length || 0),
                0,
            )

            if (loadedCount >= lastPage.total || (lastPage.referral_records?.length || 0) < perPage) {
                return undefined
            }

            return allPages.length + 1
        },
        enabled,
    })
}

export const useGenerateUserPortalDiscountCode = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => userPortalApi.generateDiscountCode(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userPortalDiscountCode'] })
            toast.success('折扣码已生成')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '生成折扣码失败'
            toast.error(message)
        },
    })
}

export const useUserPortalDuluPayRecharge = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: UserPortalRechargeRequest) => userPortalApi.createDuluPayRecharge(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userPortalRechargeLogs'] })
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '创建支付订单失败'
            toast.error(message)
        },
    })
}

export const useUserPortalModelLogs = (
    page: number,
    perPage: number,
    filters?: LogFilters,
    enabled = true,
) => {
    return useQuery({
        queryKey: ['userPortalModelLogs', page, perPage, filters],
        queryFn: () => userPortalApi.getModelLogs(page, perPage, filters),
        enabled,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: false,
    })
}

export const useUserPortalModelLogStats = (filters?: LogFilters, enabled = true) => {
    return useQuery({
        queryKey: ['userPortalModelLogStats', filters],
        queryFn: () => userPortalApi.getModelLogStats(filters),
        enabled,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: false,
    })
}

export const useUserPortalGroups = (enabled = true) => {
    return useQuery({
        queryKey: ['userPortalGroups'],
        queryFn: () => userPortalApi.getGroups(),
        enabled,
    })
}

export const useUserPortalLineRoutes = (enabled = true) => {
    return useQuery({
        queryKey: ['userPortalLineRoutes'],
        queryFn: () => userPortalApi.getLineRoutes(),
        enabled,
    })
}

export const useUserPortalKeys = (page: number, perPage: number, group?: string, enabled = true) => {
    return useQuery({
        queryKey: ['userPortalKeys', page, perPage, group],
        queryFn: () => userPortalApi.getKeys(page, perPage, group),
        enabled,
    })
}

export const useUserPortalPlaygroundChat = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: UserPortalPlaygroundChatRequest) => userPortalApi.playgroundChat(data),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['userPortalWallet'] })
            queryClient.invalidateQueries({ queryKey: ['userPortalModelLogs'] })
        },
    })
}

export const useUserPortalCreateKey = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: UserPortalCreateKeyRequest) => userPortalApi.createKey(data),
        onSuccess: () => {
            invalidatePortalQueries(queryClient)
            toast.success('Key 创建成功')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '创建 Key 失败'
            toast.error(message)
        },
    })
}

export const useUserPortalDeleteKey = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => userPortalApi.deleteKey(id),
        onSuccess: () => {
            invalidatePortalQueries(queryClient)
            toast.success('Key 已删除')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '删除 Key 失败'
            toast.error(message)
        },
    })
}

export const useUserPortalUpdateKey = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: number, data: UserPortalUpdateKeyRequest }) => userPortalApi.updateKey(id, data),
        onSuccess: () => {
            invalidatePortalQueries(queryClient)
            toast.success('Key 分组已更新')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : '更新 Key 分组失败'
            toast.error(message)
        },
    })
}
