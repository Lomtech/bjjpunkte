/**
 * Member-Signaturen — Storage-Helper.
 *
 * DSGVO Art. 32 (Sicherheit der Verarbeitung): Signaturen liegen NICHT mehr
 * als Plaintext-base64 in `members.signature_data`, sondern als binäre PNGs
 * im privaten Storage-Bucket `member-signatures`. Spalte `signature_data`
 * speichert nur noch den Storage-Path.
 *
 * Backwards-compat: alter Plaintext (`data:image/...`) wird beim Lesen weiterhin
 * akzeptiert, damit Bestandsverträge bis zum Backfill weiter rendern.
 */
import { createServiceClient } from '@/lib/supabase/service'

const BUCKET = 'member-signatures'

/**
 * Lädt eine data-URL-Signatur als binäres PNG zu Storage hoch und gibt den
 * Storage-Path zurück. Bei Eingaben, die keine data-URL sind, oder bei
 * Upload-Fehlern: `null` (Aufrufer entscheidet, ob Fallback).
 */
export async function uploadSignature(
  gymId: string,
  memberId: string,
  dataUrl: string | null | undefined,
): Promise<string | null> {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  if (!dataUrl.startsWith('data:image/')) return null

  // data:image/png;base64,iVBORw0...
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  const mimeType = match[1]
  const base64   = match[2]

  // Extension aus mimeType ableiten (image/png → png, image/svg+xml → svg)
  const extMatch = mimeType.match(/^image\/([a-zA-Z0-9]+)/)
  const ext      = extMatch ? extMatch[1].toLowerCase() : 'png'

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
  } catch {
    return null
  }
  if (bytes.byteLength === 0) return null

  const path = `${gymId}/${memberId}/${Date.now()}.${ext}`

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: mimeType,
        upsert:      false,
        cacheControl: 'private, max-age=0',
      })
    if (error) {
      console.warn('[signature-storage] upload failed:', error.message)
      return null
    }
    return path
  } catch (e: unknown) {
    console.warn('[signature-storage] upload exception:', (e as Error)?.message)
    return null
  }
}

/**
 * Resolved den `signature_data`-Wert (Storage-Path ODER Legacy-data-URL) zu
 * einer data-URL, die der PDF-Renderer in `<Image src=...>` einbetten kann.
 *
 * - `null` / leer → null (PDF rendert dann signatureLine statt Bild)
 * - `data:image/...` → unverändert (Legacy-Plaintext, noch nicht migriert)
 * - sonst → Storage-Path: Bytes herunterladen, als data-URL zurückgeben
 *
 * Fehlerfall: Logging + null (PDF-Generierung soll nicht crashen).
 */
export async function loadSignatureForPdf(value: string | null | undefined): Promise<string | null> {
  if (!value || typeof value !== 'string') return null
  if (value.startsWith('data:image/')) return value

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage.from(BUCKET).download(value)
    if (error || !data) {
      console.warn('[signature-storage] download failed for path', value, error?.message)
      return null
    }
    const buf = Buffer.from(await data.arrayBuffer())
    if (buf.byteLength === 0) return null
    // Content-Type aus Path-Extension; fallback image/png
    const extMatch = value.toLowerCase().match(/\.([a-z0-9]+)$/)
    const ext      = extMatch ? extMatch[1] : 'png'
    const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
    return `data:${mimeType};base64,${buf.toString('base64')}`
  } catch (e: unknown) {
    console.warn('[signature-storage] download exception:', (e as Error)?.message)
    return null
  }
}

export const SIGNATURE_BUCKET = BUCKET
