import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  const swatches = ['#221c18', '#d86b2a', '#d8ad5f', '#4f7d52', '#537a9f', '#f8f3ea']

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 56,
          background:
            'linear-gradient(135deg, #f8f3ea 0%, #eee4d5 48%, #d9c9b5 100%)',
          color: '#241f1a',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 14,
                border: '2px solid #7b6b5d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fffdf8',
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              C
            </div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Colorificio</div>
          </div>
          <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 12 }}>
            {swatches.map((color) => (
              <div key={color} style={{ width: 46, height: 46, background: color }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 84, fontWeight: 760, lineHeight: 0.96 }}>
            Color from media
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.25, color: '#645a50' }}>
            Film. Frames. Web.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            fontSize: 25,
            color: '#4d443b',
          }}
        >
          <span>Video Palette</span>
          <span>Frame Palette</span>
          <span>Plugins</span>
          <span>Extensions</span>
        </div>
      </div>
    ),
    size
  )
}
