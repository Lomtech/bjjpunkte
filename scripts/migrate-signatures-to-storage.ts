#!/usr/bin/env tsx
/**
 * Backfill: bestehende Plaintext-Signaturen aus `members.signature_data`
 * (data:image/...;base64,...) ins private Storage-Bucket `member-signatures`
 * verschieben. Nach dem Upload hält die Spalte nur noch den Storage-Path.
 *
 * Idempotent: Datensätze, deren `signature_data` bereits NICHT mit
 * `data:image/` beginnt, werden übersprungen.
 *
 * Voraussetzungen:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - Bucket `member-signatures` existiert (Migration `create_member_signatures_bucket`)
 *
 * Ausführen aus dem Repo-Root:
 *   npx dotenv -e .env.local -- npx tsx scripts/migrate-signatures-to-storage.ts
 *
 * Optional dry-run (zeigt nur was passieren würde, schreibt nichts):
 *   npx dotenv -e .env.local -- npx tsx scripts/migrate-signatures-to-storage.ts --dry-run
 */
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const BUCKET  = 'member-signatures'

function env(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing env var: ${name}`)
    process.exit(1)
  }
  return v
}

interface MemberRow {
  id:             string
  gym_id:         string
  signature_data: string | null
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string; ext: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null
  const mimeType = match[1]
  const base64   = match[2]
  const extMatch = mimeType.match(/^image\/([a-zA-Z0-9]+)/)
  const ext      = extMatch ? extMatch[1].toLowerCase() : 'png'
  try {
    const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
    if (bytes.byteLength === 0) return null
    return { bytes, mimeType, ext }
  } catch {
    return null
  }
}

async function main() {
  const url     = env('NEXT_PUBLIC_SUPABASE_URL')
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, service)

  console.log(`[migrate-signatures] mode=${DRY_RUN ? 'DRY-RUN' : 'WRITE'} bucket=${BUCKET}`)

  // Paginiere durch alle members mit Plaintext-Signatur
  const PAGE = 200
  let offset = 0
  let migrated = 0
  let skipped  = 0
  let failed   = 0
  let total    = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('members')
      .select('id, gym_id, signature_data')
      .like('signature_data', 'data:image/%')
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error('Fetch failed:', error.message)
      process.exit(1)
    }

    const rows = (data ?? []) as MemberRow[]
    if (rows.length === 0) break
    total += rows.length

    for (const row of rows) {
      if (!row.signature_data || !row.signature_data.startsWith('data:image/')) {
        skipped++
        continue
      }

      const parsed = dataUrlToBytes(row.signature_data)
      if (!parsed) {
        console.warn(`  [skip] ${row.id}: no parseable data-URL`)
        skipped++
        continue
      }

      const path = `${row.gym_id}/${row.id}/${Date.now()}.${parsed.ext}`

      if (DRY_RUN) {
        console.log(`  [dry] ${row.id} → ${path} (${parsed.bytes.byteLength} bytes)`)
        migrated++
        continue
      }

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, parsed.bytes, {
          contentType:  parsed.mimeType,
          upsert:       false,
          cacheControl: 'private, max-age=0',
        })
      if (upErr) {
        console.warn(`  [fail] ${row.id} upload: ${upErr.message}`)
        failed++
        continue
      }

      const { error: updErr } = await supabase
        .from('members')
        .update({ signature_data: path })
        .eq('id', row.id)
      if (updErr) {
        console.warn(`  [fail] ${row.id} db update: ${updErr.message} — orphan path: ${path}`)
        failed++
        continue
      }

      migrated++
      console.log(`  [ok]   ${row.id} → ${path}`)
    }

    if (rows.length < PAGE) break
    offset += PAGE
  }

  console.log(`[migrate-signatures] done: total=${total} migrated=${migrated} skipped=${skipped} failed=${failed}`)
  if (failed > 0) process.exit(2)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
