import { AuthGuard } from '@/components/AuthGuard'
import { SidebarNav, BottomNav } from './_components/NavLinks'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-dvh bg-[#F0F2F5]">

        {/* ── Desktop sidebar ── */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-[#111827]">
          {/* Logo */}
          <div className="px-4 py-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-white tracking-tight">RC</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm leading-none">RollCall</p>
                <p className="text-xs text-white/35 mt-0.5">BJJ Management</p>
              </div>
            </div>
          </div>

          <SidebarNav />
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto min-w-0 pb-16 md:pb-0">
          {children}
        </main>

        {/* ── Mobile bottom nav ── */}
        <BottomNav />
      </div>
    </AuthGuard>
  )
}
