'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarNav, BottomNav } from './NavLinks'
import { LogoMark } from '@/components/Logo'
import Image from 'next/image'

type Role = 'owner' | 'trainer' | null

export function RoleShell({ children }: { children: React.ReactNode }) {
  const [role, setRole]       = useState<Role>(null)
  const [ready, setReady]     = useState(false)
  const [gymName, setGymName] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    async function detectRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setReady(true); return }

      const userId = session.user.id

      const { data: gym } = await supabase
        .from('gyms')
        .select('id, name, logo_url, onboarding_completed_at')
        .eq('owner_id', userId)
        .maybeSingle()

      if (gym) {
        const g = gym as any
        setRole('owner')
        setGymName(g.name ?? '')
        setLogoUrl(g.logo_url ?? null)
        localStorage.setItem('userRole', 'owner')
        setReady(true)
        if (!g.onboarding_completed_at && pathname !== '/dashboard/onboarding') {
          router.push('/dashboard/onboarding')
        }
        return
      }

      const { data: staff } = await supabase
        .from('gym_staff')
        .select('id, gym_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (staff) {
        setRole('trainer')
        localStorage.setItem('userRole', 'trainer')
        const { data: staffGym } = await supabase
          .from('gyms')
          .select('name, logo_url')
          .eq('id', (staff as any).gym_id)
          .maybeSingle()
        if (staffGym) {
          setGymName(staffGym.name ?? '')
          setLogoUrl(staffGym.logo_url ?? null)
        }
      } else {
        setRole('owner')
        localStorage.setItem('userRole', 'owner')
      }

      setReady(true)
    }

    const cached = localStorage.getItem('userRole') as Role
    if (cached) { setRole(cached); setReady(true) }
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

        <SidebarNav isTrainer={isTrainer} />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>

      </div>{/* end main row */}

      {/* ── Mobile bottom nav — part of flex column, not fixed ── */}
      <BottomNav isTrainer={isTrainer} />
    </div>
  )
}
