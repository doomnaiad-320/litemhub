import axios, { AxiosError, AxiosResponse } from 'axios'
import { ENV } from '@/utils/env'
import { ApiError, type APIResponse } from './index'
import type { LogRequestDetail } from '@/types/log'
import type {
    UserPortalAuthResponse,
    UserPortalCreateKeyRequest,
    UserPortalDiscountCodeResponse,
    UserPortalEmailCodeRequest,
    UserPortalEmailCodeResponse,
    UserPortalGroupsResponse,
    UserPortalKeysResponse,
    UserPortalLoginRequest,
    UserPortalModelLogsResponse,
    UserPortalPlaygroundChatRequest,
    UserPortalPlaygroundChatResponse,
    UserPortalReferralRecordsResponse,
    UserPortalRechargeRequest,
    UserPortalRechargeLogsResponse,
    UserPortalRechargeResponse,
    UserPortalRegisterRequest,
    UserPortalUpdatePasswordRequest,
    UserPortalUpdateKeyRequest,
    UserPortalUser,
    UserPortalWalletLogsResponse,
    UserPortalWalletResponse,
} from '@/types/user-portal'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'

const USER_API_BASE_URL = '/user-api'
const USER_API_TIMEOUT = Number(ENV.API_TIMEOUT || 10000)
const USER_PLAYGROUND_TIMEOUT = Math.max(USER_API_TIMEOUT, 60000)

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
            const relayMessage = (errorData as unknown as { error?: { message?: string } }).error?.message
            throw new ApiError(errorData.message || relayMessage || 'Request failed', status || 500)
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

const postRaw = async <T>(url: string, data?: unknown, headers?: Record<string, string>) => {
    const response: AxiosResponse<T> = await userApiClient.post(url, data, {
        headers,
        timeout: USER_PLAYGROUND_TIMEOUT,
    })
    return response.data
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
    sendRegisterEmailCode: async (data: UserPortalEmailCodeRequest) => {
        return post<UserPortalEmailCodeResponse>('auth/email-code', data)
    },

    register: async (data: UserPortalRegisterRequest) => {
        return post<{ user: UserPortalUser }>('auth/register', data)
    },

    login: async (data: UserPortalLoginRequest) => {
        return post<UserPortalAuthResponse>('auth/login', data)
    },

    me: async () => {
        return get<{ user: UserPortalUser }>('auth/me')
    },

    updatePassword: async (data: UserPortalUpdatePasswordRequest) => {
        return put<{ user: UserPortalUser }>('auth/password', data)
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

    getRechargeLogs: async (page: number, perPage: number) => {
        return get<UserPortalRechargeLogsResponse>('wallet/recharge/logs', {
            p: page,
            per_page: perPage,
        })
    },

    getReferralRecords: async (page: number, perPage: number) => {
        return get<UserPortalReferralRecordsResponse>('wallet/referrals', {
            p: page,
            per_page: perPage,
        })
    },

    getDiscountCode: async () => {
        return get<UserPortalDiscountCodeResponse>('wallet/discount-code')
    },

    generateDiscountCode: async () => {
        return post<UserPortalDiscountCodeResponse>('wallet/discount-code')
    },

    createDuluPayRecharge: async (data: UserPortalRechargeRequest) => {
        return post<UserPortalRechargeResponse>('wallet/recharge/dulupay', data)
    },

    getModelLogs: async (page: number, perPage: number) => {
        return get<UserPortalModelLogsResponse>('logs', {
            p: page,
            per_page: perPage,
        })
    },

    getModelLogDetail: async (logId: number) => {
        return get<LogRequestDetail>(`logs/detail/${logId}`)
    },

    playgroundChat: async (data: UserPortalPlaygroundChatRequest) => {
        const { group, ...body } = data
        return postRaw<UserPortalPlaygroundChatResponse>(
            'playground/chat',
            {
                ...body,
                stream: false,
            },
            group ? { 'X-Playground-Group': group } : undefined,
        )
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
