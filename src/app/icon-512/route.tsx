import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#0f172a',
          borderRadius: 96,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
        }}
      >
        {/* Top accent line (belt style) */}
        <div
          style={{
            width: 180,
            height: 6,
            borderRadius: 9999,
            background: '#f59e0b',
            opacity: 0.4,
          }}
        />
        {/* "oss" wordmark */}
        <span
          style={{
            color: '#f59e0b',
            fontSize: 200,
            fontWeight: 900,
            fontStyle: 'italic',
            lineHeight: 1,
            letterSpacing: '-6px',
            marginTop: -20,
          }}
        >
          oss
        </span>
        {/* Belt stripes */}
        <div style={{ display: 'flex', gap: 20, marginTop: -16 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9999,
                background: '#f59e0b',
                opacity: 0.75,
              }}
            />
          ))}
        </div>
        {/* Bottom label */}
        <span
          style={{
            color: '#64748b',
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginTop: -8,
          }}
        >
          Gym Software
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
