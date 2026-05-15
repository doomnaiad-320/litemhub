export const ANNOUNCEMENT_STATUS = {
    DRAFT: 1,
    PUBLISHED: 2,
} as const

export const ANNOUNCEMENT_CATEGORIES = [
    'API 更新',
    'AI 更新',
    '系统公告',
    '计费与价格',
    '维护通知',
] as const

export type AnnouncementStatus = typeof ANNOUNCEMENT_STATUS[keyof typeof ANNOUNCEMENT_STATUS]
export type AnnouncementCategory = typeof ANNOUNCEMENT_CATEGORIES[number]

export interface Announcement {
    id: number
    title: string
    slug?: string
    summary?: string
    content: string
    category?: string
    version?: string
    status: AnnouncementStatus
    published_at?: number
    created_at: number
    updated_at: number
}

export interface AnnouncementsResponse {
    announcements: Announcement[]
    total: number
}

export interface AnnouncementCategoriesResponse {
    categories: string[]
}

export interface AnnouncementDetailResponse {
    announcement: Announcement
}

export interface SaveAnnouncementRequest {
    title: string
    slug?: string
    summary?: string
    content: string
    category?: string
    version?: string
    status: AnnouncementStatus
    published_at?: number
}

export interface UpdateAnnouncementStatusRequest {
    status: AnnouncementStatus
    published_at?: number
}
