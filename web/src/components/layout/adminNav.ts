import type React from 'react'
import {
    Bot,
    Layers,
    BarChart2,
    Database,
    Calendar,
    Bell,
    MessageCircle,
    ReceiptText,
    Route,
    Trophy,
    User,
    Users,
} from 'lucide-react'
import { ROUTES } from '@/routes/constants'

// sidebar.* 翻译命名空间下的有效子键
export type AdminNavKey =
    | 'monitor'
    | 'channel'
    | 'model'
    | 'log'
    | 'group'
    | 'appUsers'
    | 'billing'
    | 'announcements'
    | 'lineSettings'
    | 'consumptionRanking'
    | 'key'
    | 'mcp'

export interface AdminNavItem {
    /** i18n key 位于 sidebar.* 下 */
    key: AdminNavKey
    icon: React.ComponentType<{ className?: string }>
    href: string
}

// 后台全部导航项（移动端汉堡抽屉与顶栏标题共用此单一来源）
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    { key: 'monitor', icon: BarChart2, href: ROUTES.MONITOR },
    { key: 'channel', icon: Database, href: ROUTES.CHANNEL },
    { key: 'model', icon: Layers, href: ROUTES.MODEL },
    { key: 'log', icon: Calendar, href: ROUTES.LOG },
    { key: 'group', icon: Users, href: ROUTES.GROUP },
    { key: 'appUsers', icon: User, href: ROUTES.APP_USERS },
    { key: 'billing', icon: ReceiptText, href: ROUTES.BILLING },
    { key: 'announcements', icon: Bell, href: ROUTES.ANNOUNCEMENTS },
    { key: 'lineSettings', icon: Route, href: ROUTES.LINE_SETTINGS },
    { key: 'consumptionRanking', icon: Trophy, href: ROUTES.CONSUMPTION_RANKING },
    { key: 'key', icon: Bot, href: ROUTES.KEY },
    { key: 'mcp', icon: MessageCircle, href: ROUTES.MCP },
]

// 底部 TabBar 的主入口顺序：渠道 / 日志 / 用户 / 仪表盘
export const ADMIN_PRIMARY_TAB_HREFS: string[] = [
    ROUTES.CHANNEL,
    ROUTES.LOG,
    ROUTES.APP_USERS,
    ROUTES.MONITOR,
]

export const ADMIN_PRIMARY_TABS: AdminNavItem[] = ADMIN_PRIMARY_TAB_HREFS
    .map((href) => ADMIN_NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is AdminNavItem => Boolean(item))
