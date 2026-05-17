import { type RouteObject } from "react-router"
import { Navigate } from "react-router"
import { Suspense, lazy } from "react"
import { ROUTES } from "./constants"
import { LoadingFallback } from "@/components/common/LoadingFallBack"

const ProtectedRoute = lazy(() =>
    import("@/feature/auth/components/ProtectedRoute").then((module) => ({
        default: module.ProtectedRoute,
    })),
)
const UserPortalProtectedRoute = lazy(() =>
    import("@/feature/user-portal/components/UserPortalProtectedRoute").then((module) => ({
        default: module.UserPortalProtectedRoute,
    })),
)
const RootLayout = lazy(() =>
    import("@/components/layout/RootLayOut").then((module) => ({
        default: module.RootLayout,
    })),
)
const UserPortalLayout = lazy(() =>
    import("@/components/layout/UserPortalLayout").then((module) => ({
        default: module.UserPortalLayout,
    })),
)
const UserPortalLandingPage = lazy(() => import("@/pages/user-portal/landing"))
const PublicModelsPage = lazy(() => import("@/pages/public-models/page"))
const PublicModelDetailPage = lazy(() => import("@/pages/public-models/detail"))
const PublicUpdatesPage = lazy(() => import("@/pages/public-updates/page"))
const PublicAgreementPage = lazy(() => import("@/pages/public-agreements/page"))
const LoginPage = lazy(() => import("@/pages/auth/login"))
const UserPortalLoginPage = lazy(() => import("@/pages/user-portal/login"))
const UserPortalRegisterPage = lazy(() => import("@/pages/user-portal/register"))
const MonitorPage = lazy(() => import("@/pages/monitor/page"))
const GroupPage = lazy(() => import("@/pages/group/page"))
const ConsumptionRankingPage = lazy(() => import("@/pages/consumption-ranking/page"))
const AppUserPage = lazy(() => import("@/pages/app-user/page"))
const BillingPage = lazy(() => import("@/pages/billing/page"))
const AnnouncementPage = lazy(() => import("@/pages/announcement/page"))
const TokenPage = lazy(() => import("@/pages/token/page"))
const ChannelPage = lazy(() => import("@/pages/channel/page"))
const ModelPage = lazy(() => import("@/pages/model/page"))
const LogPage = lazy(() => import("@/pages/log/page"))
const MCPPage = lazy(() => import("@/pages/mcp/page"))
const UserPortalDashboardPage = lazy(() => import("@/pages/user-portal/dashboard"))
// const UserPortalModelsPage = lazy(() => import("@/pages/user-portal/models"))
const UserPortalGroupsPage = lazy(() => import("@/pages/user-portal/groups"))
const UserPortalKeysPage = lazy(() => import("@/pages/user-portal/keys"))
const UserPortalLogsPage = lazy(() => import("@/pages/user-portal/logs"))

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
        { path: "/", element: lazyLoad(UserPortalLandingPage) },
        { path: ROUTES.PUBLIC_MODELS, element: lazyLoad(PublicModelsPage) },
        { path: ROUTES.PUBLIC_MODEL_DETAIL, element: lazyLoad(PublicModelDetailPage) },
        { path: ROUTES.PUBLIC_API_UPDATES, element: lazyLoad(PublicUpdatesPage) },
        { path: ROUTES.PUBLIC_TERMS, element: lazyLoad(PublicAgreementPage) },
        { path: ROUTES.PUBLIC_PRIVACY, element: lazyLoad(PublicAgreementPage) },
        { path: ROUTES.ADMIN_LOGIN, element: lazyLoad(LoginPage) },
        { path: ROUTES.USER_LOGIN, element: lazyLoad(UserPortalLoginPage) },
        { path: ROUTES.USER_REGISTER, element: lazyLoad(UserPortalRegisterPage) },
    ]

    // app routes
    const appRoutes: RouteObject = {
        element: lazyLoad(ProtectedRoute),
        children: [{
            element: lazyLoad(RootLayout),
            children: [
                {
                    path: ROUTES.MONITOR,
                    element: lazyLoad(MonitorPage),
                },
                {
                    path: ROUTES.GROUP,
                    element: lazyLoad(GroupPage),
                },
                {
                    path: ROUTES.CONSUMPTION_RANKING,
                    element: lazyLoad(ConsumptionRankingPage),
                },
                {
                    path: ROUTES.APP_USERS,
                    element: lazyLoad(AppUserPage),
                },
                {
                    path: ROUTES.BILLING,
                    element: lazyLoad(BillingPage),
                },
                {
                    path: ROUTES.ANNOUNCEMENTS,
                    element: lazyLoad(AnnouncementPage),
                },
                {
                    path: ROUTES.LEGACY_GROUP_RANKING,
                    element: <Navigate to={ROUTES.CONSUMPTION_RANKING} replace />,
                },
                {
                    path: ROUTES.KEY,
                    element: lazyLoad(TokenPage),
                },
                {
                    path: ROUTES.CHANNEL,
                    element: lazyLoad(ChannelPage),
                },
                {
                    path: ROUTES.MODEL,
                    element: lazyLoad(ModelPage),
                },
                {
                    path: ROUTES.LOG,
                    element: lazyLoad(LogPage),
                },
                {
                    path: ROUTES.MCP,
                    element: lazyLoad(MCPPage),
                }
            ]
        }]
    }

    const portalRoutes: RouteObject = {
        element: lazyLoad(UserPortalProtectedRoute),
        children: [{
            element: lazyLoad(UserPortalLayout),
            children: [
                {
                    path: ROUTES.USER_DASHBOARD,
                    element: lazyLoad(UserPortalDashboardPage),
                },
                // {
                //     path: ROUTES.USER_MODELS,
                //     element: lazyLoad(UserPortalModelsPage),
                // },
                {
                    path: ROUTES.USER_GROUPS,
                    element: lazyLoad(UserPortalGroupsPage),
                },
                {
                    path: ROUTES.USER_KEYS,
                    element: lazyLoad(UserPortalKeysPage),
                },
                {
                    path: ROUTES.USER_LOGS,
                    element: lazyLoad(UserPortalLogsPage),
                },
            ],
        }],
    }

    return [...authRoutes, appRoutes, portalRoutes]
}
