export const APP_USER_STATUS = {
    ENABLED: 1,
    DISABLED: 2,
} as const

export type AppUserStatus = typeof APP_USER_STATUS[keyof typeof APP_USER_STATUS]

export interface AppUser {
    id: number
    username?: string
    email?: string
    phone?: string
    status: AppUserStatus
    available_balance: number
    frozen_balance: number
    created_at: number
    updated_at: number
}

export interface AppUsersResponse {
    app_users: AppUser[]
    total: number
}

export interface AppUserDetailResponse {
    user: AppUser
}

export interface AppUserWallet {
    user_id: number
    available_balance: number
    frozen_balance: number
    created_at: number
    updated_at: number
}

export interface AppUserWalletResponse {
    wallet: AppUserWallet
}

export interface AppWalletLog {
    id: number
    type: string
    amount: number
    balance_before: number
    balance_after: number
    request_id?: string
    reservation_id?: number
    remark?: string
    created_at: number
}

export interface AppUserWalletLogsResponse {
    wallet_logs: AppWalletLog[]
    total: number
}

export interface CreateAppUserRequest {
    username?: string
    email?: string
    phone?: string
    password: string
    status?: AppUserStatus
}

export interface UpdateAppUserRequest {
    username?: string
    email?: string
    phone?: string
}

export interface UpdateAppUserStatusRequest {
    status: AppUserStatus
}

export interface ResetAppUserPasswordRequest {
    password: string
}

export interface AdjustAppUserWalletBalanceRequest {
    amount: number
    remark?: string
}

export interface UpdateAppUserGroupPriceMultiplierRequest {
    group: string
    price_multiplier_override: number | null
}

export interface AppUserGroupPriceMultiplier {
    group: string
    description?: string
    group_price_multiplier: number
    price_multiplier_override: number | null
}

export interface AppUserGroupPriceMultipliersResponse {
    groups: AppUserGroupPriceMultiplier[]
    total: number
}

export type AppRechargeStatus = 'success' | 'unpaid' | 'failed'

export interface AppRechargeLog {
    id: number
    user_id: number
    user_email?: string
    user_phone?: string
    amount: number
    channel?: string
    trade_no?: string
    status: AppRechargeStatus
    raw_payload?: string
    created_at: number
    updated_at: number
}

export interface AdjustAppUserWalletBalanceResponse {
    wallet: AppUserWallet
    wallet_log: AppWalletLog
}

export interface AppRechargeLogsResponse {
    recharge_logs: AppRechargeLog[]
    total: number
}

export interface AppRechargeStatsPoint {
    timestamp: number
    channel?: string
    amount: number
    count: number
}

export interface AppRechargeStats {
    granularity: string
    total_amount: number
    total_count: number
    paid_amount: number
    paid_count: number
    by_channel?: AppRechargeStatsPoint[]
    time_series: AppRechargeStatsPoint[]
}

export interface AppRechargeStatsResponse {
    stats: AppRechargeStats
}

export interface AppBillingSettings {
    recharge_discount: number
}

export interface AppBillingSettingsResponse {
    settings: AppBillingSettings
}

export interface UpdateAppBillingSettingsRequest {
    recharge_discount: number
}
