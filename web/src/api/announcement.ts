import { del, get, post, put } from './index'
import type {
    AnnouncementDetailResponse,
    AnnouncementsResponse,
    SaveAnnouncementRequest,
    UpdateAnnouncementStatusRequest,
} from '@/types/announcement'

export const announcementApi = {
    getAnnouncements: async (
        page: number,
        perPage: number,
        keyword?: string,
        status?: number,
    ): Promise<AnnouncementsResponse> => {
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

        return get<AnnouncementsResponse>('announcements', { params })
    },

    getAnnouncement: async (id: number): Promise<AnnouncementDetailResponse> => {
        return get<AnnouncementDetailResponse>(`announcements/${id}`)
    },

    createAnnouncement: async (data: SaveAnnouncementRequest): Promise<AnnouncementDetailResponse> => {
        return post<AnnouncementDetailResponse>('announcements', data)
    },

    updateAnnouncement: async (
        id: number,
        data: SaveAnnouncementRequest,
    ): Promise<AnnouncementDetailResponse> => {
        return put<AnnouncementDetailResponse>(`announcements/${id}`, data)
    },

    updateAnnouncementStatus: async (
        id: number,
        data: UpdateAnnouncementStatusRequest,
    ): Promise<AnnouncementDetailResponse> => {
        return post<AnnouncementDetailResponse>(`announcements/${id}/status`, data)
    },

    deleteAnnouncement: async (id: number): Promise<void> => {
        await del(`announcements/${id}`)
    },
}
