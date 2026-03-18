import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'PadelClaw Agent V2' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="de"><body>{children}</body></html>
}
