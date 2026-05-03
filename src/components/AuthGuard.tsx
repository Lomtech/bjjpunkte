'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogoMark } from '@/components/Logo'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // Assume logged in immediately if Supabase has a cached session token in localStorage
  // RoleShell handles the actual session verification and redirects if invalid
  const [ready, setReady] = useState(() => {
    if (typeof window === 'undefined') return false
    // Check for any Supabase session token in localStorage (fast, synchronous)
    try {
      const keys = Object.keys(localStorage)
      return keys.some(k => k.includes('supabase') && k.includes('auth-token'))
    } catch { return false }
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setReady(false); router.replace('/login') }
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (!ready) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center shadow-lg">
          <LogoMark className="w-7 h-5 text-zinc-950" />
        </div>
        <span className="font-black text-xl tracking-tight text-zinc-900">Osss</span>
      </div>
      <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-400 rounded-full animate-spin" />
    </div>
  )

  return <>{children}</>
}
