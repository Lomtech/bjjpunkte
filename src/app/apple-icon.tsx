import { ImageResponse } from 'next/og'

export const size         = { width: 180, height: 180 }
export const contentType  = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0f172a',
          borderRadius: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        {/* "oss" wordmark */}
        <span
          style={{
            color: '#f59e0b',
            fontSize: 72,
            fontWeight: 900,
            fontStyle: 'italic',
            lineHeight: 1,
            letterSpacing: '-2px',
          }}
        >
          oss
        </span>
        {/* Belt stripes */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 9999,
                background: '#f59e0b',
                opacity: 0.75,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
