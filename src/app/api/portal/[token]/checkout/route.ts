import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function anonClient() {
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

  const supabase = anonClient()
  const { data, error } = await supabase.rpc('self_checkout_by_token', {
    p_token: token,
    p_attendance_id: attendanceId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
