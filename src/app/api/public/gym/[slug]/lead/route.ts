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
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const body = await req.json()
  const { first_name, last_name, email, phone, message, class_id } = body

  if (!first_name || !last_name || !email) {
    return NextResponse.json({ error: 'Name und E-Mail sind erforderlich' }, { status: 400 })
  }

  const { data: lead, error } = await supabase.from('leads').insert({
    gym_id:     gym.id,
    first_name: first_name.trim(),
    last_name:  last_name.trim(),
    email:      email.trim().toLowerCase(),
    phone:      phone?.trim() || null,
    notes:      message?.trim() || null,
    status:     'new',
    source:     'public_page',
  }).select('id, lead_token').single()

  if (error || !lead) return NextResponse.json({ error: error?.message ?? 'Fehler' }, { status: 500 })

  // If a class was chosen, book it immediately
  let bookedClass: { title: string; starts_at: string } | null = null
  if (class_id) {
    const { data: cls } = await supabase
      .from('classes')
      .select('id, title, starts_at')
      .eq('id', class_id)
      .eq('gym_id', gym.id)
      .single()
    if (cls) {
      bookedClass = cls
      await supabase.from('lead_bookings').insert({
        lead_id:  lead.id,
        class_id: cls.id,
        status:   'booked',
      })
    }
  }

  const fullName   = `${first_name.trim()} ${last_name.trim()}`
  const portalUrl  = lead.lead_token
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://osss.pro'}/lead/${lead.lead_token}`
    : null

  // Notify gym owner
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
        ${bookedClass ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Slot</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${bookedClass.title} – ${new Date(bookedClass.starts_at).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td></tr>` : ''}
        ${message ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Nachricht</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${message.trim()}</td></tr>` : ''}
      </table>
    `,
    whatsappText: `🥋 Probetraining-Anfrage!\n${fullName}\n${email.trim().toLowerCase()}${phone ? '\n' + phone.trim() : ''}${bookedClass ? '\nSlot: ' + bookedClass.title : ''}\nosss.pro Dashboard`,
  })

  // Send portal link to the lead if Resend is configured and lead has email + token
  const resendKey  = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL
  if (portalUrl && email && resendKey && resendFrom) {
    const slotLine = bookedClass
      ? `<p style="margin:0 0 12px;font-size:14px;color:#374151">
          <strong>Dein gebuchter Slot:</strong> ${bookedClass.title} –
          ${new Date(bookedClass.starts_at).toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })} Uhr
        </p>`
      : ''

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from:    resendFrom,
        to:      [email.trim().toLowerCase()],
        subject: `Dein Probetraining bei ${gym.name} – Portal-Link`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Hallo ${first_name.trim()}! 🥋</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
              Deine Probetraining-Anfrage bei <strong>${gym.name}</strong> ist eingegangen.
              Das Team meldet sich in Kürze bei dir.
            </p>
            ${slotLine}
            <p style="margin:0 0 12px;font-size:14px;color:#374151">
              Über deinen persönlichen Portal-Link kannst du dich für Trainings anmelden und einchecken:
            </p>
            <a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#0f172a;font-weight:700;font-size:14px;border-radius:12px;text-decoration:none">
              Zum Interessenten-Portal →
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">
              Dieser Link ist persönlich und nur für dich bestimmt. Teile ihn nicht mit anderen.
            </p>
          </div>
        `,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
