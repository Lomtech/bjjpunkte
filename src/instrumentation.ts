import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Pass 20: only init Sentry on Node runtime. Edge init via sentry.edge.config
  // crashed @supabase/supabase-js routes with no usable error message.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
