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
              {/* Logo icon */}
              <div className="w-9 h-9 rounded-xl bg-[#0f172a] border border-amber-500/30 flex flex-col items-center justify-center flex-shrink-0 gap-0.5">
                <span className="text-[11px] font-black text-amber-400 italic leading-none tracking-tight">oss</span>
                <div className="flex gap-0.5">
                  {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-amber-500 opacity-70" />)}
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-black text-white text-base leading-none tracking-tight italic">Osss</p>
                <p className="text-[10px] text-white/35 mt-0.5 tracking-wider uppercase">Gym Software</p>
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
