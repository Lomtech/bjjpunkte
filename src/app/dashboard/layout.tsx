import { RoleShell } from './_components/RoleShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell>
      {children}
    </RoleShell>
  )
}
