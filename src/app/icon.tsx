import { ImageResponse } from 'next/og'

export const size         = { width: 32, height: 32 }
export const contentType  = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#0f172a',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <span
          style={{
            color: '#f59e0b',
            fontSize: 14,
            fontWeight: 900,
            fontStyle: 'italic',
            lineHeight: 1,
            letterSpacing: '-0.5px',
          }}
        >
          oss
        </span>
        {/* Belt stripes */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{ width: 3, height: 3, borderRadius: 9999, background: '#f59e0b', opacity: 0.7 }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
