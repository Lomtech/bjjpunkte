'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Calendar,
  TrendingUp, Settings, LogOut, UserPlus,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard, ownerOnly: false },
  { href: '/dashboard/members',    label: 'Mitglieder',    icon: Users,           ownerOnly: false },
  { href: '/dashboard/leads',      label: 'Interessenten', icon: UserPlus,        ownerOnly: true  },
  { href: '/dashboard/schedule',   label: 'Stundenplan',   icon: Calendar,        ownerOnly: false },
  { href: '/dashboard/revenue',    label: 'Einnahmen',     icon: TrendingUp,      ownerOnly: true  },
  { href: '/dashboard/settings',   label: 'Einstellungen', icon: Settings,        ownerOnly: true  },
]

// Trainer sees only schedule + attendance (kiosk lives under attendance)
const TRAINER_NAV = [
  { href: '/dashboard/schedule',              label: 'Stundenplan',  icon: Calendar },
  { href: '/dashboard/attendance/kiosk',      label: 'Anwesenheit',  icon: Users    },
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
  const items = isTrainer ? TRAINER_NAV : NAV.filter((n) => !n.ownerOnly || !isTrainer)

  return (
    <>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-2 pb-4 border-t border-white/10 pt-3">
        <Link href="/auth/signout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium w-full">
          <LogOut size={15} className="flex-shrink-0" />
          Abmelden
        </Link>
      </div>
    </>
  )
}

export function BottomNav({ isTrainer = false }: { isTrainer?: boolean }) {
  const pathname = usePathname()
  const items = isTrainer ? TRAINER_BOTTOM_NAV : BOTTOM_NAV.filter((n) => !n.ownerOnly || !isTrainer)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
      <div className="flex items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-colors ${
                active ? 'text-amber-600' : 'text-gray-400'
              }`}>
              <Icon size={19} strokeWidth={active ? 2.5 : 1.75} />
              <span className="mt-0.5">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
