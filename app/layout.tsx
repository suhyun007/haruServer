import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HaruFit Server',
  description: 'HaruFit Diet App Server',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

