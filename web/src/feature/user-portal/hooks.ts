import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import type {
    UserPortalCreateKeyRequest,
    UserPortalLoginRequest,
    UserPortalRegisterRequest,
} from '@/types/user-portal'
import { userPortalApi } from '@/api/user-portal'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'

const invalidatePortalQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
    queryClient.invalidateQueries({ queryKey: ['userPortalMe'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalWallet'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalWalletLogs'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalGroups'] })
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

export const useUserPortalLogin = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const login = useUserPortalAuthStore((state) => state.login)

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

    return useMutation({
        mutationFn: (data: UserPortalLoginRequest) => userPortalApi.login(data),
        onSuccess: (response) => {
            login({
                token: response.token,
                expiresAt: response.expires_at,
                user: response.user,
            })
            toast.success('登录成功')
            navigate(from, { replace: true })
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

export const useUserPortalGroups = (enabled = true) => {
    return useQuery({
        queryKey: ['userPortalGroups'],
        queryFn: () => userPortalApi.getGroups(),
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
