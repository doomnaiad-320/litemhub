import { type RouteObject } from "react-router"
import { Navigate } from "react-router"
import { Suspense, lazy } from "react"
import { ROUTES } from "./constants"
import { ProtectedRoute } from "@/feature/auth/components/ProtectedRoute"

//page
import ModelPage from "@/pages/model/page"
import ChannelPage from "@/pages/channel/page"
import TokenPage from "@/pages/token/page"
import MonitorPage from "@/pages/monitor/page"
import LogPage from "@/pages/log/page"
import MCPPage from "@/pages/mcp/page"
import GroupPage from "@/pages/group/page"
import ConsumptionRankingPage from "@/pages/consumption-ranking/page"
import AppUserPage from "@/pages/app-user/page"
import UserPortalLandingPage from "@/pages/user-portal/landing"
import UserPortalDashboardPage from "@/pages/user-portal/dashboard"
import UserPortalGroupsPage from "@/pages/user-portal/groups"
import UserPortalKeysPage from "@/pages/user-portal/keys"
import UserPortalLogsPage from "@/pages/user-portal/logs"
import { UserPortalProtectedRoute } from "@/feature/user-portal/components/UserPortalProtectedRoute"
import { UserPortalLayout } from "@/components/layout/UserPortalLayout"

// import layout component directly
import { RootLayout } from "@/components/layout/RootLayOut"
import { LoadingFallback } from "@/components/common/LoadingFallBack"

// lazy load login page
const LoginPage = lazy(() => import("@/pages/auth/login"))
const UserPortalLoginPage = lazy(() => import("@/pages/user-portal/login"))
const UserPortalRegisterPage = lazy(() => import("@/pages/user-portal/register"))

// lazy load component wrapper
const lazyLoad = (Component: React.ComponentType) => (
    <Suspense fallback={<LoadingFallback />}>
        <Component />
    </Suspense>
)



// routes config
export function useRoutes(): RouteObject[] {

    // auth routes
    const authRoutes: RouteObject[] = [
        { path: "/", element: <UserPortalLandingPage /> },
        { path: ROUTES.ADMIN_LOGIN, element: lazyLoad(LoginPage) },
        { path: ROUTES.USER_LOGIN, element: lazyLoad(UserPortalLoginPage) },
        { path: ROUTES.USER_REGISTER, element: lazyLoad(UserPortalRegisterPage) },
    ]

    // app routes
    const appRoutes: RouteObject = {
        element: <ProtectedRoute />,
        children: [{
            element: <RootLayout />,
            children: [
                {
                    path: ROUTES.MONITOR,
                    element: <MonitorPage />,
                },
                {
                    path: ROUTES.GROUP,
                    element: <GroupPage />,
                },
                {
                    path: ROUTES.CONSUMPTION_RANKING,
                    element: <ConsumptionRankingPage />,
                },
                {
                    path: ROUTES.APP_USERS,
                    element: <AppUserPage />,
                },
                {
                    path: ROUTES.LEGACY_GROUP_RANKING,
                    element: <Navigate to={ROUTES.CONSUMPTION_RANKING} replace />,
                },
                {
                    path: ROUTES.KEY,
                    element: <TokenPage />,
                },
                {
                    path: ROUTES.CHANNEL,
                    element: <ChannelPage />,
                },
                {
                    path: ROUTES.MODEL,
                    element: <ModelPage />,
                },
                {
                    path: ROUTES.LOG,
                    element: <LogPage />,
                },
                {
                    path: ROUTES.MCP,
                    element: <MCPPage />,
                }
            ]
        }]
    }

    const portalRoutes: RouteObject = {
        element: <UserPortalProtectedRoute />,
        children: [{
            element: <UserPortalLayout />,
            children: [
                {
                    path: ROUTES.USER_DASHBOARD,
                    element: <UserPortalDashboardPage />,
                },
                {
                    path: ROUTES.USER_GROUPS,
                    element: <UserPortalGroupsPage />,
                },
                {
                    path: ROUTES.USER_KEYS,
                    element: <UserPortalKeysPage />,
                },
                {
                    path: ROUTES.USER_LOGS,
                    element: <UserPortalLogsPage />,
                },
            ],
        }],
    }

    return [...authRoutes, appRoutes, portalRoutes]
}
