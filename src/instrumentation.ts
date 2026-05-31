import * as Sentry from "@sentry/nextjs";
import { registerOTel, OTLPHttpJsonTraceExporter } from "@vercel/otel";

// Sprint Phase-1 (2026-05-31): OTel via @vercel/otel hinzugefuegt. Default-
// Backend: Hyperdx (free 10k spans/day). Konfiguration ueber Env-Vars:
//
//   HYPERDX_API_KEY            — Ingest-Token aus app.hyperdx.io
//   OTEL_EXPORTER_OTLP_ENDPOINT — optional, default https://in-otel.hyperdx.io/v1/traces
//
// Wenn HYPERDX_API_KEY nicht gesetzt → OTel ist deaktiviert (kein Crash,
// silent skip). Damit kann der Repo OHNE Account auf Vercel laufen.

export async function register() {
  // OTel → Hyperdx (oder anderer OTLP-Receiver)
  if (process.env.HYPERDX_API_KEY || process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "https://in-otel.hyperdx.io/v1/traces";

    const headers: Record<string, string> = {};
    if (process.env.HYPERDX_API_KEY) headers.authorization = process.env.HYPERDX_API_KEY;

    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME ?? "osss-web",
      traceExporter: new OTLPHttpJsonTraceExporter({ url: endpoint, headers }),
      // Auto-instruments Next.js, fetch, http. Supabase/Stripe/Resend nutzen
      // alle fetch unter der Haube → automatisch als Child-Spans sichtbar.
    });
  }

  // Pass 20: only init Sentry on Node runtime. Edge init via sentry.edge.config
  // crashed @supabase/supabase-js routes with no usable error message.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
