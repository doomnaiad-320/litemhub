import { useState } from "react"
import { Outlet } from "react-router"
import { Sidebar } from "./SideBar"
import { MobileTopBar } from "./MobileTopBar"
import { MobileTabBar } from "./MobileTabBar"
import { MobileNavDrawer } from "./MobileNavDrawer"
import { cn } from "@/lib/utils"

export function RootLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* 桌面侧栏：lg 及以上显示 */}
      <div className="hidden lg:flex">
        <Sidebar
          displayConfig={{
            monitor: true,
            key: true,
            channel: true,
            model: true,
            log: true,
            doc: true,
            github: true,
          }}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </div>

      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300")}>
        {/* H5 顶栏：lg 以下显示 */}
        <MobileTopBar className="lg:hidden" onMenu={() => setMobileNavOpen(true)} />

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>

        {/* H5 底部 TabBar：lg 以下显示 */}
        <MobileTabBar
          className="lg:hidden"
          onMore={() => setMobileNavOpen(true)}
          moreActive={mobileNavOpen}
        />
      </main>

      {/* H5 全量导航抽屉 */}
      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </div>
  )
}
