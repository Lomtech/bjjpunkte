import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

export default withSentryConfig(nextConfig, {
  // Sentry org + project — set via SENTRY_ORG and SENTRY_PROJECT env vars
  // or hardcode here after creating the project at sentry.io
  silent: !process.env.CI,            // suppress build output locally
  widenClientFileUpload: true,        // upload more source maps for better stack traces
  sourcemaps: { disable: false },
  disableLogger: true,                // remove Sentry logger in prod bundle
  automaticVercelMonitors: true,      // track Vercel cron job health in Sentry
})
