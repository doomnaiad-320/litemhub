import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/routes/constants'

const INVITE_CODE_STORAGE_KEY = 'userPortalInviteCode'

export default function UserPortalInvitePage() {
    const navigate = useNavigate()
    const { code } = useParams()

    useEffect(() => {
        const normalizedCode = (code || '').trim().toUpperCase()
        if (normalizedCode) {
            window.localStorage.setItem(INVITE_CODE_STORAGE_KEY, normalizedCode)
        }

        navigate(ROUTES.USER_REGISTER, { replace: true })
    }, [code, navigate])

    return null
}
