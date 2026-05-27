import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/trainer/members
//
// Feature #7 (Sprint 2026-05-27): Trainer-Scope.
//
// Trainer-spezifischer Members-Endpoint: liefert nur Sport-relevante Spalten
// über die `members_trainer_view`. KEIN Klartext-IBAN, kein Stripe, keine
// Adresse, keine Email/Telefon (außer parent_phone bei Minderjährigen).
//
// Auth: Cookie-Session. Trainer muss in gym_staff mit role='trainer' und
// accepted_at IS NOT NULL stehen. RLS auf members_trainer_view greift via
// View-Definition (SECURITY INVOKER).

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const url = new URL(req.url)
  const gymId = url.searchParams.get('gym_id')

  // Welches Gym ist der Trainer? Wenn nicht explizit gegeben: erstes wo er Trainer ist.
  let effectiveGymId = gymId
  if (!effectiveGymId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staff } = await (supabase.from('gym_staff') as any)
      .select('gym_id')
      .eq('user_id', user.id)
      .eq('role', 'trainer')
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (!staff) {
      return NextResponse.json({ error: 'Du bist kein Trainer in einem Gym' }, { status: 403 })
    }
    effectiveGymId = staff.gym_id as string
  }

  // members_trainer_view liefert nur safe-columns; RLS prüft has_gym_role(gym, user, 'trainer')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('members_trainer_view') as any)
    .select('*')
    .eq('gym_id', effectiveGymId)
    .order('last_name', { ascending: true })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    gym_id: effectiveGymId,
    members: data ?? [],
    note: 'Trainer-Sicht: limited columns. KEIN IBAN/Adresse/Telefon — nur Sport-Daten + Notes.',
  })
}
