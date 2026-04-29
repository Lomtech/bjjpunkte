'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Check session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })

    // Listen for auth changes (logout, token expiry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) router.replace('/login')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return <>{children}</>
}
