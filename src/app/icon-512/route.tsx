import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#FBBF24',
          borderRadius: 96,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingLeft: 120,
          gap: 44,
        }}
      >
        <div style={{ width: 272, height: 40, background: '#09090B', borderRadius: 20 }} />
        <div style={{ width: 182, height: 40, background: '#09090B', borderRadius: 20 }} />
        <div style={{ width: 100, height: 40, background: '#09090B', borderRadius: 20 }} />
      </div>
    ),
    { width: 512, height: 512 },
  )
}
