import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  // Token-Hardening (Audit 2026-05-09 / A2): mind. 32 Zeichen + Char-Class.
  // Manifest war bisher ohne Length-/Char-Check — jeder Probing-Request triggerte
  // einen DB-Hit. Frühe Rückgabe eines generischen Manifests verhindert das.
  if (!token || token.length < 32 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return new NextResponse(JSON.stringify({
      name: 'Probetraining',
      short_name: 'Probetraining',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#FBBF24',
    }), { headers: { 'Content-Type': 'application/manifest+json' } })
  }

  let gymName = 'Probetraining'
  let themeColor = '#FBBF24'
  try {
    const supabase = serviceClient()
    const { data: lead } = await supabase
      .from('leads')
      .select('gym_id')
      .eq('lead_token', token)
      .single()
    if (lead?.gym_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gym } = await (supabase.from('gyms') as any)
        .select('name, accent_color')
        .eq('id', lead.gym_id)
        .single()
      if (gym?.name) gymName = gym.name
      if (gym?.accent_color) themeColor = gym.accent_color
    }
  } catch { /* ignore */ }

  const manifest = {
    name: gymName,
    short_name: gymName,
    description: 'Dein Interessenten-Portal',
    start_url: `/lead/${token}`,
    scope: `/lead/${token}`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: themeColor,
    categories: ['sports', 'health'],
    icons: [
      { src: '/icon',       sizes: '32x32',   type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon-512',   sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512',   sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
