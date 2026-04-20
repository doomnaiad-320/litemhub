export const APP_USER_STATUS = {
    ENABLED: 1,
    DISABLED: 2,
} as const

export type AppUserStatus = typeof APP_USER_STATUS[keyof typeof APP_USER_STATUS]

export interface AppUser {
    id: number
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
    email?: string
    phone?: string
    password: string
    status?: AppUserStatus
}

export interface UpdateAppUserRequest {
    email?: string
    phone?: string
}

export interface UpdateAppUserStatusRequest {
    status: AppUserStatus
}

export interface ResetAppUserPasswordRequest {
    password: string
}

export interface RechargeAppUserBalanceRequest {
    amount: number
    channel?: string
    trade_no?: string
    remark?: string
    raw_payload?: string
}

export interface AppRechargeLog {
    id: number
    user_id: number
    amount: number
    channel?: string
    trade_no?: string
    status: string
    raw_payload?: string
    created_at: number
    updated_at: number
}

export interface RechargeAppUserBalanceResponse {
    wallet: AppUserWallet
    recharge_log?: AppRechargeLog
}
