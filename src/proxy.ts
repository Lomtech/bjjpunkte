import { NextResponse, type NextRequest } from 'next/server'

const WINDOW_MS = 60_000 // 1 Minute
const MAX_REQS  = 30     // pro IP pro Minute

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

const RATE_LIMITED = /^\/(api\/portal|api\/public)\//

export async function proxy(request: NextRequest) {
  if (RATE_LIMITED.test(request.nextUrl.pathname)) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    if (limited(ip)) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte kurz warten.' },
        { status: 429 }
      )
    }
  }
  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
