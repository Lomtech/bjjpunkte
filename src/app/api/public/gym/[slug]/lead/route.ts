import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyGym } from '@/lib/notify'

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

  // Notify gym owner via email + WhatsApp
  const fullName = `${first_name.trim()} ${last_name.trim()}`
  await notifyGym({
    gymId: gym.id,
    subject: `Probetraining-Anfrage: ${fullName}`,
    html: `
      <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Neue Probetraining-Anfrage! 🥋</p>
      <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
        <strong>${fullName}</strong> hat über deine Gym-Website ein Probetraining angefragt.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Name</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600">${fullName}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">E-Mail</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${email.trim().toLowerCase()}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Telefon</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${phone.trim()}</td></tr>` : ''}
        ${message ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Nachricht</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${message.trim()}</td></tr>` : ''}
      </table>
      <p style="margin:20px 0 0;font-size:14px;color:#64748b">Der Interessent wurde automatisch in deinem Dashboard unter <strong>Interessenten</strong> angelegt.</p>
    `,
    whatsappText: `🥋 Probetraining-Anfrage!\n${fullName}\n${email.trim().toLowerCase()}${phone ? '\n' + phone.trim() : ''}${message ? '\n"' + message.trim() + '"' : ''}\n\nosss.pro Dashboard`,
  })

  return NextResponse.json({ success: true })
}
