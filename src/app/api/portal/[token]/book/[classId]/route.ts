import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string; classId: string }> }
) {
  const { token, classId } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = anonClient()
  const { data, error } = await supabase.rpc('book_class_by_token', {
    p_token: token,
    p_class_id: classId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string; classId: string }> }
) {
  const { token, classId } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = anonClient()
  const { data, error } = await supabase.rpc('cancel_booking_by_token', {
    p_token: token,
    p_class_id: classId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // After successful cancellation, notify first waitlisted member
  const supabaseService = serviceClient()

  const { data: waitlisted } = await supabaseService
    .from('class_bookings')
    .select('member_id')
    .eq('class_id', classId)
    .eq('status', 'waitlist')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  // Auto-promote first waitlisted member to confirmed
  if (waitlisted) {
    await supabaseService
      .from('class_bookings')
      .update({ status: 'confirmed' })
      .eq('class_id', classId)
      .eq('member_id', waitlisted.member_id)
      .eq('status', 'waitlist')
  }

  if (waitlisted && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const { data: wlMember } = await supabaseService
      .from('members')
      .select('first_name, email, portal_token')
      .eq('id', waitlisted.member_id)
      .single()

    const { data: cls } = await supabaseService
      .from('classes')
      .select('title, starts_at')
      .eq('id', classId)
      .single()

    if (wlMember?.email && cls) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bjjpunkte.vercel.app'
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: wlMember.email,
          subject: `Du bist drin: ${cls.title} 🥋`,
          html: `<p>Hallo ${wlMember.first_name}!<br><br>Ein Platz im Kurs <strong>${cls.title}</strong> ist frei geworden — du wurdest automatisch von der Warteliste übernommen und bist jetzt <strong>bestätigt</strong>.<br><br><a href="${appUrl}/portal/${wlMember.portal_token}">Zum Mitgliederbereich →</a></p>`,
        }),
      }).catch(() => {})
    }
  }

  return NextResponse.json(data)
}
