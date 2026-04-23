import type { Token } from './token'
import type { LogRecord } from './log'
import type { ModelPrice } from './model'

export interface UserPortalUser {
    id: number
    email?: string
    phone?: string
    status: number
    created_at: number
    updated_at: number
}

export interface UserPortalAuthResponse {
    token: string
    expires_at: number
    user: UserPortalUser
}

export interface UserPortalWallet {
    user_id: number
    available_balance: number
    frozen_balance: number
    historical_consumed: number
    created_at: number
    updated_at: number
}

export interface UserPortalWalletResponse {
    wallet: UserPortalWallet
}

export interface UserPortalWalletLog {
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

export interface UserPortalWalletLogsResponse {
    wallet_logs: UserPortalWalletLog[]
    total: number
}

export interface UserPortalModelLogsResponse {
    logs: LogRecord[]
    total: number
}

export interface UserPortalGroupModelOption {
    model: string
    price?: ModelPrice
    image_prices?: Record<string, number>
    image_quality_prices?: Record<string, Record<string, number>>
}

export interface UserPortalGroupOption {
    group: string
    price_multiplier: number
    available_sets: string[]
    models: string[]
    model_details?: UserPortalGroupModelOption[]
}

export interface UserPortalGroupsResponse {
    groups: UserPortalGroupOption[]
}

export interface UserPortalKeysResponse {
    keys: Token[]
    total: number
}

export interface UserPortalRegisterRequest {
    email?: string
    phone?: string
    password: string
}

export interface UserPortalLoginRequest {
    email?: string
    phone?: string
    password: string
}

export interface UserPortalCreateKeyRequest {
    group: string
    name: string
    subnets?: string[]
    models?: string[]
}

export interface UserPortalUpdateKeyRequest {
    group: string
}
