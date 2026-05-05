import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const auth = authClient(accessToken)
  const { data: { user } } = await auth.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const svc = serviceClient()

  try {
    const { data: gym } = await svc.from('gyms')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (gym) {
      // Atomic cascading delete via DB function — all-or-nothing transaction
      const { error: rpcError } = await svc.rpc('delete_gym_cascade', {
        p_gym_id: gym.id,
        p_user_id: user.id,
      })

      if (rpcError) {
        console.error('[delete-account] cascade rpc failed:', rpcError)
        return NextResponse.json({ error: rpcError.message }, { status: 500 })
      }
    }

    const { error: deleteUserError } = await svc.auth.admin.deleteUser(user.id)
    if (deleteUserError) {
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
