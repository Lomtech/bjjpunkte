import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  return NextResponse.json(data)
}
