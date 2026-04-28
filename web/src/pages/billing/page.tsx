import { AnimatedRoute } from '@/components/layout/AnimatedRoute'
import { AppRechargeOverview } from '@/feature/app-user/components/AppRechargeOverview'

export default function BillingPage() {
    return (
        <AnimatedRoute>
            <div className="h-full">
                <AppRechargeOverview />
            </div>
        </AnimatedRoute>
    )
}
