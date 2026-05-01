import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const { attendanceId } = await req.json()
  if (!attendanceId) return NextResponse.json({ error: 'attendanceId fehlt' }, { status: 400 })

  const supabase = adminClient()

  // Verify token belongs to a valid member
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('portal_token', token)
    .single()

  if (!member) return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 })

  // Verify the attendance record belongs to this member
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('id')
    .eq('id', attendanceId)
    .eq('member_id', member.id)
    .single()

  if (error || !attendance) {
    return NextResponse.json({ error: 'Anwesenheit nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
