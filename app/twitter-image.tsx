import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 20,
          padding: 60,
          background:
            'radial-gradient(circle at 20% 20%, #1d4ed8 0%, #0f172a 56%, #020617 100%)',
          color: '#f8fafc',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ fontSize: 34, color: '#93c5fd', fontWeight: 700 }}>
          VAC
        </div>
        <div style={{ fontSize: 86, fontWeight: 800, lineHeight: 1 }}>
          Video Palette
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 33,
            color: '#cbd5e1',
            lineHeight: 1.3,
          }}
        >
          <span>Extract colors from videos in real time.</span>
          <span>Export in MP4, MOV, and WebM.</span>
        </div>
      </div>
    ),
    size
  )
}
