import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  // Require a valid session — this endpoint writes to gym_staff with service role
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const authSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await authSupabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { inviteToken, userId } = await req.json()
  if (!inviteToken || !userId) return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })

  if (!inviteToken || inviteToken.length < 20 || !/^[a-zA-Z0-9_-]+$/.test(inviteToken)) {
    return NextResponse.json({ error: 'Ungültiger Einladungstoken' }, { status: 400 })
  }

  // Security: the authenticated user can only link their own account — prevent linking someone else
  if (userId !== user.id) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Only accept invites that haven't been accepted yet (accepted_at IS NULL)
  const { data: staffRecord } = await supabase
    .from('gym_staff')
    .select('id, accepted_at')
    .eq('invite_token', inviteToken)
    .is('accepted_at', null)
    .single()

  if (!staffRecord) {
    return NextResponse.json({ error: 'Ungültiger oder bereits verwendeter Einladungslink' }, { status: 404 })
  }

  await supabase
    .from('gym_staff')
    .update({ user_id: userId, accepted_at: new Date().toISOString() })
    .eq('id', staffRecord.id)

  return NextResponse.json({ success: true })
}
