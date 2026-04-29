import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Only allow deleting pending or failed payments (not paid ones)
  const { data: payment } = await supabase
    .from('payments').select('status').eq('id', id).single()

  if (!payment) return NextResponse.json({ error: 'Zahlung nicht gefunden' }, { status: 404 })
  if ((payment as { status: string }).status === 'paid') {
    return NextResponse.json({ error: 'Bezahlte Zahlungen können nicht gelöscht werden' }, { status: 400 })
  }

  await supabase.from('payments').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
