'use client'

import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const agentNumber = '+1 555 186 3357'

export default function OnboardingSuccessClient({
  trainerId,
}: {
  trainerId: string | null
}) {
  const [copied, setCopied] = useState(false)
  const shareUrl = useMemo(() => 'https://wa.me/15551863357', [])

  async function copyNumber() {
    await navigator.clipboard.writeText(agentNumber)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md rounded-[32px] bg-white p-6 shadow-[0_24px_90px_-44px_rgba(22,163,74,0.5)] ring-1 ring-green-100">
        <div className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          Verifiziert
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Login erfolgreich
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Deine WhatsApp-Nummer ist bestätigt. Teile jetzt die Agent-Nummer direkt mit deinem Team oder öffne WhatsApp über den QR-Code.
        </p>

        {trainerId ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Trainer-ID: <span className="font-semibold text-slate-900">#{trainerId}</span>
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl bg-green-600 p-5 text-white">
          <p className="text-sm text-green-100">Agent-WhatsApp-Nummer</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{agentNumber}</p>
          <button
            type="button"
            onClick={copyNumber}
            className="mt-4 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            {copied ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex justify-center rounded-2xl bg-white p-4">
            <QRCodeSVG value={shareUrl} size={192} includeMargin />
          </div>
          <p className="mt-4 text-center text-sm text-slate-600">
            QR scannen und den Agent direkt in WhatsApp öffnen.
          </p>
        </div>
      </div>
    </main>
  )
}
