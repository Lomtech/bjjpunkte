'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarNav, BottomNav } from './NavLinks'
import { LogoMark } from '@/components/Logo'
import Image from 'next/image'

type Role = 'owner' | 'trainer' | null
interface RoleCache { role: Role; gymName: string; logoUrl: string | null; onboardingDone: boolean }
const CACHE_KEY = 'osss_role_v2'

export function RoleShell({ children }: { children: React.ReactNode }) {
  const [role, setRole]                   = useState<Role>(null)
  const [ready, setReady]                 = useState(false)
  const [gymName, setGymName]             = useState<string>('')
  const [logoUrl, setLogoUrl]             = useState<string | null>(null)
  const [onboardingDone, setOnboardingDone] = useState<boolean>(true)
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    // ── Instant render from cache ──────────────────────────────────────────
    // Show UI immediately if we have cached role data — no network wait
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const c: RoleCache = JSON.parse(raw)
        setRole(c.role)
        setGymName(c.gymName ?? '')
        setLogoUrl(c.logoUrl ?? null)
        setOnboardingDone(c.onboardingDone ?? true)
        setReady(true)   // ← render NOW, refresh in background
      }
    } catch { /* ignore parse errors */ }

    async function detectRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setReady(true); return }

      const userId = session.user.id

      // Query gym + staff in parallel to avoid waterfall
      const [{ data: gym }, { data: staff }] = await Promise.all([
        supabase.from('gyms').select('id, name, logo_url, onboarding_completed_at').eq('owner_id', userId).maybeSingle(),
        supabase.from('gym_staff').select('id, gym_id').eq('user_id', userId).maybeSingle(),
      ])

      if (gym) {
        const g = gym as any
        const done = !!g.onboarding_completed_at
        const cache: RoleCache = { role: 'owner', gymName: g.name ?? '', logoUrl: g.logo_url ?? null, onboardingDone: done }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        setRole('owner'); setGymName(g.name ?? ''); setLogoUrl(g.logo_url ?? null); setOnboardingDone(done)
        setReady(true)
        if (!done && pathname !== '/dashboard/onboarding') router.push('/dashboard/onboarding')
        return
      }

      if (staff) {
        const { data: staffGym } = await supabase.from('gyms').select('name, logo_url').eq('id', (staff as any).gym_id).maybeSingle()
        const gName = (staffGym as any)?.name ?? ''
        const gLogo = (staffGym as any)?.logo_url ?? null
        const cache: RoleCache = { role: 'trainer', gymName: gName, logoUrl: gLogo, onboardingDone: true }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        setRole('trainer'); setGymName(gName); setLogoUrl(gLogo); setOnboardingDone(true)
      } else {
        // New owner with no gym yet (e.g. Google OAuth first login)
        const cache: RoleCache = { role: 'owner', gymName: '', logoUrl: null, onboardingDone: false }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        setRole('owner'); setOnboardingDone(false)
        if (pathname !== '/dashboard/onboarding') router.push('/dashboard/onboarding')
      }

      setReady(true)
    }

    detectRole()

    function onLogoUpdate(e: Event) {
      const url = (e as CustomEvent<{ url: string | null }>).detail.url
      setLogoUrl(url)
    }
    window.addEventListener('gym-logo-updated', onLogoUpdate)
    return () => window.removeEventListener('gym-logo-updated', onLogoUpdate)
  }, [])

  const isTrainer = role === 'trainer'
  if (!ready) return null

  return (
    <div className="flex flex-col bg-zinc-50 safe-area-top" style={{ height: '100dvh' }}>

      {/* ── Main row: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-white shadow-[1px_0_0_0_#f0f0f0,2px_0_12px_0_rgba(0,0,0,0.03)]">

        {/* Gym identity */}
        <div className="px-4 py-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-zinc-200/80">
                <Image src={logoUrl} alt={gymName || 'Gym Logo'} width={36} height={36} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm shadow-amber-200">
                <LogoMark className="w-4 h-3 text-zinc-950" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-black text-zinc-950 text-sm leading-tight tracking-tight truncate">
                {gymName || 'Osss'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <p className="text-[10px] text-zinc-400 tracking-wide font-medium">
                  {isTrainer ? 'Trainer' : 'Owner'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4 h-px bg-zinc-100" />

        <SidebarNav isTrainer={isTrainer} onboardingDone={onboardingDone} />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>

      </div>{/* end main row */}

      {/* ── Mobile bottom nav — part of flex column, not fixed ── */}
      <BottomNav isTrainer={isTrainer} onboardingDone={onboardingDone} />
    </div>
  )
}
