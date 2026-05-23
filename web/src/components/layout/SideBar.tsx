import type React from "react"

import { Link, useLocation, useNavigate } from "react-router"
import {
    Bot,
    Layers,
    BarChart2,
    Database,
    Calendar,
    Bell,
    ChevronLeft,
    ChevronRight,
    // FileText,
    // Github,
    LogOut,
    MessageCircle,
    ReceiptText,
    Route,
    Trophy,
    User,
    Users,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { ROUTES } from "@/routes/constants"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import useAuthStore from "@/store/auth"

interface SidebarItem {
    title: string
    icon: React.ComponentType<{ className?: string }>
    href: string
    display: boolean
    external?: boolean
}

function createSidebarConfig(t: TFunction): SidebarItem[] {
    return [
        {
            title: t("sidebar.monitor"),
            icon: BarChart2,
            href: ROUTES.MONITOR,
            display: true,
        },
        {
            title: t("sidebar.channel"),
            icon: Database,
            href: ROUTES.CHANNEL,
            display: true,
        },
        {
            title: t("sidebar.model"),
            icon: Layers,
            href: ROUTES.MODEL,
            display: true,
        },
        {
            title: t("sidebar.log"),
            icon: Calendar,
            href: ROUTES.LOG,
            display: true,
        },
        {
            title: t("sidebar.group"),
            icon: Users,
            href: ROUTES.GROUP,
            display: true,
        },
        {
            title: t("sidebar.appUsers"),
            icon: User,
            href: ROUTES.APP_USERS,
            display: true,
        },
        {
            title: t("sidebar.billing"),
            icon: ReceiptText,
            href: ROUTES.BILLING,
            display: true,
        },
        {
            title: t("sidebar.announcements"),
            icon: Bell,
            href: ROUTES.ANNOUNCEMENTS,
            display: true,
        },
        {
            title: t("sidebar.lineSettings"),
            icon: Route,
            href: ROUTES.LINE_SETTINGS,
            display: true,
        },
        {
            title: t("sidebar.consumptionRanking"),
            icon: Trophy,
            href: ROUTES.CONSUMPTION_RANKING,
            display: true,
        },
        {
            title: t("sidebar.key"),
            icon: Bot,
            href: ROUTES.KEY,
            display: true,
        },
        {
            title: t("sidebar.mcp"),
            icon: MessageCircle,
            href: ROUTES.MCP,
            display: true,
        },
        // {
        //     title: t("sidebar.doc"),
        //     icon: FileText,
        //     href: "https://sealos.run/docs/guides/ai-proxy",
        //     display: true,
        //     external: true,
        // },
        // {
        //     title: t("sidebar.github"),
        //     icon: Github,
        //     href: "https://github.com/labring/aiproxy",
        //     display: true,
        //     external: true,
        // },
    ]
}

interface SidebarDisplayConfig {
    monitor?: boolean
    group?: boolean
    appUsers?: boolean
    billing?: boolean
    announcements?: boolean
    lineSettings?: boolean
    consumptionRanking?: boolean
    key?: boolean
    channel?: boolean
    model?: boolean
    mcp?: boolean
    log?: boolean
    doc?: boolean
    github?: boolean
}

interface SidebarProps {
    displayConfig?: SidebarDisplayConfig
    collapsed?: boolean
    onToggle?: () => void
}

export function Sidebar({ displayConfig = {}, collapsed = false, onToggle }: SidebarProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const logout = useAuthStore((s) => s.logout)

    const currentFirstLevelPath = "/" + location.pathname.split("/")[1]

    const sidebarItems = createSidebarConfig(t).map((item) => {
        // Determine which config property based on path name
        let configKey: keyof SidebarDisplayConfig = "monitor"
        if (item.href === ROUTES.GROUP) configKey = "group"
        if (item.href === ROUTES.APP_USERS) configKey = "appUsers"
        if (item.href === ROUTES.ANNOUNCEMENTS) configKey = "announcements"
        if (item.href === ROUTES.LINE_SETTINGS) configKey = "lineSettings"
        if (item.href === ROUTES.CONSUMPTION_RANKING) configKey = "consumptionRanking"
        if (item.href === ROUTES.KEY) configKey = "key"
        if (item.href === ROUTES.CHANNEL) configKey = "channel"
        if (item.href === ROUTES.MODEL) configKey = "model"
        if (item.href === ROUTES.MCP) configKey = "mcp"
        if (item.href === ROUTES.LOG) configKey = "log"
        // if (item.href === "https://sealos.run/docs/guides/ai-proxy") configKey = "doc"
        // if (item.href === "https://github.com/labring/aiproxy") configKey = "github"

        const shouldDisplay = displayConfig[configKey] !== undefined ? displayConfig[configKey] : item.display

        return {
            ...item,
            display: shouldDisplay,
        }
    })

    const handleLogout = () => {
        logout()
        navigate(ROUTES.ADMIN_LOGIN)
    }

    return (
        <div
            className={cn(
                "h-full relative overflow-hidden flex flex-col transition-all duration-300 ease-in-out",
                "border-r border-border bg-background dark:bg-background",
                collapsed ? "w-20" : "w-64",
            )}
        >
            <div className="relative z-10 flex items-center justify-between border-b border-border px-6 py-5">
                <div
                    className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0",
                        collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                    )}
                >
                    <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">AI Proxy</h1>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className={cn(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                        collapsed ? "ml-auto mr-auto" : "ml-auto",
                    )}
                >
                    {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
            </div>

            <div className="flex-1 py-2 overflow-y-auto relative z-10">
                <TooltipProvider delayDuration={300}>
                    {sidebarItems
                        .filter((item) => item.display)
                        .map((item) => {
                            const isActive = !item.external && currentFirstLevelPath === item.href
                            const content = (
                                <>
                                    <div className="flex items-center justify-center w-5 h-5">
                                        <item.icon
                                            className={cn(
                                                "w-5 h-5 transition-colors",
                                                isActive ? "text-foreground" : "text-muted-foreground",
                                            )}
                                        />
                                    </div>

                                    <span
                                        className={cn(
                                            "ml-3 font-medium whitespace-nowrap transition-all duration-300 ease-in-out",
                                            isActive ? "text-foreground" : "text-muted-foreground",
                                            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto",
                                        )}
                                    >
                                        {item.title}
                                    </span>
                                </>
                            )

                            return (
                                <Tooltip key={item.href}>
                                    <TooltipTrigger asChild>
                                        {item.external ? (
                                            <a
                                                href={item.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "group flex items-center mx-2 my-1 rounded-md px-6 py-3 transition-colors",
                                                    "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                                                    collapsed ? "justify-center" : "",
                                                )}
                                            >
                                                {content}
                                            </a>
                                        ) : (
                                            <Link
                                                to={item.href}
                                                className={cn(
                                                    "group flex items-center mx-2 my-1 rounded-md px-6 py-3 transition-colors",
                                                    isActive
                                                        ? "bg-muted text-foreground"
                                                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                                                    collapsed ? "justify-center" : "",
                                                )}
                                            >
                                                {content}
                                            </Link>
                                        )}
                                    </TooltipTrigger>
                                    {collapsed && <TooltipContent side="right">{item.title}</TooltipContent>}
                                </Tooltip>
                            )
                        })}
                </TooltipProvider>
            </div>

            {/* Logout button */}
            <div className="relative z-10 border-t border-border p-4">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="secondary"
                            onClick={handleLogout}
                            className={cn(
                                "group flex w-full items-center rounded-md px-4 py-3 transition-colors",
                                "border border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                                collapsed ? "justify-center" : "justify-start",
                            )}
                        >
                            <div className="flex items-center justify-center w-5 h-5">
                                <LogOut className="h-5 w-5 transition-colors" />
                            </div>
                            <span
                                className={cn(
                                    "ml-3 font-medium whitespace-nowrap transition-all duration-300 ease-in-out",
                                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto",
                                )}
                            >
                                {t("sidebar.logout")}
                            </span>
                        </Button>
                    </TooltipTrigger>
                    {collapsed && <TooltipContent side="right">{t("sidebar.logout")}</TooltipContent>}
                </Tooltip>
            </div>
        </div>
    )
}
