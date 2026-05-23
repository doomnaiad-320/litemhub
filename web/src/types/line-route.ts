export interface LineRoute {
    id: number
    api_url: string
    description: string
    note?: string
    created_at: number
    updated_at: number
}

export interface LineRoutesResponse {
    line_routes: LineRoute[]
    total: number
}

export interface LineRouteDetailResponse {
    line_route: LineRoute
}

export interface SaveLineRouteRequest {
    api_url: string
    description: string
    note?: string
}
