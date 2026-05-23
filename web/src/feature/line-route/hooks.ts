import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { lineRouteApi } from '@/api/line-route'
import type { SaveLineRouteRequest } from '@/types/line-route'

const invalidateLineRouteQueries = (
    queryClient: ReturnType<typeof useQueryClient>,
) => {
    queryClient.invalidateQueries({ queryKey: ['lineRoutes'] })
    queryClient.invalidateQueries({ queryKey: ['userPortalLineRoutes'] })
}

export const useLineRoutes = (
    page: number,
    perPage: number,
    keyword?: string,
) => {
    return useQuery({
        queryKey: ['lineRoutes', page, perPage, keyword],
        queryFn: () => lineRouteApi.getLineRoutes(page, perPage, keyword),
    })
}

export const useCreateLineRoute = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: (data: SaveLineRouteRequest) => lineRouteApi.createLineRoute(data),
        onSuccess: () => {
            invalidateLineRouteQueries(queryClient)
            setError(null)
            toast.success('线路已创建')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '创建线路失败')
        },
    })

    return {
        createLineRoute: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useUpdateLineRoute = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: SaveLineRouteRequest }) =>
            lineRouteApi.updateLineRoute(id, data),
        onSuccess: () => {
            invalidateLineRouteQueries(queryClient)
            setError(null)
            toast.success('线路已更新')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '更新线路失败')
        },
    })

    return {
        updateLineRoute: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}

export const useDeleteLineRoute = () => {
    const queryClient = useQueryClient()
    const [error, setError] = useState<ApiError | null>(null)

    const mutation = useMutation({
        mutationFn: (id: number) => lineRouteApi.deleteLineRoute(id),
        onSuccess: () => {
            invalidateLineRouteQueries(queryClient)
            setError(null)
            toast.success('线路已删除')
        },
        onError: (err: ApiError) => {
            setError(err)
            toast.error(err.message || '删除线路失败')
        },
    })

    return {
        deleteLineRoute: mutation.mutate,
        isLoading: mutation.isPending,
        error,
        clearError: () => setError(null),
    }
}
