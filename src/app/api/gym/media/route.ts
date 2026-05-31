import { NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

function serviceClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const admin = serviceClient()
  const gym = auth.gym

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ALLOWED: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/gif':  'gif',
  }
  const ext = ALLOWED[file.type]
  if (!ext) return NextResponse.json({ error: 'Nur Bilder erlaubt (JPEG, PNG, WebP, GIF)' }, { status: 415 })

  const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 413 })

  const path = `${gym.id}/${Date.now()}.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('gym-media')
    .upload(path, buf, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('gym-media').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
