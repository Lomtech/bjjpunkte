import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

/**
 * Top-Level-Error-Handler für API-Routes.
 *
 * Hintergrund: Next.js fängt unhandled exceptions in Route-Handlern ab und
 * returnt 500 mit leerem Body. Das hat den `/api/track`-Bug verursacht — der
 * Frontend-Code konnte nicht unterscheiden zwischen "rate-limited" und
 * "server-crashed". Außerdem ging der Stacktrace verloren ohne Sentry.
 *
 * Dieser Wrapper:
 *   - fängt jede thrown Exception
 *   - tagged Sentry-Event mit `api.route` für Filtering
 *   - logged für Vercel-Console
 *   - returnt strukturierte 500-Response mit Error-Message
 *
 * Bewusst SEHR simpel gehalten:
 *   - keine Mittellschicht für Auth (Auth-Funktionen wie requireAdmin bleiben
 *     innen — sie returnen direkt eine Response bei Fehlern, keine Exceptions)
 *   - keine Body-Validierung (Zod etc.) — wird Route-by-Route gemacht
 *
 * Nutzung:
 *
 *   export const POST = withApiHandler('attendance.create', async (req) => {
 *     // bestehende Logik, kann throw
 *     return NextResponse.json({ ok: true })
 *   })
 *
 * Method-Signatur erlaubt sowohl `(req)` als auch `(req, ctx)` für dynamische
 * Routes mit [params] (wird durch TypeScript-Inferenz transparent).
 */
// Bewusst weit gefasst: NextResponse extends Response, aber TS-Narrowing
// in arrow-functions ist strikter als bei `async function`. Wir nehmen
// Response-Subtypen + ggf. undefined (für früh-Returns die TS nicht sieht)
// und konvertieren am Ende zu garantierter Response.
type AnyResponse = Response
type Handler<Ctx = unknown> = (req: Request, ctx: Ctx) => Promise<AnyResponse | undefined | void>

export function withApiHandler<Ctx = unknown>(
  routeName: string,
  handler: Handler<Ctx>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req: Request, ctx: Ctx) => {
    try {
      const res = await handler(req, ctx)
      if (res) return res
      // Handler hat undefined/void retourniert — sollte nicht passieren,
      // aber wir geben einen no-content statt 500 zurück damit der Client
      // einen lesbaren Response sieht.
      return new NextResponse(null, { status: 204 })
    } catch (err) {
      Sentry.captureException(err, {
        tags: {
          'api.route': routeName,
          type: 'api-failure',
        },
      })
      console.error(`[api:${routeName}] uncaught error:`, err)
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: 'Server error', route: routeName, detail: message },
        { status: 500 }
      )
    }
  }
}
