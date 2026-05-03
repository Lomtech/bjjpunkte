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
