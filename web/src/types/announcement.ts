export const ANNOUNCEMENT_STATUS = {
    DRAFT: 1,
    PUBLISHED: 2,
} as const

export type AnnouncementStatus = typeof ANNOUNCEMENT_STATUS[keyof typeof ANNOUNCEMENT_STATUS]

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
