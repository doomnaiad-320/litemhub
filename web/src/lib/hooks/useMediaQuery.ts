import { useEffect, useState } from 'react'

/**
 * 订阅一个 CSS media query，返回当前是否匹配。
 * SSR/无 window 环境下安全返回 false。
 */
export function useMediaQuery(query: string): boolean {
    const getMatches = () => {
        if (typeof window === 'undefined') {
            return false
        }

        return window.matchMedia(query).matches
    }

    const [matches, setMatches] = useState(getMatches)

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const mediaQuery = window.matchMedia(query)
        const handleChange = () => setMatches(mediaQuery.matches)

        handleChange()
        mediaQuery.addEventListener('change', handleChange)

        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [query])

    return matches
}

// 与 Tailwind lg 断点(1024px)保持一致：>=1024 视为桌面，否则为 H5。
export const DESKTOP_QUERY = '(min-width: 1024px)'

/** 是否为桌面宽度(>=1024px)。低于该宽度即进入 H5 移动布局。 */
export function useIsDesktop(): boolean {
    return useMediaQuery(DESKTOP_QUERY)
}
