import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = serviceClient()

  const { data: gym } = await supabase
    .from('gyms')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const body = await req.json()
  const { first_name, last_name, email, phone, message } = body

  if (!first_name || !last_name || !email) {
    return NextResponse.json({ error: 'Name und E-Mail sind erforderlich' }, { status: 400 })
  }

  const { error } = await supabase.from('leads').insert({
    gym_id:     gym.id,
    first_name: first_name.trim(),
    last_name:  last_name.trim(),
    email:      email.trim().toLowerCase(),
    phone:      phone?.trim() || null,
    notes:      message?.trim() || null,
    status:     'new',
    source:     'public_page',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
