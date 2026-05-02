import { NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function serviceClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const { data: gym } = await admin.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${gym.id}/${Date.now()}.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('gym-media')
    .upload(path, buf, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('gym-media').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
