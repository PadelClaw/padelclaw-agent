import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'PadelClaw — Der KI-Assistent für Padel-Trainer' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="de"><body>{children}</body></html>
}
