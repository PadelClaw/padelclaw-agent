'use client'

import { FormEvent, useEffect, useState } from 'react'

const features = [
  {
    icon: '📲',
    title: 'WhatsApp-Buchungen',
    text: 'Spieler buchen direkt per WhatsApp. Keine App nötig.',
  },
  {
    icon: '📅',
    title: 'Kalender-Management',
    text: 'Alle Termine automatisch erfasst und verwaltet.',
  },
  {
    icon: '🤖',
    title: 'KI-Assistent',
    text: 'Antwortet für dich, erinnert Spieler, verwaltet Stornierungen.',
  },
] as const

const bookingMessages = [
  {
    align: 'left',
    tone: 'player',
    text: 'Hey, kann ich Donnerstag 18 Uhr buchen? 🎾',
  },
  {
    align: 'right',
    tone: 'agent',
    text: 'Hi Fernando! Donnerstag 18:00 ist frei ✅',
  },
  {
    align: 'right',
    tone: 'agent',
    text: 'Soll ich reservieren?',
  },
  {
    align: 'left',
    tone: 'player',
    text: 'Ja bitte! 👍',
  },
  {
    align: 'right',
    tone: 'agent',
    text: '🎾 Gebucht! Bis Donnerstag!',
  },
] as const

const reminderMessages = [
  {
    align: 'right',
    tone: 'agent',
    text: '📅 Morgen früh: 3 Buchungen',
  },
  {
    align: 'right',
    tone: 'agent',
    text: 'Fernando 18:00, Maria 19:30, Luis 21:00',
  },
  {
    align: 'right',
    tone: 'agent',
    text: 'Alles bestätigt ✅',
  },
] as const

function AnimatedPhoneMockup() {
  const [sequence, setSequence] = useState<'booking' | 'reminder'>('booking')
  const [visibleMessages, setVisibleMessages] = useState(0)

  useEffect(() => {
    let isCancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const schedule = (callback: () => void, delay: number) => {
      const timeout = setTimeout(() => {
        if (!isCancelled) {
          callback()
        }
      }, delay)
      timeouts.push(timeout)
    }

    const runBooking = () => {
      setSequence('booking')
      setVisibleMessages(0)

      bookingMessages.forEach((_, index) => {
        schedule(() => setVisibleMessages(index + 1), 450 + index * 800)
      })

      schedule(runReminder, 6750)
    }

    const runReminder = () => {
      setSequence('reminder')
      setVisibleMessages(0)

      reminderMessages.forEach((_, index) => {
        schedule(() => setVisibleMessages(index + 1), 450 + index * 900)
      })

      schedule(runBooking, 5550)
    }

    runBooking()

    return () => {
      isCancelled = true
      timeouts.forEach((timeout) => clearTimeout(timeout))
    }
  }, [])

  const messages = sequence === 'booking' ? bookingMessages : reminderMessages
  const title = sequence === 'booking' ? 'PadelClaw 🤖' : 'PadelClaw an Trainer'

  return (
    <>
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chat-bubble-enter {
          animation: fade-in-up 0.45s ease-out both;
        }
      `}</style>

      <div className="relative w-full max-w-[260px] rounded-[2.8rem] border border-white/10 bg-[#0a0f1c] p-2 shadow-[0_30px_100px_-60px_rgba(163,230,53,0.3)]">
        <div className="overflow-hidden rounded-[2.35rem] bg-[#0b141a]">
          <div className="bg-[#25d366] px-4 py-4 text-slate-950">
            <p className="text-[15px] font-semibold">{title}</p>
            <div className="mt-1 flex items-center gap-2 text-xs font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-green-900/80" />
              <span>online</span>
            </div>
          </div>

          <div className="flex h-[404px] flex-col justify-between bg-[linear-gradient(180deg,#efeae2_0%,#e6dfd6_100%)]">
            <div className="flex-1 space-y-3 px-3 py-4 text-[13px] leading-5 text-slate-800">
              {messages.slice(0, visibleMessages).map((message, index) => (
                <div
                  key={`${sequence}-${index}`}
                  className={`chat-bubble-enter flex ${
                    message.align === 'right' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[84%] rounded-[1.2rem] px-3 py-2 shadow-sm ${
                      message.align === 'right'
                        ? 'rounded-br-md bg-[#dcf8c6]'
                        : 'rounded-bl-md bg-[#e5e7eb]'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 bg-[#f7f7f7] px-4 py-3">
              <div className="mx-auto flex h-9 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] text-slate-400 shadow-sm">
                Nachricht...
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

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
                <div className="flex justify-center rounded-[2rem] border border-white/10 bg-[#0b1224] px-6 py-8 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.95)]">
                  <AnimatedPhoneMockup />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="relative px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2.25rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_35px_130px_-90px_rgba(163,230,53,0.45)] backdrop-blur sm:p-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-300">
                Features
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Was PadelClaw für dich erledigt
              </h2>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-[2rem] border border-white/10 bg-[#09101f] p-7 shadow-[0_30px_100px_-80px_rgba(163,230,53,0.35)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400 text-3xl shadow-[0_20px_50px_-30px_rgba(163,230,53,0.9)]">
                    <span aria-hidden="true">{feature.icon}</span>
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
                    {feature.title}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-slate-300">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
