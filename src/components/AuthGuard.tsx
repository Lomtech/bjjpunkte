'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // getSession() awaits internal initialization before reading from storage
    // — this is reliable regardless of when the effect runs
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setReady(true)
      }
    })

    // Handle future sign-outs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setReady(false)
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (!ready) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
    </div>
  )

  return <>{children}</>
}
