import { del, get, post, put } from './index'
import type {
    AppUserDetailResponse,
    AppUserWalletLogsResponse,
    AppUserWalletResponse,
    AppUsersResponse,
    CreateAppUserRequest,
    RechargeAppUserBalanceRequest,
    RechargeAppUserBalanceResponse,
    ResetAppUserPasswordRequest,
    UpdateAppUserRequest,
    UpdateAppUserStatusRequest,
} from '@/types/app-user'

export const appUserApi = {
    getAppUsers: async (
        page: number,
        perPage: number,
        keyword?: string,
        status?: number,
        order?: string,
    ): Promise<AppUsersResponse> => {
        const params: Record<string, string | number> = {
            p: page,
            per_page: perPage,
        }

        if (keyword) {
            params.keyword = keyword
        }
        if (status) {
            params.status = status
        }
        if (order) {
            params.order = order
        }

        return get<AppUsersResponse>('app_users/search', { params })
    },

    getAppUser: async (id: number): Promise<AppUserDetailResponse> => {
        return get<AppUserDetailResponse>(`app_users/${id}`)
    },

    createAppUser: async (data: CreateAppUserRequest): Promise<AppUserDetailResponse> => {
        return post<AppUserDetailResponse>('app_users', data)
    },

    updateAppUser: async (id: number, data: UpdateAppUserRequest): Promise<AppUserDetailResponse> => {
        return put<AppUserDetailResponse>(`app_users/${id}`, data)
    },

    deleteAppUser: async (id: number): Promise<void> => {
        await del(`app_users/${id}`)
    },

    updateAppUserStatus: async (id: number, data: UpdateAppUserStatusRequest): Promise<AppUserDetailResponse> => {
        return post<AppUserDetailResponse>(`app_users/${id}/status`, data)
    },

    resetAppUserPassword: async (id: number, data: ResetAppUserPasswordRequest): Promise<AppUserDetailResponse> => {
        return post<AppUserDetailResponse>(`app_users/${id}/password`, data)
    },

    getAppUserWallet: async (id: number): Promise<AppUserWalletResponse> => {
        return get<AppUserWalletResponse>(`app_users/${id}/wallet`)
    },

    getAppUserWalletLogs: async (
        id: number,
        page: number,
        perPage: number,
        order?: string,
    ): Promise<AppUserWalletLogsResponse> => {
        const params: Record<string, string | number> = {
            p: page,
            per_page: perPage,
        }
        if (order) {
            params.order = order
        }

        return get<AppUserWalletLogsResponse>(`app_users/${id}/wallet_logs`, { params })
    },

    rechargeAppUserBalance: async (
        id: number,
        data: RechargeAppUserBalanceRequest,
    ): Promise<RechargeAppUserBalanceResponse> => {
        return post<RechargeAppUserBalanceResponse>(`app_users/${id}/recharge`, data)
    },
}
