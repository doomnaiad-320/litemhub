import type { Token } from './token'
import type { LogRecord } from './log'
import type { ModelPrice } from './model'

export interface UserPortalUser {
    id: number
    email?: string
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

export interface UserPortalRechargeRequest {
    amount: number
    type?: string
    device?: string
}

export interface UserPortalPayment {
    order_id: number
    amount: number
    out_trade_no: string
    trade_no?: string
    pay_type: string
    pay_info: string
}

export interface UserPortalRechargeResponse {
    payment: UserPortalPayment
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
    description?: string
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
    email: string
    code: string
    password: string
}

export interface UserPortalLoginRequest {
    email: string
    password: string
}

export interface UserPortalEmailCodeRequest {
    email: string
}

export interface UserPortalEmailCodeResponse {
    expires_at: number
    cooldown_seconds: number
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

export interface UserPortalPlaygroundMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface UserPortalPlaygroundChatRequest {
    model: string
    messages: UserPortalPlaygroundMessage[]
    group?: string
    max_tokens?: number
    temperature?: number
}

export interface UserPortalPlaygroundChatChoice {
    index: number
    message?: UserPortalPlaygroundMessage
    finish_reason?: string
}

export interface UserPortalPlaygroundChatUsage {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
}

export interface UserPortalPlaygroundChatResponse {
    id?: string
    object?: string
    created?: number
    model?: string
    choices?: UserPortalPlaygroundChatChoice[]
    usage?: UserPortalPlaygroundChatUsage
}
