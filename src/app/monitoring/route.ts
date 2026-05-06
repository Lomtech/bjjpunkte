// Manual Sentry tunnel proxy — bypasses ad-blockers by routing events through
// our own domain. The Sentry plugin's auto-generated tunnel route doesn't work
// in Next.js 16, so we implement it manually per:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/troubleshooting/#using-a-tunnel-proxy
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Lock down which DSN host this tunnel will forward to.
// Change if you ever migrate Sentry orgs.
const SENTRY_HOST = 'o4511339861049344.ingest.de.sentry.io'
const SENTRY_PROJECT_IDS = ['4511339862491216']

export async function POST(req: Request) {
  try {
    const envelope = await req.text()
    const piece = envelope.split('\n')[0]
    const header = JSON.parse(piece)
    const dsn = new URL(header['dsn'])
    const projectId = dsn.pathname.replace(/^\//, '')

    if (dsn.hostname !== SENTRY_HOST) {
      return NextResponse.json({ error: 'invalid sentry host' }, { status: 400 })
    }
    if (!SENTRY_PROJECT_IDS.includes(projectId)) {
      return NextResponse.json({ error: 'invalid sentry project' }, { status: 400 })
    }

    const upstreamUrl = `https://${SENTRY_HOST}/api/${projectId}/envelope/`
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      body: envelope,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
    })

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
    })
  } catch {
    return NextResponse.json({ error: 'tunnel error' }, { status: 500 })
  }
}
