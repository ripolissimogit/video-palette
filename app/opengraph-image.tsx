import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
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
            'linear-gradient(135deg, #0b1220 0%, #0d1f3a 42%, #1e3a8a 100%)',
          color: '#f8fafc',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: '#93c5fd',
          }}
        >
          VAC
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1 }}>
            Video Palette
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.25, color: '#cbd5e1' }}>
            Real-time color extraction and high-quality exports
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            fontSize: 24,
            color: '#e2e8f0',
          }}
        >
          <span>MP4</span>
          <span>•</span>
          <span>MOV</span>
          <span>•</span>
          <span>WebM</span>
        </div>
      </div>
    ),
    size
  )
}
