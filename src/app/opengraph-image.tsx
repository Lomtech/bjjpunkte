import { ImageResponse } from 'next/og'

// Next.js generiert dynamisch ein 1200x630 OG-Image für Social-Media-Shares.
// Wird zur Buildzeit oder beim ersten Request gerendert + gecached.
// Erscheint auf WhatsApp, X, Facebook, LinkedIn, Slack, Discord etc.

export const alt = 'Osss – Die deutsche Gym-Software für Kampfsport'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          padding: '70px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Amber accent corner */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '420px',
            height: '420px',
            background: 'radial-gradient(circle at top right, rgba(251,191,36,0.18) 0%, transparent 65%)',
          }}
        />

        {/* Logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '60px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: '#FBBF24',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ width: '20px', height: '4px', background: '#0a0a0a', borderRadius: '1px' }} />
              <div style={{ width: '20px', height: '4px', background: '#0a0a0a', borderRadius: '1px' }} />
              <div style={{ width: '20px', height: '4px', background: '#0a0a0a', borderRadius: '1px' }} />
            </div>
          </div>
          <span style={{ fontSize: '34px', fontWeight: 900, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
            Osss
          </span>
        </div>

        {/* Main headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', fontSize: '76px', fontWeight: 900, color: '#0a0a0a', lineHeight: 1.0, letterSpacing: '-0.04em' }}>
            Mitglieder. Belts. Beiträge.
          </div>
          <div style={{ display: 'flex', fontSize: '76px', fontWeight: 900, color: '#FBBF24', lineHeight: 1.0, letterSpacing: '-0.04em' }}>
            Live in 10 Minuten.
          </div>
        </div>

        {/* Subhead */}
        <div
          style={{
            display: 'flex',
            fontSize: '26px',
            color: '#71717a',
            marginTop: '36px',
            lineHeight: 1.4,
            maxWidth: '900px',
          }}
        >
          Die deutsche Software für Kampfsport-Gyms — mit Belt-System, DATEV-Export und SEPA.
        </div>

        {/* Footer pills */}
        <div style={{ display: 'flex', gap: '14px', marginTop: 'auto', flexWrap: 'wrap' }}>
          {['🇩🇪 Made in Germany', 'DSGVO + DATEV', '0% Plattformgebühr', '30 Tage gratis'].map(label => (
            <div
              key={label}
              style={{
                display: 'flex',
                background: '#FAFAFA',
                border: '1px solid #E4E4E7',
                borderRadius: '999px',
                padding: '12px 22px',
                fontSize: '20px',
                fontWeight: 600,
                color: '#3F3F46',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* URL bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: '48px',
            right: '80px',
            display: 'flex',
            fontSize: '20px',
            fontWeight: 700,
            color: '#A1A1AA',
            letterSpacing: '0.02em',
          }}
        >
          osss.pro
        </div>
      </div>
    ),
    { ...size }
  )
}
