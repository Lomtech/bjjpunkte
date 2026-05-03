import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function serviceClient() {
  return createClient(
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
    // Fetch the gym owned by this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gym } = await (svc.from('gyms') as any)
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (gym) {
      const gymId = gym.id

      // Delete child tables in dependency order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('attendance') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('class_bookings') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('lead_bookings') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('belt_promotions') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('membership_plans') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('gym_announcements') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('posts') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('leads') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('classes') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('members') as any).delete().eq('gym_id', gymId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('staff') as any).delete().eq('gym_id', gymId)

      // Delete payments — wrapped in try/catch in case table does not exist
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('payments') as any).delete().eq('gym_id', gymId)
      } catch {
        // table may not exist — ignore
      }

      // Delete the gym itself
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('gyms') as any).delete().eq('id', gymId)
    }

    // Delete the auth user
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
