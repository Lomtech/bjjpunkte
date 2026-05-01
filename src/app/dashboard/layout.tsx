import { AuthGuard } from '@/components/AuthGuard'
import { RoleShell } from './_components/RoleShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleShell>
        {children}
      </RoleShell>
    </AuthGuard>
  )
}
