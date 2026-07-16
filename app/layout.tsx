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
    default: 'Colorificio',
    template: '%s | Colorificio',
  },
  description:
    'Elegant color tools for film, frames, browser capture, and publishing workflows.',
  applicationName: 'Colorificio',
  keywords: [
    'colorificio',
    'color tools',
    'video palette',
    'frame palette',
    'media color',
    'browser palette',
    'wordpress palette',
    'color extraction',
  ],
  creator: 'Colorificio',
  publisher: 'Colorificio',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Colorificio',
    description:
      'Color from film, frames, and the web.',
    siteName: 'Colorificio',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Colorificio - color tools for modern media',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Colorificio',
    description:
      'Color from film, frames, and the web.',
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
