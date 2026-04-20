import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useUserPortalAuthStore } from '@/store/user-portal-auth'
import { useUserPortalMe } from '../hooks'

export function UserPortalProtectedRoute() {
    const token = useUserPortalAuthStore((state) => state.token)
    const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated)
    const location = useLocation()
    const navigate = useNavigate()

    const { isLoading, isError } = useUserPortalMe(!!token)

    useEffect(() => {
        if (token && isError) {
            navigate('/login', { replace: true, state: { from: location } })
        }
    }, [isError, location, navigate, token])

    if (!token || !isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    if (isLoading) {
        return null
    }

    return <Outlet />
}
