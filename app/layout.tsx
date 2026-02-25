import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://colorificio.app'),
  title: {
    default: 'VAC Video Palette',
    template: '%s | VAC Video Palette',
  },
  description:
    'Analyze video colors in real time, build dynamic palettes, and export high-quality videos with synced audio.',
  applicationName: 'VAC Video Palette',
  keywords: [
    'video palette',
    'color extraction',
    'open graph video tool',
    'youtube palette',
    'video color analyzer',
    'vac',
  ],
  creator: 'VAC',
  publisher: 'VAC',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'VAC Video Palette',
    description:
      'Analyze video colors in real time and export high-quality palette videos with audio.',
    siteName: 'VAC Video Palette',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'VAC Video Palette - real-time video color extraction',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VAC Video Palette',
    description:
      'Real-time video color extraction with high-quality exports.',
    images: ['/twitter-image'],
  },
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster theme="system" position="bottom-center" />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
