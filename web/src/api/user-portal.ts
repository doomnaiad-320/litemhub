import axios, { AxiosError, AxiosResponse } from 'axios'
import { ENV } from '@/utils/env'
import { ApiError, type APIResponse } from './index'
import type {
    UserPortalAuthResponse,
    UserPortalCreateKeyRequest,
    UserPortalGroupsResponse,
    UserPortalKeysResponse,
    UserPortalLoginRequest,
    UserPortalRegisterRequest,
    UserPortalUpdateKeyRequest,
    UserPortalUser,
    UserPortalWalletLogsResponse,
    UserPortalWalletResponse,
} from '@/types/user-portal'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'

const USER_API_BASE_URL = '/user-api'
const USER_API_TIMEOUT = Number(ENV.API_TIMEOUT || 10000)

const userApiClient = axios.create({
    baseURL: USER_API_BASE_URL,
    timeout: USER_API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
})

userApiClient.interceptors.request.use(
    (config) => {
        const token = useUserPortalAuthStore.getState().token

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`
        }

        return config
    },
    (error) => Promise.reject(error),
)

userApiClient.interceptors.response.use(
    (response) => {
        const data = response.data as APIResponse
        if (data && data.success === false) {
            throw new ApiError(data.message || 'Request failed', response.status)
        }

        return response
    },
    (error: AxiosError<APIResponse>) => {
        const status = error.response?.status
        const errorData = error.response?.data

        if (status === 401) {
            useUserPortalAuthStore.getState().logout()
        }

        if (errorData) {
            throw new ApiError(errorData.message || 'Request failed', status || 500)
        }

        throw new ApiError(error.message || 'Network request failed', status || 500)
    },
)

const get = async <T>(url: string, params?: Record<string, string | number>) => {
    const response: AxiosResponse<APIResponse<T>> = await userApiClient.get(url, { params })
    return response.data.data as T
}

const post = async <T>(url: string, data?: unknown) => {
    const response: AxiosResponse<APIResponse<T>> = await userApiClient.post(url, data)
    return response.data.data as T
}

const put = async <T>(url: string, data?: unknown) => {
    const response: AxiosResponse<APIResponse<T>> = await userApiClient.put(url, data)
    return response.data.data as T
}

const del = async <T>(url: string) => {
    const response: AxiosResponse<APIResponse<T>> = await userApiClient.delete(url)
    return response.data.data as T
}

export const userPortalApi = {
    register: async (data: UserPortalRegisterRequest) => {
        return post<{ user: UserPortalUser }>('auth/register', data)
    },

    login: async (data: UserPortalLoginRequest) => {
        return post<UserPortalAuthResponse>('auth/login', data)
    },

    me: async () => {
        return get<{ user: UserPortalUser }>('auth/me')
    },

    getWallet: async () => {
        return get<UserPortalWalletResponse>('wallet')
    },

    getWalletLogs: async (page: number, perPage: number) => {
        return get<UserPortalWalletLogsResponse>('wallet/logs', {
            p: page,
            per_page: perPage,
        })
    },

    getGroups: async () => {
        return get<UserPortalGroupsResponse>('groups')
    },

    getKeys: async (page: number, perPage: number, group?: string) => {
        const params: Record<string, string | number> = {
            p: page,
            per_page: perPage,
        }
        if (group) {
            params.group = group
        }

        return get<UserPortalKeysResponse>('keys', params)
    },

    createKey: async (data: UserPortalCreateKeyRequest) => {
        return post('keys', data)
    },

    updateKey: async (id: number, data: UserPortalUpdateKeyRequest) => {
        return put(`keys/${id}`, data)
    },

    deleteKey: async (id: number) => {
        return del(`keys/${id}`)
    },
}
