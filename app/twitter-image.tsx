import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function TwitterImage() {
  const swatches = ['#221c18', '#d86b2a', '#d8ad5f', '#4f7d52', '#537a9f', '#f8f3ea']

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 28,
          padding: 60,
          background:
            'linear-gradient(135deg, #17130f 0%, #241f1a 56%, #3a2c20 100%)',
          color: '#f4eee5',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              border: '2px solid #54483d',
              background: '#211c18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Colorificio</div>
        </div>
        <div style={{ fontSize: 86, fontWeight: 760, lineHeight: 0.96 }}>
          Color from media
        </div>
        <div style={{ fontSize: 34, color: '#d8cec0', lineHeight: 1.25 }}>
          Film. Frames. Web.
        </div>
        <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 12 }}>
          {swatches.map((color) => (
            <div key={color} style={{ width: 54, height: 44, background: color }} />
          ))}
        </div>
      </div>
    ),
    size
  )
}
