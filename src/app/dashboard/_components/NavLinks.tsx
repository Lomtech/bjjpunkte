'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Calendar,
  TrendingUp, Settings, LogOut, UserPlus, UserCheck, Link2, Globe, FileText, Rocket, Briefcase, Mail, FileWarning,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'

// Cache the admin status for 60s — don't hammer /api/admin/me on every page nav
let adminCheckCache: { ts: number; isAdmin: boolean } | null = null

function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // sync init from cache if fresh
    if (adminCheckCache && Date.now() - adminCheckCache.ts < 60_000) {
      return adminCheckCache.isAdmin
    }
    return false
  })

  useEffect(() => {
    if (adminCheckCache && Date.now() - adminCheckCache.ts < 60_000) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const ok = res.ok
        adminCheckCache = { ts: Date.now(), isAdmin: ok }
        if (!cancelled) setIsAdmin(ok)
      } catch {
        adminCheckCache = { ts: Date.now(), isAdmin: false }
      }
    })()
    return () => { cancelled = true }
  }, [])

  return isAdmin
}

function isActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  // Sammel-Eintrag „Kommunikation" deckt sowohl /communication als auch /content ab,
  // weil beide jetzt unter EINER Sektion zusammengefasst sind (Mail + Inhalte).
  if (href === '/dashboard/communication') {
    return pathname.startsWith('/dashboard/communication') || pathname.startsWith('/dashboard/content')
  }
  return pathname.startsWith(href)
}

export function SidebarNav({ isTrainer = false, onboardingDone = true }: { isTrainer?: boolean; onboardingDone?: boolean }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const isAdmin = useIsAdmin()

  const NAV = [
    { href: '/dashboard',             label: t('nav', 'dashboard'),   icon: LayoutDashboard, ownerOnly: false },
    { href: '/dashboard/schedule',    label: t('nav', 'schedule'),    icon: Calendar,        ownerOnly: false },
    { href: '/dashboard/attendance',  label: t('nav', 'attendance'),  icon: UserCheck,       ownerOnly: false },
    { href: '/dashboard/members',     label: t('nav', 'members'),     icon: Users,           ownerOnly: false },
    { href: '/dashboard/leads',       label: t('nav', 'leads'),       icon: UserPlus,        ownerOnly: true  },
    { href: '/dashboard/revenue',     label: t('nav', 'revenue'),     icon: TrendingUp,      ownerOnly: true  },
    { href: '/dashboard/inkasso',     label: 'Inkasso',                icon: FileWarning,     ownerOnly: true  },
    { href: '/dashboard/communication', label: t('nav', 'communication'), icon: Mail,        ownerOnly: true  },
    { href: '/dashboard/website',     label: t('nav', 'website'),     icon: Globe,           ownerOnly: true  },
    { href: '/dashboard/links',       label: t('nav', 'links'),       icon: Link2,           ownerOnly: true  },
    { href: '/dashboard/settings',    label: t('nav', 'settings'),    icon: Settings,        ownerOnly: true  },
  ]

  const TRAINER_NAV = [
    { href: '/dashboard/schedule',    label: t('nav', 'schedule'),    icon: Calendar  },
    { href: '/dashboard/attendance',  label: t('nav', 'attendance'),  icon: UserCheck },
  ]

  const items = isTrainer ? TRAINER_NAV : NAV.filter(n => !n.ownerOnly || !isTrainer)
  const onboardingActive = pathname === '/dashboard/onboarding'

  return (
    <>
      <nav className="flex-1 px-3 py-3 space-y-0.5">

        {/* Onboarding entry — visible until setup is complete */}
        {!isTrainer && !onboardingDone && (
          <Link href="/dashboard/onboarding"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 mb-1 ${
              onboardingActive
                ? 'bg-amber-50 text-amber-700 font-semibold'
                : 'bg-amber-50/60 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <div className="relative flex-shrink-0">
              <Rocket size={16} strokeWidth={onboardingActive ? 2.25 : 1.75} className="text-amber-500" />
              {!onboardingActive && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <span className="font-semibold">{t('nav', 'setup')}</span>
          </Link>
        )}

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

        {/* Admin-only Sales-CRM link — invisible to gym customers */}
        {isAdmin && (
          <>
            <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Internal</div>
            <Link href="/admin/leads"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                pathname.startsWith('/admin/leads')
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              <Briefcase
                size={16}
                strokeWidth={pathname.startsWith('/admin/leads') ? 2.25 : 1.75}
                className={`flex-shrink-0 transition-colors ${pathname.startsWith('/admin/leads') ? 'text-purple-600' : 'text-zinc-400'}`}
              />
              Sales-CRM
            </Link>
          </>
        )}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t border-zinc-100">
        <Link href="/auth/signout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150 text-sm w-full">
          <LogOut size={16} strokeWidth={1.75} className="flex-shrink-0" />
          {t('nav', 'signout')}
        </Link>
      </div>
    </>
  )
}

export function BottomNav({ isTrainer = false, onboardingDone = true }: { isTrainer?: boolean; onboardingDone?: boolean }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const isAdmin = useIsAdmin()

  const BOTTOM_NAV = [
    { href: '/dashboard',             label: t('nav', 'overview'),    icon: LayoutDashboard, ownerOnly: false },
    { href: '/dashboard/members',     label: t('nav', 'members'),     icon: Users,           ownerOnly: false },
    { href: '/dashboard/schedule',    label: t('nav', 'schedule'),    icon: Calendar,        ownerOnly: false },
    { href: '/dashboard/links',       label: t('nav', 'links'),       icon: Link2,           ownerOnly: true  },
    { href: '/dashboard/settings',    label: t('nav', 'settings'),    icon: Settings,        ownerOnly: true  },
  ]

  const TRAINER_BOTTOM_NAV = [
    { href: '/dashboard/schedule',    label: t('nav', 'schedule'),    icon: Calendar  },
    { href: '/dashboard/attendance',  label: t('nav', 'attendance'),  icon: UserCheck },
  ]

  const baseItems = isTrainer ? TRAINER_BOTTOM_NAV : BOTTOM_NAV.filter(n => !n.ownerOnly || !isTrainer)

  // Prepend onboarding tab for owners who haven't finished setup
  let items = (!isTrainer && !onboardingDone)
    ? [{ href: '/dashboard/onboarding', label: t('nav', 'setup'), icon: Rocket, ownerOnly: true }, ...baseItems]
    : baseItems

  // Admins get an extra "CRM" tab — replace "Links" (less critical for them)
  // to keep total tabs at 5 (iOS HIG: comfortable touch targets)
  if (!isTrainer && isAdmin) {
    items = items.filter(i => i.href !== '/dashboard/links')
    items = [...items, { href: '/admin/leads', label: 'CRM', icon: Briefcase, ownerOnly: true }]
  }

  return (
    <nav className="md:hidden flex-shrink-0 bg-white/96 backdrop-blur-md border-t border-zinc-100 z-40">
      {/* Tab items — fixed 49px (iOS HIG standard) */}
      <div className="h-[49px] flex items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          const isOnboarding = href === '/dashboard/onboarding'
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-[2px] transition-colors relative ${
                active ? 'text-zinc-900' : 'text-zinc-400'
              }`}
            >
              <div className="relative">
                <Icon
                  size={active ? 22 : 21}
                  strokeWidth={active ? 2.3 : 1.6}
                  className={`transition-all ${active ? 'text-amber-500' : isOnboarding ? 'text-amber-400' : 'text-zinc-400'}`}
                />
                {isOnboarding && !active && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <span className={`text-[10px] leading-none tracking-tight font-medium ${
                active ? 'text-amber-500' : isOnboarding ? 'text-amber-400' : 'text-zinc-400'
              }`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
      {/* Safe-area spacer for home indicator */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </nav>
  )
}
