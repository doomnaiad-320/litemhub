export const BASE_PATH = '/' as const

export const ROUTES = {
    MONITOR: "/monitor",
    GROUP: "/group",
    CONSUMPTION_RANKING: "/consumption-ranking",
    LEGACY_GROUP_RANKING: "/group-ranking",
    ADMIN_LOGIN: "/litemhub",
    APP_USERS: "/app-users",
    BILLING: "/billing",
    USER_LOGIN: "/login",
    USER_REGISTER: "/register",
    USER_DASHBOARD: "/dashboard",
    USER_MODELS: "/dashboard/models",
    USER_GROUPS: "/dashboard/groups",
    USER_KEYS: "/dashboard/keys",
    USER_LOGS: "/dashboard/logs",
    PUBLIC_MODELS: "/models",
    PUBLIC_MODEL_DETAIL: "/models/*",
    PUBLIC_API_DOCS: "/swagger/index.html",
    PUBLIC_API_UPDATES: "https://github.com/labring/aiproxy/releases",
    PUBLIC_BLOG: "/blog",
    PUBLIC_GITHUB: "https://github.com/labring/aiproxy",
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
