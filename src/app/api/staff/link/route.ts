import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const { inviteToken, userId } = await req.json()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await supabase
    .from('gym_staff')
    .update({ user_id: userId, accepted_at: new Date().toISOString() })
    .eq('invite_token', inviteToken)
  return NextResponse.json({ success: true })
}
