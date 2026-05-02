import { ImageResponse } from 'next/og'

export const size        = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#FBBF24',
          borderRadius: 7,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingLeft: 7,
          gap: 4,
        }}
      >
        <div style={{ width: 18, height: 3, background: '#09090B', borderRadius: 2 }} />
        <div style={{ width: 12, height: 3, background: '#09090B', borderRadius: 2 }} />
        <div style={{ width: 7,  height: 3, background: '#09090B', borderRadius: 2 }} />
      </div>
    ),
    { ...size },
  )
}
