export const BASE_PATH = '/' as const

export const ROUTES = {
    MONITOR: "/monitor",
    GROUP: "/group",
    CONSUMPTION_RANKING: "/consumption-ranking",
    LEGACY_GROUP_RANKING: "/group-ranking",
    ADMIN_LOGIN: "/litemhub",
    APP_USERS: "/app-users",
    USER_LOGIN: "/login",
    USER_REGISTER: "/register",
    USER_DASHBOARD: "/dashboard",
    USER_GROUPS: "/groups",
    USER_KEYS: "/keys",
    USER_LOGS: "/logs",
    KEY: "/key",
    CHANNEL: "/channel",
    MODEL: "/model",
    LOG: "/log",
    MCP: "/mcp-front",
} as const

export type RouteKey = keyof typeof ROUTES
export type RoutePath = typeof ROUTES[RouteKey]

// get route path by key
export const getRoute = (key: RouteKey): RoutePath => ROUTES[key] 
