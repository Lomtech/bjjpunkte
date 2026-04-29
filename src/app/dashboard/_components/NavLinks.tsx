'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CheckSquare, Calendar,
  TrendingUp, Settings, LogOut,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/dashboard/members',    label: 'Mitglieder',  icon: Users },
  { href: '/dashboard/attendance', label: 'Anwesenheit', icon: CheckSquare },
  { href: '/dashboard/schedule',   label: 'Stundenplan', icon: Calendar },
  { href: '/dashboard/revenue',    label: 'Einnahmen',   icon: TrendingUp },
  { href: '/dashboard/settings',   label: 'Einstellungen', icon: Settings },
]

// Bottom nav shows only 5 most important items
const BOTTOM_NAV = [
  { href: '/dashboard',            label: 'Home',        icon: LayoutDashboard },
  { href: '/dashboard/members',    label: 'Mitglieder',  icon: Users },
  { href: '/dashboard/schedule',   label: 'Stundenplan', icon: Calendar },
  { href: '/dashboard/attendance', label: 'Check-in',    icon: CheckSquare },
  { href: '/dashboard/settings',   label: 'Einstellungen', icon: Settings },
]

function isActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export function SidebarNav() {
  const pathname = usePathname()
  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <Link
          href="/auth/signout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium w-full"
        >
          <LogOut size={16} className="flex-shrink-0" />
          Abmelden
        </Link>
      </div>
    </>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-pb">
      <div className="flex items-stretch">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-amber-600' : 'text-gray-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
