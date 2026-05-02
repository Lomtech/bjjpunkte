import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS  = 60_000  // 1 Minute
const MAX_REQS   = 30      // pro IP pro Minute

// In-memory — resets bei Cold Start, reicht als DoS-Schutz
const store = new Map<string, { n: number; reset: number }>()

function limited(ip: string): boolean {
  const now = Date.now()
  const e   = store.get(ip)
  if (!e || now > e.reset) {
    store.set(ip, { n: 1, reset: now + WINDOW_MS })
    return false
  }
  e.n++
  return e.n > MAX_REQS
}

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (limited(ip)) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte kurz warten.' },
      { status: 429 }
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/portal/:path*', '/api/public/:path*'],
}
