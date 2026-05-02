'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarNav, BottomNav } from './NavLinks'
import Image from 'next/image'

type Role = 'owner' | 'trainer' | null

export function RoleShell({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null)
  const [ready, setReady] = useState(false)
  const [gymName, setGymName] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    async function detectRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setReady(true)
        return
      }

      const userId = session.user.id

      // Check owner first
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
        // Redirect to onboarding if not yet completed
        if (!g.onboarding_completed_at && pathname !== '/dashboard/onboarding') {
          router.push('/dashboard/onboarding')
        }
        return
      }

      // Check staff
      const { data: staff } = await supabase
        .from('gym_staff')
        .select('id, gym_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (staff) {
        setRole('trainer')
        localStorage.setItem('userRole', 'trainer')
        // Load gym info for the staff's gym
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
    if (cached) {
      setRole(cached)
      setReady(true)
    }

    detectRole()
  }, [])

  const isTrainer = role === 'trainer'

  if (!ready) return null

  return (
    <div className="flex h-dvh bg-[#F0F2F5]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-[#111827]">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
                <Image
                  src={logoUrl}
                  alt={gymName || 'Gym Logo'}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#0f172a] border border-amber-500/30 flex flex-col items-center justify-center flex-shrink-0 gap-0.5">
                <span className="text-[11px] font-black text-amber-400 italic leading-none tracking-tight">oss</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-amber-500 opacity-70" />
                  ))}
                </div>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-black text-white text-base leading-none tracking-tight italic truncate">
                {gymName || 'Osss'}
              </p>
              <p className="text-[10px] text-white/35 mt-0.5 tracking-wider uppercase">
                {isTrainer ? 'Trainer' : 'Gym Software'}
              </p>
            </div>
          </div>
        </div>

        <SidebarNav isTrainer={isTrainer} />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0 pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav isTrainer={isTrainer} />
    </div>
  )
}
