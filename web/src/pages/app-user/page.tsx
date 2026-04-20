import { AnimatedRoute } from '@/components/layout/AnimatedRoute'
import { AppUserTable } from '@/feature/app-user/components/AppUserTable'

export default function AppUserPage() {
    return (
        <AnimatedRoute>
            <div className="h-full">
                <AppUserTable />
            </div>
        </AnimatedRoute>
    )
}
