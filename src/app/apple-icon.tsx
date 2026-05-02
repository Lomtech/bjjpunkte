import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#FBBF24',
          borderRadius: 38,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingLeft: 42,
          gap: 18,
        }}
      >
        <div style={{ width: 96, height: 14, background: '#09090B', borderRadius: 7 }} />
        <div style={{ width: 64, height: 14, background: '#09090B', borderRadius: 7 }} />
        <div style={{ width: 36, height: 14, background: '#09090B', borderRadius: 7 }} />
      </div>
    ),
    { ...size },
  )
}
