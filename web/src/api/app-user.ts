import { del, get, post, put } from './index'
import type {
    AdjustAppUserWalletBalanceRequest,
    AdjustAppUserWalletBalanceResponse,
    AppBillingSettingsResponse,
    AppUserDetailResponse,
    AppRechargeLogsResponse,
    AppRechargeStatsResponse,
    AppUserGroupPriceMultipliersResponse,
    AppUserWalletLogsResponse,
    AppUserWalletResponse,
    AppUsersResponse,
    CreateAppUserRequest,
    ResetAppUserPasswordRequest,
    UpdateAppBillingSettingsRequest,
    UpdateAppUserGroupPriceMultiplierRequest,
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

    getAppRechargeLogs: async (
        page: number,
        perPage: number,
        startTimestamp?: number,
        endTimestamp?: number,
        keyword?: string,
        status?: string,
        channel?: string,
    ): Promise<AppRechargeLogsResponse> => {
        const params: Record<string, string | number> = {
            p: page,
            per_page: perPage,
        }
        if (startTimestamp) {
            params.start_timestamp = startTimestamp
        }
        if (endTimestamp) {
            params.end_timestamp = endTimestamp
        }
        if (keyword) {
            params.keyword = keyword
        }
        if (status) {
            params.status = status
        }
        if (channel) {
            params.channel = channel
        }

        return get<AppRechargeLogsResponse>('app_users/recharges', { params })
    },

    getAppRechargeStats: async (
        startTimestamp?: number,
        endTimestamp?: number,
        keyword?: string,
        granularity?: string,
    ): Promise<AppRechargeStatsResponse> => {
        const params: Record<string, string | number> = {}
        if (startTimestamp) {
            params.start_timestamp = startTimestamp
        }
        if (endTimestamp) {
            params.end_timestamp = endTimestamp
        }
        if (keyword) {
            params.keyword = keyword
        }
        if (granularity) {
            params.granularity = granularity
        }

        return get<AppRechargeStatsResponse>('app_users/recharge_stats', { params })
    },

    getAppBillingSettings: async (): Promise<AppBillingSettingsResponse> => {
        return get<AppBillingSettingsResponse>('app_users/billing_settings')
    },

    updateAppBillingSettings: async (
        data: UpdateAppBillingSettingsRequest,
    ): Promise<AppBillingSettingsResponse> => {
        return put<AppBillingSettingsResponse>('app_users/billing_settings', data)
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

    adjustAppUserWalletBalance: async (
        id: number,
        data: AdjustAppUserWalletBalanceRequest,
    ): Promise<AdjustAppUserWalletBalanceResponse> => {
        return post<AdjustAppUserWalletBalanceResponse>(`app_users/${id}/wallet/adjust`, data)
    },

    getAppUserGroupPriceMultipliers: async (
        id: number,
        page: number,
        perPage: number,
        keyword?: string,
    ): Promise<AppUserGroupPriceMultipliersResponse> => {
        const params: Record<string, string | number> = {
            p: page,
            per_page: perPage,
        }
        if (keyword) {
            params.keyword = keyword
        }

        return get<AppUserGroupPriceMultipliersResponse>(
            `app_users/${id}/group_price_multipliers`,
            { params },
        )
    },

    updateAppUserGroupPriceMultiplier: async (
        id: number,
        data: UpdateAppUserGroupPriceMultiplierRequest,
    ): Promise<void> => {
        await post(`app_users/${id}/group_price_multiplier`, data)
    },
}
