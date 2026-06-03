import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/handler/ThemeContext"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
    className?: string
    showIcons?: boolean
}

export function ThemeToggle({ className, showIcons = true }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme()
    const [systemIsDark, setSystemIsDark] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        const updateSystemTheme = () => setSystemIsDark(mediaQuery.matches)

        updateSystemTheme()
        mediaQuery.addEventListener("change", updateSystemTheme)
        return () => mediaQuery.removeEventListener("change", updateSystemTheme)
    }, [])

    const isDark = theme === "dark" || (theme === "system" && systemIsDark)

    const toggleTheme = (checked: boolean) => {
        setTheme(checked ? "dark" : "light")
    }

    return (
        <div className={cn(
            "flex items-center space-x-2 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            className,
        )}>
            {showIcons && (
                <Sun
                    className={cn(
                        "h-[1.2rem] w-[1.2rem] transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                        isDark ? "scale-75 rotate-12 text-muted-foreground" : "scale-100 rotate-0 text-foreground",
                    )}
                />
            )}
            <Switch
                checked={isDark}
                onCheckedChange={toggleTheme}
                aria-label="Toggle theme"
                className="transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110"
            />
            {showIcons && (
                <Moon
                    className={cn(
                        "h-[1.2rem] w-[1.2rem] transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                        isDark ? "scale-100 rotate-0 text-foreground" : "scale-75 rotate-12 text-muted-foreground",
                    )}
                />
            )}
        </div>
    )
}
