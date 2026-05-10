// Footgun-Verhinderung: dieser Import wirft zur Build-Zeit wenn diese Datei
// versehentlich von einer Client-Komponente importiert würde. Andernfalls
// landet SUPABASE_SERVICE_ROLE_KEY (RLS-Bypass) im Browser-Bundle und ist
// für jeden lesbar. Audit 2026-05-10: bisher nicht passiert, aber ein einziger
// versehentlicher import von '@/lib/supabase/service' in Client-Code würde
// die ganze DB öffnen.
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
