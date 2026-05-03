'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarNav, BottomNav } from './NavLinks'
import { LogoMark } from '@/components/Logo'
import Image from 'next/image'

type Role = 'owner' | 'trainer' | null
interface RoleCache {
  role: Role
  gymName: string
  logoUrl: string | null
  onboardingDone: boolean
  cachedAt: number
}
const CACHE_KEY = 'osss_role_v2'
const CACHE_TTL = 5 * 60 * 1000 // 5 min

function readCache(): RoleCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function writeCache(c: RoleCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* ignore */ }
}

export function RoleShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  // ── Synchronous init from cache ──────────────────────────────────────────
  // useState initializer runs before first paint — zero flicker for returning users
  const [state, setState] = useState<{
    role: Role; gymName: string; logoUrl: string | null; onboardingDone: boolean; ready: boolean
  }>(() => {
    if (typeof window === 'undefined') return { role: null, gymName: '', logoUrl: null, onboardingDone: true, ready: false }
    const c = readCache()
    if (c) return { role: c.role, gymName: c.gymName, logoUrl: c.logoUrl ?? null, onboardingDone: c.onboardingDone, ready: true }
    return { role: null, gymName: '', logoUrl: null, onboardingDone: true, ready: false }
  })

  useEffect(() => {
    const supabase = createClient()
    const c = readCache()
    const isFresh = !!c?.cachedAt && (Date.now() - c.cachedAt) < CACHE_TTL

    // If cache is fresh skip network — but still watch for sign-out
    if (isFresh) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem(CACHE_KEY)
          router.replace('/login')
        }
      })
      return () => subscription.unsubscribe()
    }

    async function detectRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const userId = session.user.id

      // Owners are the common case — 1 query only
      const { data: gym } = await supabase
        .from('gyms')
        .select('id, name, logo_url, onboarding_completed_at')
        .eq('owner_id', userId)
        .maybeSingle()

      if (gym) {
        const g = gym as any // eslint-disable-line @typescript-eslint/no-explicit-any
        const done = !!g.onboarding_completed_at
        writeCache({ role: 'owner', gymName: g.name ?? '', logoUrl: g.logo_url ?? null, onboardingDone: done, cachedAt: Date.now() })
        setState({ role: 'owner', gymName: g.name ?? '', logoUrl: g.logo_url ?? null, onboardingDone: done, ready: true })
        if (!done && pathname !== '/dashboard/onboarding') router.push('/dashboard/onboarding')
        return
      }

      // Trainer fallback
      const { data: staff } = await supabase
        .from('gym_staff').select('id, gym_id').eq('user_id', userId).maybeSingle()

      if (staff) {
        const { data: staffGym } = await supabase.from('gyms').select('name, logo_url').eq('id', (staff as any).gym_id).maybeSingle() // eslint-disable-line @typescript-eslint/no-explicit-any
        const gName = (staffGym as any)?.name ?? '' // eslint-disable-line @typescript-eslint/no-explicit-any
        const gLogo = (staffGym as any)?.logo_url ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
        writeCache({ role: 'trainer', gymName: gName, logoUrl: gLogo, onboardingDone: true, cachedAt: Date.now() })
        setState({ role: 'trainer', gymName: gName, logoUrl: gLogo, onboardingDone: true, ready: true })
      } else {
        // Brand-new Google OAuth user
        writeCache({ role: 'owner', gymName: '', logoUrl: null, onboardingDone: false, cachedAt: Date.now() })
        setState({ role: 'owner', gymName: '', logoUrl: null, onboardingDone: false, ready: true })
        if (pathname !== '/dashboard/onboarding') router.push('/dashboard/onboarding')
      }
    }

    detectRole()

    // Logo hot-swap (settings page dispatches this after upload)
    function onLogoUpdate(e: Event) {
      const url = (e as CustomEvent<{ url: string | null }>).detail.url
      setState(prev => ({ ...prev, logoUrl: url }))
      const cached = readCache()
      if (cached) writeCache({ ...cached, logoUrl: url })
    }
    window.addEventListener('gym-logo-updated', onLogoUpdate)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { localStorage.removeItem(CACHE_KEY); router.replace('/login') }
    })

    return () => {
      window.removeEventListener('gym-logo-updated', onLogoUpdate)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { role, gymName, logoUrl, onboardingDone, ready } = state

  // Splash — only on very first ever visit (no cache)
  if (!ready) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5">
      <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center shadow-md">
        <LogoMark className="w-6 h-4 text-zinc-950" />
      </div>
      <div className="w-5 h-5 border-2 border-zinc-200 border-t-amber-400 rounded-full animate-spin" />
    </div>
  )

  const isTrainer = role === 'trainer'

  return (
    <div className="flex flex-col bg-zinc-50 safe-area-top" style={{ height: '100dvh' }}>
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-white shadow-[1px_0_0_0_#f0f0f0,2px_0_12px_0_rgba(0,0,0,0.03)]">
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
                <p className="font-black text-zinc-950 text-sm leading-tight tracking-tight truncate">{gymName || 'Osss'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <p className="text-[10px] text-zinc-400 tracking-wide font-medium">{isTrainer ? 'Trainer' : 'Owner'}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-4 h-px bg-zinc-100" />
          <SidebarNav isTrainer={isTrainer} onboardingDone={onboardingDone} />
        </aside>

        <main className="flex-1 overflow-auto min-w-0">{children}</main>
      </div>
      <BottomNav isTrainer={isTrainer} onboardingDone={onboardingDone} />
    </div>
  )
}
