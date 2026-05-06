import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function GET() {
  Sentry.captureException(new Error('Sentry Server-Test von osss.pro API — alles funktioniert!'))
  return NextResponse.json({ ok: true, message: 'Sentry Server-Event gesendet' })
}
