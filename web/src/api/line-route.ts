import { del, get, post, put } from './index'
import type {
    LineRouteDetailResponse,
    LineRoutesResponse,
    SaveLineRouteRequest,
} from '@/types/line-route'

export const lineRouteApi = {
    getLineRoutes: async (
        page: number,
        perPage: number,
        keyword?: string,
    ): Promise<LineRoutesResponse> => {
        const params: Record<string, string | number> = {
            p: page,
            per_page: perPage,
        }

        if (keyword) {
            params.keyword = keyword
        }

        return get<LineRoutesResponse>('line_routes', { params })
    },

    createLineRoute: async (data: SaveLineRouteRequest): Promise<LineRouteDetailResponse> => {
        return post<LineRouteDetailResponse>('line_routes', data)
    },

    updateLineRoute: async (
        id: number,
        data: SaveLineRouteRequest,
    ): Promise<LineRouteDetailResponse> => {
        return put<LineRouteDetailResponse>(`line_routes/${id}`, data)
    },

    deleteLineRoute: async (id: number): Promise<void> => {
        await del(`line_routes/${id}`)
    },
}
