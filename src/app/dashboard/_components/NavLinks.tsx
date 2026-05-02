'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Calendar,
  TrendingUp, Settings, LogOut, UserPlus, UserCheck,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',             label: 'Dashboard',     icon: LayoutDashboard, ownerOnly: false },
  { href: '/dashboard/members',     label: 'Mitglieder',    icon: Users,           ownerOnly: false },
  { href: '/dashboard/leads',       label: 'Interessenten', icon: UserPlus,        ownerOnly: true  },
  { href: '/dashboard/schedule',    label: 'Stundenplan',   icon: Calendar,        ownerOnly: false },
  { href: '/dashboard/attendance',  label: 'Anwesenheit',   icon: UserCheck,       ownerOnly: false },
  { href: '/dashboard/revenue',     label: 'Einnahmen',     icon: TrendingUp,      ownerOnly: true  },
  { href: '/dashboard/settings',    label: 'Einstellungen', icon: Settings,        ownerOnly: true  },
]

const TRAINER_NAV = [
  { href: '/dashboard/schedule',    label: 'Stundenplan', icon: Calendar   },
  { href: '/dashboard/attendance',  label: 'Anwesenheit', icon: UserCheck  },
]

const BOTTOM_NAV = [
  { href: '/dashboard',             label: 'Übersicht',     icon: LayoutDashboard, ownerOnly: false },
  { href: '/dashboard/members',     label: 'Mitglieder',    icon: Users,           ownerOnly: false },
  { href: '/dashboard/schedule',    label: 'Stundenplan',   icon: Calendar,        ownerOnly: false },
  { href: '/dashboard/attendance',  label: 'Anwesenheit',   icon: UserCheck,       ownerOnly: false },
  { href: '/dashboard/settings',    label: 'Einstellungen', icon: Settings,        ownerOnly: true  },
]

const TRAINER_BOTTOM_NAV = [
  { href: '/dashboard/schedule',    label: 'Stundenplan', icon: Calendar  },
  { href: '/dashboard/attendance',  label: 'Anwesenheit', icon: UserCheck },
]

function isActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export function SidebarNav({ isTrainer = false }: { isTrainer?: boolean }) {
  const pathname = usePathname()
  const items = isTrainer ? TRAINER_NAV : NAV.filter(n => !n.ownerOnly || !isTrainer)

  return (
    <>
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                active
                  ? 'bg-amber-50 text-amber-700 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.25 : 1.75}
                className={`flex-shrink-0 transition-colors ${active ? 'text-amber-600' : 'text-zinc-400'}`}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t border-zinc-100">
        <Link href="/auth/signout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150 text-sm w-full">
          <LogOut size={16} strokeWidth={1.75} className="flex-shrink-0" />
          Abmelden
        </Link>
      </div>
    </>
  )
}

export function BottomNav({ isTrainer = false }: { isTrainer?: boolean }) {
  const pathname = usePathname()
  const items = isTrainer ? TRAINER_BOTTOM_NAV : BOTTOM_NAV.filter(n => !n.ownerOnly || !isTrainer)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/96 backdrop-blur-md border-t border-zinc-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="h-14 flex items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <div className={`w-9 h-7 flex items-center justify-center rounded-xl transition-colors ${active ? 'bg-amber-50' : ''}`}>
                <Icon
                  size={19}
                  strokeWidth={active ? 2.25 : 1.75}
                  className={active ? 'text-amber-500' : ''}
                />
              </div>
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'text-zinc-700' : ''}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
