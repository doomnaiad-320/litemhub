import { useEffect, useState } from "react"
import { ThemeProviderContext, Theme } from "./ThemeContext"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => {
        const storedTheme = localStorage.getItem(storageKey) as Theme | null
        return storedTheme === "system" ? storedTheme : defaultTheme
    })

    useEffect(() => {
        const root = window.document.documentElement
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

        const applyTheme = () => {
            root.classList.remove("light", "dark")

            if (theme === "system") {
                root.classList.add(mediaQuery.matches ? "dark" : "light")
                return
            }

            root.classList.add(theme)
        }

        applyTheme()

        if (theme !== "system") {
            return
        }

        mediaQuery.addEventListener("change", applyTheme)
        return () => mediaQuery.removeEventListener("change", applyTheme)
    }, [theme])

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}
