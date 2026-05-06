import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAppUrl } from '@/lib/app-url'
import { cronGuard } from '@/lib/cron-guard'

const PAID_PLANS = ['starter', 'grow', 'pro']

export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const todayKey = new Date().toISOString().split('T')[0]

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ skipped: true, reason: 'Resend not configured' })
  }

  const supabase = createServiceClient()

  // DB-level dedup — safe across multiple serverless instances
  const { error: dedupErr } = await supabase
    .from('cron_runs')
    .insert({ job_name: 'birthday', executed_at: todayKey })
  if (dedupErr) {
    if (dedupErr.code === '23505') {
      return NextResponse.json({ skipped: true, reason: 'already ran today' })
    }
    return NextResponse.json({ error: dedupErr.message }, { status: 500 })
  }
  const appUrl   = getAppUrl()

  const today   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data: eligibleGyms } = await supabase
    .from('gyms')
    .select('id, name')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .in('plan', PAID_PLANS as any)

  if (!eligibleGyms?.length) {
    return NextResponse.json({ date: todayMD, count: 0, reason: 'no eligible gyms' })
  }

  const gymIds = eligibleGyms.map(g => g.id)

  // Per-gym pagination — fair across all tenants. Previous .limit(2000) global meant
  // at >2000 active members across all paying gyms only the first 2000 were ever
  // checked. Now each gym is scanned independently in parallel batches.
  const GYM_BATCH = 25
  const PER_GYM_LIMIT = 5000
  type BirthdayMember = {
    id: string; first_name: string; last_name: string; email: string | null;
    date_of_birth: string; gym_id: string; portal_token: string | null;
  }
  const birthdayMembers: BirthdayMember[] = []
  for (let i = 0; i < gymIds.length; i += GYM_BATCH) {
    const chunk = gymIds.slice(i, i + GYM_BATCH)
    const results = await Promise.all(chunk.map(async gid => {
      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, date_of_birth, gym_id, portal_token')
        .eq('gym_id', gid)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null)
        .not('email', 'is', null)
        .limit(PER_GYM_LIMIT)
      return ((data ?? []) as BirthdayMember[]).filter(m => {
        if (!m.date_of_birth) return false
        return (m.date_of_birth as string).slice(5, 10) === todayMD
      })
    }))
    for (const r of results) birthdayMembers.push(...r)
  }

  const gymMap = new Map(eligibleGyms.map(g => [g.id, g.name]))
  let sent   = 0
  let failed = 0
  const errors: string[] = []

  const membersToEmail = (birthdayMembers as {
    first_name: string; email: string | null; date_of_birth: string; gym_id: string; portal_token: string | null
  }[]).filter(m => !!m.email)

  const EMAIL_BATCH = 10
  for (let i = 0; i < membersToEmail.length; i += EMAIL_BATCH) {
    const chunk = membersToEmail.slice(i, i + EMAIL_BATCH)
    await Promise.all(chunk.map(async member => {
      const age       = today.getFullYear() - parseInt(member.date_of_birth.slice(0, 4))
      const gymName   = gymMap.get(member.gym_id) ?? 'Dein Gym'
      const portalUrl = member.portal_token ? `${appUrl}/portal/${member.portal_token}` : null
      const fromDomain = process.env.RESEND_FROM_EMAIL!.split('@')[1] ?? 'osss.pro'
      const listUnsubscribe = portalUrl
        ? `<${portalUrl}>, <mailto:unsubscribe@${fromDomain}>`
        : `<mailto:unsubscribe@${fromDomain}>`

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to:   member.email,
            subject: `Alles Gute zum Geburtstag, ${member.first_name}!`,
            headers: { 'List-Unsubscribe': listUnsubscribe },
            html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px">
        <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center">
          <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${gymName}</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Alles Gute, ${member.first_name}!</p>
          <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
            Das gesamte Team von ${gymName} wünscht dir alles Gute zu deinem ${age}. Geburtstag.
            Wir freuen uns auf viele weitere Trainings mit dir auf der Matte.
          </p>
          <p style="margin:0;font-size:15px;color:#64748b">Oss! 🥋</p>
          <p style="font-size:11px;color:#9ca3af;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:12px">
            Du erhältst diese E-Mail als Mitglied von ${gymName}.
            ${portalUrl ? `<a href="${portalUrl}" style="color:#9ca3af">Einstellungen im Portal</a>` : ''}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
          }),
        })
        if (res.ok) {
          sent++
        } else {
          const body = await res.text().catch(() => '')
          failed++
          const msg = `Birthday email to ${member.email} (gym ${member.gym_id}): HTTP ${res.status} ${body}`
          errors.push(msg)
          console.error('[cron/birthday]', msg)
        }
      } catch (err) {
        failed++
        const msg = `Birthday email to ${member.email} (gym ${member.gym_id}): ${String(err)}`
        errors.push(msg)
        console.error('[cron/birthday]', msg)
      }
    }))
  }

  return NextResponse.json({
    ok:         errors.length === 0,
    date:       todayMD,
    found:      birthdayMembers.length,
    sent,
    failed,
    errors:     errors.length > 0 ? errors : undefined,
  })
}
