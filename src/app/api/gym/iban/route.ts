/**
 * IBAN-Update-Endpoint mit serverseitiger Verschlüsselung.
 *
 * Warum nicht direkt Supabase-Update aus dem Client?
 *  → Der AES-Key DARF NIEMALS im Browser landen. Daher: Plaintext-IBAN
 *    wird per HTTPS an diesen Endpoint geschickt, hier verschlüsselt,
 *    dann in `bank_iban_enc` geschrieben.
 *
 * Auth: Supabase-Bearer-Token erforderlich (gleiches Muster wie /api/gym/export).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { encryptIban } from '@/lib/encryption'
import { isValidIBAN } from '@/lib/iban'

// AES-256-GCM kommt aus node:crypto → muss in Node-Runtime laufen, nicht Edge.
export const runtime = 'nodejs'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  )
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const { data: { user }, error: userErr } = await authClient(accessToken).auth.getUser(accessToken)
  if (!user || userErr) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body muss JSON sein' }, { status: 400 })
  }

  const ibanInput = (body as { iban?: unknown })?.iban
  if (ibanInput !== null && typeof ibanInput !== 'string') {
    return NextResponse.json(
      { error: 'Feld "iban" muss String oder null sein' },
      { status: 400 },
    )
  }

  // Normalisierung: Leerzeichen + Bindestriche raus, uppercase.
  const cleaned = typeof ibanInput === 'string'
    ? ibanInput.replace(/[\s-]/g, '').toUpperCase()
    : ''

  // Leerer/null-Wert → IBAN entfernen (beide Spalten auf null).
  if (!cleaned) {
    const svc = serviceClient()
    const { error: updateErr } = await svc
      .from('gyms')
      .update({ bank_iban: null, bank_iban_enc: null })
      .eq('owner_id', user.id)
    if (updateErr) {
      return NextResponse.json({ error: 'DB-Update fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, encrypted: false })
  }

  // Validierung über bestehenden Helper (Mod-97 + Länder-Längen-Check).
  if (!isValidIBAN(cleaned)) {
    return NextResponse.json(
      { error: 'IBAN ungültig (Format oder Prüfsumme)' },
      { status: 400 },
    )
  }

  let ciphertext: string
  try {
    ciphertext = encryptIban(cleaned)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Encryption-Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Plaintext-Spalte wird auf null gesetzt — ab sofort lebt die IBAN nur
  // noch verschlüsselt. Lese-Pfad nutzt `getIbanFromGym()` der beides kann.
  const svc = serviceClient()
  const { error: updateErr } = await svc
    .from('gyms')
    .update({ bank_iban: null, bank_iban_enc: ciphertext })
    .eq('owner_id', user.id)
  if (updateErr) {
    return NextResponse.json({ error: 'DB-Update fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, encrypted: true })
}
