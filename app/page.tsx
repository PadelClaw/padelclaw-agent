import Link from 'next/link'

const plans = [
  {
    name: 'Free',
    price: '€0',
    period: '/Monat',
    description: 'Ideal zum Starten und für erste Trainer-Tests mit echtem WhatsApp-Traffic.',
    channel: 'Shared Nummer',
    calendar: 'Text-Übersicht',
    memory: 'Kein Trainer-Memory',
    href: '/onboarding?plan=free',
    featured: true,
  },
  {
    name: 'Basic',
    price: '€29',
    period: '/Monat',
    description: 'Für Coaches, die ihren Spielern direkt visuelle Kalender-Updates schicken wollen.',
    channel: 'Shared Nummer',
    calendar: 'Kalender + PNG-Bild',
    memory: 'Leichtes Kontext-Memory',
    href: '/onboarding?plan=basic',
    featured: false,
  },
  {
    name: 'Pro',
    price: '€79',
    period: '/Monat',
    description: 'Volle Ausstattung mit eigener Nummer, mehr Kontext und Premium-Onboarding.',
    channel: 'Eigene Nummer',
    calendar: 'iCal-Feed + Web + Bild',
    memory: 'Trainer-Memory aktiv',
    href: '/onboarding?plan=pro',
    featured: false,
  },
] as const

const steps = [
  {
    icon: '⚡',
    title: 'Plan waehlen',
    text: 'Du startest mit Free, Basic oder Pro und landest direkt im Self-Service-Onboarding.',
  },
  {
    icon: '📲',
    title: 'Trainerdaten eintragen',
    text: 'Club, Preise, Verfuegbarkeit und WhatsApp-Nummer in wenigen Minuten hinterlegen.',
  },
  {
    icon: '📅',
    title: 'Agent live schalten',
    text: 'Spieler buchen direkt per WhatsApp und du bekommst strukturierte Updates automatisch.',
  },
] as const

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(134,239,172,0.35),transparent_42%),linear-gradient(180deg,#f7fee7_0%,#ffffff_38%,#f0fdf4_100%)] text-slate-900">
      <section className="px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-green-100 bg-white/85 px-6 py-8 shadow-[0_30px_120px_-50px_rgba(22,163,74,0.45)] backdrop-blur sm:px-10 sm:py-12">
            <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                  Fuer Padel-Coaches, die Buchungen nicht mehr manuell organisieren wollen
                </div>
                <h1 className="mt-6 max-w-xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  🎾 PadelClaw — Dein KI-Buchungsassistent fuer Padel-Training
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
                  Spieler buchen direkt per WhatsApp — du managst alles automatisch.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/onboarding?plan=free"
                    className="inline-flex items-center justify-center rounded-2xl bg-[#16a34a] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-200 transition hover:bg-green-700"
                  >
                    Kostenlos starten
                  </Link>
                  <a
                    href="#pricing"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-green-300 hover:text-green-700"
                  >
                    Demo ansehen
                  </a>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    WhatsApp-first statt extra App
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    Mobile-first fuer Trainer unterwegs
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    In Minuten live statt Wochen Projektzeit
                  </div>
                </div>
              </div>

              <div className="w-full max-w-xl rounded-[2rem] bg-slate-950 p-5 text-white shadow-[0_30px_120px_-60px_rgba(15,23,42,0.8)]">
                <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-800 via-slate-900 to-green-950 p-5">
                  <div className="flex items-center justify-between text-sm text-green-200">
                    <span>PadelClaw Live Demo</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                      WhatsApp
                    </span>
                  </div>
                  <div className="mt-6 space-y-4 text-sm leading-6 text-slate-200">
                    <div className="mr-8 rounded-2xl bg-white/10 px-4 py-3">
                      Hi Coach, ich will morgen um 18:00 trainieren. Hast du einen Slot frei?
                    </div>
                    <div className="ml-8 rounded-2xl bg-[#16a34a] px-4 py-3 text-white">
                      Ja. Morgen 18:00 ist frei. Soll ich dich direkt einbuchen und dem Trainer
                      Bescheid geben?
                    </div>
                    <div className="mr-8 rounded-2xl bg-white/10 px-4 py-3">
                      Perfekt. Bitte buchen.
                    </div>
                    <div className="ml-8 rounded-2xl bg-white px-4 py-3 text-slate-900">
                      Gebucht. Der Trainer hat das Update inklusive Kalender-Uebersicht erhalten.
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-slate-300">
                    "Cecelia bucht ihr Training direkt per WhatsApp — ohne App, ohne Login."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-700">
              Wie es funktioniert
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Drei Schritte bis dein Agent fuer dich organisiert
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_80px_-60px_rgba(15,23,42,0.6)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-lg font-bold text-[#16a34a]">
                  {step.icon}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-700">
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Starte lean und upgrade erst, wenn der Agent fuer dich Umsatz macht
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">
              Alle Plaene inklusive unbegrenzter Buchungen. Unterschied liegt bei Kanal, Kalender
              und Ausstattung.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-[1.75rem] border p-6 ${
                  plan.featured
                    ? 'border-green-300 bg-green-50 shadow-[0_30px_120px_-60px_rgba(22,163,74,0.65)]'
                    : 'border-slate-200 bg-white shadow-[0_20px_80px_-60px_rgba(15,23,42,0.6)]'
                }`}
              >
                {plan.featured ? (
                  <span className="absolute right-6 top-6 rounded-full bg-[#16a34a] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                    Popular
                  </span>
                ) : null}
                <div>
                  <h3 className="text-2xl font-bold text-slate-950">{plan.name}</h3>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-black tracking-tight text-slate-950">
                      {plan.price}
                    </span>
                    <span className="pb-1 text-sm font-medium text-slate-500">{plan.period}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>
                </div>

                <div className="mt-6 space-y-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <span className="font-semibold">Buchungen:</span> Unbegrenzt
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <span className="font-semibold">Kanal:</span> {plan.channel}
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <span className="font-semibold">Kalender:</span> {plan.calendar}
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <span className="font-semibold">Memory:</span> {plan.memory}
                  </div>
                </div>

                <Link
                  href={plan.href}
                  className={`mt-8 inline-flex items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold transition ${
                    plan.featured
                      ? 'bg-[#16a34a] text-white hover:bg-green-700'
                      : 'bg-slate-950 text-white hover:bg-slate-800'
                  }`}
                >
                  Jetzt starten
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-green-100 px-4 py-8 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
        PadelClaw © 2026
      </footer>
    </main>
  )
}
