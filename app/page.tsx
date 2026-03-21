'use client'

import { FormEvent, useState } from 'react'

const features = [
  {
    icon: '📲',
    title: 'WhatsApp-Buchungen',
    text: 'Spieler buchen direkt per WhatsApp. Kein App-Download nötig.',
  },
  {
    icon: '📅',
    title: 'Kalender-Management',
    text: 'Alle Buchungen automatisch im Kalender. Immer aktuell.',
  },
  {
    icon: '🤖',
    title: 'KI-Assistent',
    text: 'Antwortet für dich, erinnert Spieler, verwaltet Stornierungen.',
  },
] as const

function WaitlistForm({
  buttonLabel,
  inputClassName,
}: {
  buttonLabel: string
  inputClassName?: string
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      setStatus('error')
      setMessage('Bitte gib eine E-Mail-Adresse ein.')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message || 'Eintrag fehlgeschlagen.')
      }

      setStatus('success')
      setMessage('Danke. Du stehst jetzt auf der Waitlist.')
      setEmail('')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Eintrag fehlgeschlagen.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="deine@email.de"
          autoComplete="email"
          aria-label="E-Mail-Adresse"
          className={
            inputClassName ||
            'h-14 flex-1 rounded-full border border-white/10 bg-white/5 px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-lime-400 focus:bg-white/8'
          }
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex h-14 items-center justify-center rounded-full bg-lime-400 px-6 text-base font-semibold text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === 'loading' ? 'Sende...' : buttonLabel}
        </button>
      </div>
      <p
        className={`mt-3 min-h-6 text-sm ${
          status === 'error' ? 'text-rose-300' : 'text-slate-400'
        }`}
      >
        {message || 'Kein Spam. Nur Updates zum frühen Zugang.'}
      </p>
    </form>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.22),transparent_24%),radial-gradient(circle_at_85%_20%,rgba(132,204,22,0.15),transparent_22%),linear-gradient(180deg,#050816_0%,#0b1020_48%,#050816_100%)]" />

      <section className="relative px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_40px_140px_-80px_rgba(163,230,53,0.55)] backdrop-blur sm:p-10">
            <div className="grid gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
              <div>
                <div className="inline-flex items-center rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-2 text-sm font-medium text-lime-300">
                  Weniger Admin. Mehr Zeit auf dem Court.
                </div>
                <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
                  Der KI-Assistent für Padel-Trainer
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                  Buchungen, WhatsApp-Kommunikation und Kalender-Management - alles in
                  einem. Vollautomatisch.
                </p>

                <div className="mt-8 max-w-2xl">
                  <WaitlistForm buttonLabel="Frühen Zugang sichern" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-10 hidden h-24 w-24 rounded-full bg-lime-400/20 blur-3xl sm:block" />
                <div className="rounded-[2rem] border border-white/10 bg-[#0b1224] p-4 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.95)]">
                  <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Heute</p>
                        <p className="text-xl font-semibold text-white">Trainer Inbox</p>
                      </div>
                      <div className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-lime-300">
                        Live
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="rounded-[1.5rem] bg-white/5 p-4 text-sm text-slate-200">
                        <p className="font-medium text-white">Neuer Slot gebucht</p>
                        <p className="mt-2 text-slate-400">
                          Fernando hat Mittwoch 18:00 bestätigt. Platz und Spieler sind
                          eingetragen.
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] bg-lime-400 p-4 text-sm text-slate-950">
                        <p className="font-semibold">WhatsApp automatisch beantwortet</p>
                        <p className="mt-2">
                          "Ja, Mittwoch 18:00 ist frei. Ich habe dich direkt eingebucht."
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            Kalender
                          </p>
                          <p className="mt-3 text-2xl font-semibold text-white">7 Slots</p>
                          <p className="mt-1 text-sm text-slate-400">automatisch synchron</p>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            Erinnerungen
                          </p>
                          <p className="mt-3 text-2xl font-semibold text-white">3 heute</p>
                          <p className="mt-1 text-sm text-slate-400">ohne manuellen Aufwand</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-7 backdrop-blur"
              >
                <div className="text-3xl">{feature.icon}</div>
                <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
                  {feature.title}
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-300">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[2.25rem] border border-lime-400/20 bg-lime-400/10 px-6 py-8 shadow-[0_35px_130px_-80px_rgba(163,230,53,0.6)] backdrop-blur sm:px-10 sm:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-300">
                  Waitlist
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Bereit für weniger Chaos?
                </h2>
              </div>
              <div className="w-full max-w-xl">
                <WaitlistForm
                  buttonLabel="Frühen Zugang sichern"
                  inputClassName="h-14 flex-1 rounded-full border border-white/15 bg-[#0b1224] px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-lime-400 focus:bg-[#101933]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
