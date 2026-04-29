import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// DELETE /api/promotions/[id]
// Removes a belt promotion and reverts the member's belt/stripes to what they were before,
// but ONLY if it is the most recent promotion for that member.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authedClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Fetch the promotion to delete
  const { data: promo } = await supabase
    .from('belt_promotions')
    .select('id, member_id, previous_belt, previous_stripes, new_belt, new_stripes, promoted_at')
    .eq('id', id)
    .single()

  if (!promo) return NextResponse.json({ error: 'Promotion nicht gefunden' }, { status: 404 })

  // Check it is the most recent promotion for this member
  const { data: latest } = await supabase
    .from('belt_promotions')
    .select('id')
    .eq('member_id', (promo as { member_id: string }).member_id)
    .order('promoted_at', { ascending: false })
    .limit(1)
    .single()

  const isLatest = (latest as { id: string } | null)?.id === id

  // Delete the promotion record
  const { error: deleteErr } = await supabase.from('belt_promotions').delete().eq('id', id)
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  // Only revert member's belt if this was the most recent promotion
  if (isLatest) {
    const p = promo as { member_id: string; previous_belt: string; previous_stripes: number }
    await supabase
      .from('members')
      .update({ belt: p.previous_belt, stripes: p.previous_stripes })
      .eq('id', p.member_id)
  }

  return NextResponse.json({ success: true, reverted: isLatest })
}
