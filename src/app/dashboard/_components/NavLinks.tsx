'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Calendar,
  TrendingUp, Settings, LogOut, UserPlus,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',          label: 'Dashboard',     icon: LayoutDashboard, ownerOnly: false },
  { href: '/dashboard/members',  label: 'Mitglieder',    icon: Users,           ownerOnly: false },
  { href: '/dashboard/leads',    label: 'Interessenten', icon: UserPlus,        ownerOnly: true  },
  { href: '/dashboard/schedule', label: 'Stundenplan',   icon: Calendar,        ownerOnly: false },
  { href: '/dashboard/revenue',  label: 'Einnahmen',     icon: TrendingUp,      ownerOnly: true  },
  { href: '/dashboard/settings', label: 'Einstellungen', icon: Settings,        ownerOnly: true  },
]

const TRAINER_NAV = [
  { href: '/dashboard/schedule',         label: 'Stundenplan', icon: Calendar },
  { href: '/dashboard/attendance/kiosk', label: 'Anwesenheit', icon: Users    },
]

const BOTTOM_NAV = [
  { href: '/dashboard',          label: 'Übersicht',     icon: LayoutDashboard, ownerOnly: false },
  { href: '/dashboard/members',  label: 'Mitglieder',    icon: Users,           ownerOnly: false },
  { href: '/dashboard/schedule', label: 'Stundenplan',   icon: Calendar,        ownerOnly: false },
  { href: '/dashboard/settings', label: 'Einstellungen', icon: Settings,        ownerOnly: true  },
]

const TRAINER_BOTTOM_NAV = [
  { href: '/dashboard/schedule',         label: 'Stundenplan', icon: Calendar },
  { href: '/dashboard/attendance/kiosk', label: 'Anwesenheit', icon: Users    },
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
      <nav className="flex-1 px-2 py-2 space-y-px">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-zinc-100 text-zinc-900 font-medium'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2 : 1.75}
                className={`flex-shrink-0 ${active ? 'text-zinc-700' : 'text-zinc-400'}`}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 pb-3 pt-2 border-t border-zinc-100">
        <Link href="/auth/signout"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm w-full">
          <LogOut size={15} strokeWidth={1.75} className="flex-shrink-0" />
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-zinc-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-start">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center h-14 pt-2.5 gap-0.5 transition-colors ${
                active ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.25 : 1.75}
                className={active ? 'text-amber-500' : ''}
              />
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
