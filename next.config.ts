import type { NextConfig } from "next";
// import { withSentryConfig } from "@sentry/nextjs";  // Pass 17: disabled — see comment at bottom

const securityHeaders = [
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://browser.sentry-cdn.com",
      "img-src 'self' data: https: blob:",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com https://*.sentry.io",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://youtube.com",
      "media-src 'self' https:",
      "font-src 'self' data:",
      "worker-src blob:",
    ].join('; '),
  },
  // Prevent clickjacking — disallow embedding in iframes
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer policy — don't leak full URLs to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force HTTPS for 2 years, include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Permissions policy — disable access to sensitive browser APIs we don't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), usb=()' },
  // XSS protection (legacy browsers)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;

// Pass 17: withSentryConfig wrapper temporarily disabled. The Sentry webpack
// plugin in @sentry/nextjs ^10.51.0 with Next.js 16.2.4 caused all routes
// matching the proxy.ts RATE_LIMITED regex (api/public/**, api/portal/**,
// api/signup) to be classified as Edge runtime even with explicit
// `runtime = 'nodejs'` exports and vercel.json functions config. In Edge,
// Sentry's instrumentation crashed before the route's try/catch could catch
// it — Vercel returned generic "Internal Server Error" 500.
//
// Sentry is still partially active: instrumentation.ts loads server config
// + edge config dynamically based on NEXT_RUNTIME. The webpack plugin only
// uploaded source maps and applied tree-shaking — disabling it loses prettier
// stack traces but keeps error capture.
//
// Re-enable once @sentry/nextjs has a Next.js 16-compatible release.
