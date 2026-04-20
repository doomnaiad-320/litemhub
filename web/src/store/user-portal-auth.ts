import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserPortalUser } from '@/types/user-portal'

interface UserPortalAuthState {
    token: string | null
    expiresAt: number | null
    user: UserPortalUser | null
    isAuthenticated: boolean
    login: (payload: { token: string; expiresAt: number; user: UserPortalUser }) => void
    setUser: (user: UserPortalUser | null) => void
    logout: () => void
}

export const useUserPortalAuthStore = create<UserPortalAuthState>()(
    persist(
        (set) => ({
            token: null,
            expiresAt: null,
            user: null,
            isAuthenticated: false,

            login: ({ token, expiresAt, user }) => {
                set({
                    token,
                    expiresAt,
                    user,
                    isAuthenticated: true,
                })
            },

            setUser: (user) => {
                set((state) => ({
                    user,
                    isAuthenticated: !!state.token && !!user,
                }))
            },

            logout: () => {
                set({
                    token: null,
                    expiresAt: null,
                    user: null,
                    isAuthenticated: false,
                })
            },
        }),
        {
            name: 'user-portal-auth-storage',
            partialize: (state) => ({
                token: state.token,
                expiresAt: state.expiresAt,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        },
    ),
)
