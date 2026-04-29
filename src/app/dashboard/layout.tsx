import Link from 'next/link'
import { AuthGuard } from '@/components/AuthGuard'
import { LogOut, Users, LayoutDashboard, CheckSquare, Settings, TrendingUp, Calendar } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-xs font-black text-white">RC</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">RollCall</p>
              <p className="text-xs text-slate-400">BJJ Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <NavLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
          <NavLink href="/dashboard/members" icon={<Users size={16} />} label="Mitglieder" />
          <NavLink href="/dashboard/attendance" icon={<CheckSquare size={16} />} label="Anwesenheit" />
          <NavLink href="/dashboard/schedule" icon={<Calendar size={16} />} label="Stundenplan" />
          <NavLink href="/dashboard/revenue" icon={<TrendingUp size={16} />} label="Einnahmen" />
          <NavLink href="/dashboard/settings" icon={<Settings size={16} />} label="Einstellungen" />
        </nav>

        <div className="p-3 border-t border-slate-100">
          <Link
            href="/auth/signout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors text-sm font-medium w-full"
          >
            <LogOut size={16} />
            Abmelden
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {children}
      </main>
    </div>
    </AuthGuard>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm font-medium"
    >
      {icon}
      {label}
    </Link>
  )
}
