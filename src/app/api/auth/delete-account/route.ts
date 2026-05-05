import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const auth = authClient(accessToken)
  const { data: { user } } = await auth.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const svc = serviceClient()

  const errors: string[] = []

  try {
    // Fetch the gym owned by this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gym } = await svc.from('gyms')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (gym) {
      const gymId = gym.id

      // Delete child tables in dependency order — continue on error, collect failures
      const steps: Array<{ table: string; query: () => PromiseLike<{ error: unknown }> }> = [
        { table: 'attendance',        query: () => svc.from('attendance').delete().eq('gym_id', gymId) },
        { table: 'class_bookings',    query: () => svc.from('class_bookings').delete().eq('gym_id', gymId) },
        { table: 'lead_bookings',     query: () => svc.from('lead_bookings').delete().eq('gym_id', gymId) },
        { table: 'belt_promotions',   query: () => svc.from('belt_promotions').delete().eq('gym_id', gymId) },
        { table: 'membership_plans',  query: () => svc.from('membership_plans').delete().eq('gym_id', gymId) },
        { table: 'gym_announcements', query: () => svc.from('gym_announcements').delete().eq('gym_id', gymId) },
        { table: 'posts',             query: () => svc.from('posts').delete().eq('gym_id', gymId) },
        { table: 'leads',             query: () => svc.from('leads').delete().eq('gym_id', gymId) },
        { table: 'classes',           query: () => svc.from('classes').delete().eq('gym_id', gymId) },
        { table: 'members',           query: () => svc.from('members').delete().eq('gym_id', gymId) },
        { table: 'gym_staff',         query: () => svc.from('gym_staff').delete().eq('gym_id', gymId) },
      ]

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        try {
          const { error: stepError } = await step.query()
          if (stepError) {
            console.error(`[delete-account] failed at step ${i + 1} (${step.table}):`, stepError)
            errors.push(`${step.table}: ${(stepError as { message?: string }).message ?? String(stepError)}`)
          }
        } catch (err) {
          console.error(`[delete-account] failed at step ${i + 1} (${step.table}):`, err)
          errors.push(`${step.table}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      // Delete payments — table may not exist
      try {
        const { error: paymentsError } = await svc.from('payments').delete().eq('gym_id', gymId)
        if (paymentsError) {
          console.error('[delete-account] failed at step payments:', paymentsError)
          errors.push(`payments: ${(paymentsError as { message?: string }).message ?? String(paymentsError)}`)
        }
      } catch {
        // table may not exist — ignore
      }

      // Delete the gym itself
      try {
        const { error: gymError } = await svc.from('gyms').delete().eq('id', gymId)
        if (gymError) {
          console.error('[delete-account] failed at step gyms:', gymError)
          errors.push(`gyms: ${(gymError as { message?: string }).message ?? String(gymError)}`)
        }
      } catch (err) {
        console.error('[delete-account] failed at step gyms:', err)
        errors.push(`gyms: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Delete the auth user only if all previous deletes succeeded
    const { error: deleteUserError } = await svc.auth.admin.deleteUser(user.id)
    if (deleteUserError) {
      if (errors.length > 0) {
        return NextResponse.json({ success: false, errors: [...errors, `auth: ${deleteUserError.message}`] }, { status: 500 })
      }
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 })
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
