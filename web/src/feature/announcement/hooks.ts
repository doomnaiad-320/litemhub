import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { announcementApi } from '@/api/announcement'
import type {
    SaveAnnouncementRequest,
    UpdateAnnouncementStatusRequest,
} from '@/types/announcement'

const invalidateAnnouncementQueries = (
    queryClient: ReturnType<typeof useQueryClient>,
    announcementId?: number,
) => {
    queryClient.invalidateQueries({ queryKey: ['announcements'] })
    queryClient.invalidateQueries({ queryKey: ['announcementCategories'] })
    queryClient.invalidateQueries({ queryKey: ['publicAnnouncements'] })
    if (announcementId) {
        queryClient.invalidateQueries({ queryKey: ['announcement', announcementId] })
    }
}

export const useAnnouncements = (
    page: number,
    perPage: number,
    keyword?: string,
    status?: number,
    category?: string,
) => {
    return useQuery({
        queryKey: ['announcements', page, perPage, keyword, status, category],
        queryFn: () => announcementApi.getAnnouncements(page, perPage, keyword, status, category),
    })
}

export const useAnnouncementCategories = () => {
    return useQuery({
        queryKey: ['announcementCategories'],
        queryFn: () => announcementApi.getAnnouncementCategories(),
    })
}

export const useCreateAnnouncement = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: (data: SaveAnnouncementRequest) => announcementApi.createAnnouncement(data),
        onSuccess: () => {
            invalidateAnnouncementQueries(queryClient)
            setError(null)
            toast.success('公告已创建')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '创建公告失败')
        },
    })

    return {
        createAnnouncement: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useUpdateAnnouncement = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: SaveAnnouncementRequest }) =>
            announcementApi.updateAnnouncement(id, data),
        onSuccess: (_, variables) => {
            invalidateAnnouncementQueries(queryClient, variables.id)
            setError(null)
            toast.success('公告已更新')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '更新公告失败')
        },
    })

    return {
        updateAnnouncement: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useUpdateAnnouncementStatus = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateAnnouncementStatusRequest }) =>
            announcementApi.updateAnnouncementStatus(id, data),
        onSuccess: (_, variables) => {
            invalidateAnnouncementQueries(queryClient, variables.id)
            setError(null)
            toast.success('公告状态已更新')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '更新公告状态失败')
        },
    })

    return {
        updateAnnouncementStatus: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useDeleteAnnouncement = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: (id: number) => announcementApi.deleteAnnouncement(id),
        onSuccess: (_, id) => {
            invalidateAnnouncementQueries(queryClient, id)
            setError(null)
            toast.success('公告已删除')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '删除公告失败')
        },
    })

    return {
        deleteAnnouncement: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}
