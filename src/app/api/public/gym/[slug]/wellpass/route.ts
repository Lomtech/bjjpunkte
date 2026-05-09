import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyGym } from '@/lib/notify'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/public/gym/[slug]/wellpass
 *
 * Onboarding-Endpoint für Anbieter-Mitglieder (Wellpass / Hansefit / EGYM /
 * Urban Sports Club). Unterscheidet sich vom regulären `/signup`:
 *  - Kein SEPA — der Anbieter zahlt
 *  - Kürzerer Vertrag (4 Punkte: Verhalten, §823, Haftung, Hausordnung)
 *  - Volljährigkeits-Hard-Check (Anbieter-Vertrag verbietet Minderjährige)
 *
 * Body: { source ('wellpass'|'hansefit'|'egym'|'urban_sports'),
 *         first_name, last_name, email, date_of_birth, phone?,
 *         contract_text, contract_accepted: true }
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Slug-Hardening (Audit 2026-05-09 / B-input-cap): Format + Length-Cap.
  if (!slug || typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Ungültiger Slug' }, { status: 400 })
  }
  const supabase = serviceClient()

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (!gym) return NextResponse.json({ error: 'Studio nicht gefunden' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const {
    source,
    first_name, last_name, email, phone,
    date_of_birth,
    contract_text,
    contract_accepted,
  } = body as Record<string, unknown>

  // Input-Length-Caps gegen Body-Bloat. contract_text ist im Original schon
  // auf 5000 begrenzt (siehe Insert unten); first/last/email kapseln wir hier.
  if (
    (typeof first_name === 'string' && first_name.length > 200) ||
    (typeof last_name  === 'string' && last_name.length  > 200) ||
    (typeof email      === 'string' && email.length      > 320) ||
    (typeof phone      === 'string' && phone.length      > 50)
  ) {
    return NextResponse.json({ error: 'Eingabe zu lang' }, { status: 400 })
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const VALID_SOURCES = new Set(['wellpass', 'hansefit', 'egym', 'urban_sports'])
  const sourceVal = typeof source === 'string' && VALID_SOURCES.has(source) ? source : null
  if (!sourceVal) return NextResponse.json({ error: 'Ungültige Anbieter-Quelle' }, { status: 400 })

  if (typeof first_name !== 'string' || !first_name.trim()) {
    return NextResponse.json({ error: 'Vorname fehlt' }, { status: 400 })
  }
  if (typeof last_name !== 'string' || !last_name.trim()) {
    return NextResponse.json({ error: 'Nachname fehlt' }, { status: 400 })
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Gültige E-Mail erforderlich' }, { status: 400 })
  }
  if (contract_accepted !== true) {
    return NextResponse.json({ error: 'Vereinbarung muss akzeptiert werden' }, { status: 400 })
  }
  if (typeof date_of_birth !== 'string' || !date_of_birth) {
    return NextResponse.json({ error: 'Geburtsdatum erforderlich (Volljährig-Prüfung)' }, { status: 400 })
  }

  // Volljährigkeits-Hard-Check (Wellpass etc. = nur Erwachsene per Anbieter-Vertrag)
  const dob = new Date(date_of_birth)
  if (Number.isNaN(dob.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Geburtsdatum' }, { status: 400 })
  }
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const md = today.getMonth() - dob.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age--
  if (age < 18) {
    return NextResponse.json({
      error: 'Anbieter-Mitgliedschaften (Wellpass / Hansefit / EGYM) sind nur für Erwachsene möglich.',
    }, { status: 400 })
  }

  // Duplikat-Check
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('gym_id', gym.id)
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 409 })
  }

  // ── eIDAS-Doku ────────────────────────────────────────────────────────────
  const forwarded = req.headers.get('x-forwarded-for')
  const consentIp = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? null)
  const consentUa = req.headers.get('user-agent') ?? null
  const now       = new Date().toISOString()
  const consentText = `Vereinbarung für Anbieter-Mitglieder (${sourceVal}) bei ${gym.name} elektronisch akzeptiert am ${new Date().toLocaleString('de-DE')}.`

  // ── Insert ────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member, error } = await (supabase.from('members') as any).insert({
    gym_id:                  gym.id,
    first_name:              first_name.trim(),
    last_name:               last_name.trim(),
    email:                   email.toLowerCase().trim(),
    phone:                   typeof phone === 'string' ? phone.trim() || null : null,
    date_of_birth:           date_of_birth,
    membership_source:       sourceVal,
    is_active:               true,
    onboarding_status:       'complete',
    join_date:               now.substring(0, 10),
    belt:                    'white',
    stripes:                 0,
    contract_signed_at:      now,
    consent_ip:              consentIp,
    consent_user_agent:      consentUa,
    consent_text:            consentText,
    signature_data:          typeof contract_text === 'string' ? null : null,
    gdpr_consent_at:         now,
  }).select('id').single()

  if (error) {
    console.error('Wellpass-onboarding insert error:', error)
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }

  // ── Notify Owner ──────────────────────────────────────────────────────────
  const fullName = `${first_name.trim()} ${last_name.trim()}`
  const sourceLabel = ({
    wellpass: 'Wellpass', hansefit: 'Hansefit', egym: 'EGYM Wellpass', urban_sports: 'Urban Sports Club',
  } as Record<string, string>)[sourceVal] ?? sourceVal

  await notifyGym({
    gymId: gym.id,
    subject: `Neue ${sourceLabel}-Anmeldung: ${fullName}`,
    html: `
      <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Neue ${sourceLabel}-Anmeldung 🎉</p>
      <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
        <strong>${fullName}</strong> hat die Anbieter-Vereinbarung für <strong>${sourceLabel}</strong>
        elektronisch unterschrieben. Mitglied ist bereits aktiv (kein SEPA — der Anbieter zahlt).
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;width:120px">E-Mail</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${email.toLowerCase().trim()}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Telefon</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${typeof phone === 'string' ? phone.trim() : ''}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#6b7280">Quelle</td><td style="padding:8px 0;font-weight:600">${sourceLabel}</td></tr>
      </table>
    `,
    whatsappText: `🎉 Neue ${sourceLabel}-Anmeldung!\n${fullName}\n${email.toLowerCase().trim()}\n\nhttps://www.osss.pro/dashboard`,
  })

  return NextResponse.json({ success: true, memberId: (member as { id: string }).id })
}
