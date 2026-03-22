'use client';

import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useMemo, useRef, useState } from 'react';

const TOTAL_STEPS = 4;
const PERSONALITY_OPTIONS = [
  {
    value: 'professional',
    title: '🎯 Professional',
    description: 'Klar, sachlich und effizient. Für Trainer, die einen geradlinigen Stil wollen.',
  },
  {
    value: 'friendly',
    title: '🤝 Friendly Coach',
    description: 'Warm, locker und nahbar. Der beste Default für eine natürliche WhatsApp-Kommunikation.',
  },
  {
    value: 'motivator',
    title: '💪 Motivator',
    description: 'Energetisch und sporty. Mehr Drive und mehr Padel-Vibe in jeder Antwort.',
  },
] as const;

type Personality = (typeof PERSONALITY_OPTIONS)[number]['value'];

function normalizePhone(prefix: string, phone: string) {
  const digits = `${prefix}${phone}`.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export default function BetaPage() {
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState<Personality>('friendly');
  const [region, setRegion] = useState('');
  const [club, setClub] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode] = useState('+49');
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpRequested, setOtpRequested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const phone = useMemo(
    () => normalizePhone(countryCode, whatsAppNumber),
    [countryCode, whatsAppNumber],
  );
  const otpCode = useMemo(() => otpDigits.join(''), [otpDigits]);
  const progress = (step / TOTAL_STEPS) * 100;

  function validateProfile() {
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein.');
      return false;
    }

    setError('');
    return true;
  }

  async function handleSendOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    if (phone.replace(/\D/g, '').length < 8) {
      setError('Bitte gib eine gültige WhatsApp-Nummer ein.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, phone }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Code konnte nicht versendet werden.');
      }

      setOtpRequested(true);
      setOtpDigits(['', '', '', '', '', '']);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Code konnte nicht versendet werden.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    if (otpCode.length !== 6) {
      setError('Bitte gib den 6-stelligen Code ein.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          code: otpCode,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          personality,
        }),
      });

      const verifyResult = (await verifyResponse.json()) as { success?: boolean; error?: string };

      if (!verifyResponse.ok || !verifyResult.success) {
        throw new Error(verifyResult.error || 'Code konnte nicht verifiziert werden.');
      }

      const onboardingResponse = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          region: region.trim(),
          club: club.trim(),
          phone,
          plan: 'free-beta',
        }),
      });

      const onboardingResult = (await onboardingResponse.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!onboardingResponse.ok || !onboardingResult.success) {
        throw new Error(onboardingResult.error || 'Onboarding konnte nicht gespeichert werden.');
      }

      setStep(4);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : 'Beta-Onboarding konnte nicht abgeschlossen werden.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateOtpDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);

    if (digit && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');

    if (pastedDigits.length === 0) {
      return;
    }

    const nextDigits = ['', '', '', '', '', ''];
    pastedDigits.forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    setOtpDigits(nextDigits);
    otpRefs.current[Math.min(pastedDigits.length, 5)]?.focus();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#253f12_0%,#0a0f0a_42%,#040604_100%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-between rounded-[2rem] border border-lime-400/20 bg-black/30 p-6 shadow-[0_30px_120px_-60px_rgba(132,204,22,0.45)] backdrop-blur md:p-8">
            <div>
              <div className="inline-flex items-center rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-lime-300">
                PadelClaw Beta
              </div>
              <h1 className="mt-6 max-w-xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                In unter 1 Minute live. Danach schreibt dir dein Agent direkt auf WhatsApp.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
                Ein eigener Beta-Flow für Trainer: Kurzprofil ausfüllen, Agent-Stil wählen, Nummer verifizieren und sofort starten.
                Danach übernimmt dein Agent das Setup direkt auf WhatsApp.
              </p>
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-lime-400/15 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lime-300">Flow</p>
                  <p className="mt-2 text-2xl font-semibold text-white">4 schnelle Schritte</p>
                </div>
                <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-200">
                  Beta only
                </span>
              </div>
              <div className="mt-5 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-lime-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
                <span>Schritt {step} von {TOTAL_STEPS}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[#0b0f0b]/90 p-6 shadow-[0_30px_100px_-60px_rgba(0,0,0,0.9)] backdrop-blur md:p-8">
            {step === 1 ? (
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-300">Step 1</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Dein Profil</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">Schnell ausgefüllt, damit dein Agent direkt loslegen kann.</p>

                <div className="mt-8 space-y-5">
                  <Field
                    label="Name"
                    placeholder="z.B. Fernando Garcia"
                    value={name}
                    onChange={setName}
                    required
                  />
                  <Field
                    label="Stadt/Region"
                    placeholder="z.B. München"
                    value={region}
                    onChange={setRegion}
                  />
                  <Field
                    label="Standard-Club"
                    placeholder="z.B. Padel Arena"
                    value={club}
                    onChange={setClub}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!validateProfile()) {
                      return;
                    }

                    setError('');
                    setStep(2);
                  }}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-lime-400 px-5 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-lime-300"
                >
                  Weiter →
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-300">Step 2</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Wähle deinen Agent-Stil</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  So klingt dein Assistent später gegenüber Spielern. Du kannst das später jederzeit anpassen.
                </p>

                <div className="mt-8 grid gap-4">
                  {PERSONALITY_OPTIONS.map((option) => {
                    const isActive = personality === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPersonality(option.value)}
                        className={`rounded-[1.5rem] border px-5 py-5 text-left transition ${
                          isActive
                            ? 'border-lime-400 bg-lime-400/10 shadow-[0_20px_60px_-40px_rgba(163,230,53,0.9)]'
                            : 'border-white/10 bg-white/[0.03] hover:border-lime-400/30 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-white">{option.title}</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">{option.description}</p>
                          </div>
                          <div
                            className={`mt-1 h-5 w-5 rounded-full border ${
                              isActive ? 'border-lime-300 bg-lime-300' : 'border-white/25'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setStep(1);
                    }}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setOtpRequested(false);
                      setOtpDigits(['', '', '', '', '', '']);
                      setStep(3);
                    }}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-lime-400 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-300"
                  >
                    Weiter →
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-300">Step 3</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Verifiziere deinen Zugang</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Gib E-Mail und WhatsApp an, lass dir den Code schicken und bestätige ihn direkt hier.
                </p>

                <div className="mt-8 space-y-5">
                  <Field
                    label="E-Mail"
                    placeholder="z.B. coach@padelclub.de"
                    value={email}
                    onChange={setEmail}
                    required
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">WhatsApp-Nummer</label>
                    <div className="grid grid-cols-[92px_1fr] gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-200">
                        {countryCode}
                      </div>
                      <input
                        value={whatsAppNumber}
                        onChange={(event) => setWhatsAppNumber(event.target.value)}
                        placeholder="176 12345678"
                        inputMode="tel"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-400 focus:bg-black/40"
                      />
                    </div>
                    <p className="text-xs text-zinc-500">+49 Prefix ist vorausgewählt.</p>
                  </div>

                  {!otpRequested ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSubmitting}
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-lime-400 px-5 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? 'Sende Code...' : 'Code senden'}
                    </button>
                  ) : (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-200">6-stelliger Code</label>
                        <div className="grid grid-cols-6 gap-2">
                          {otpDigits.map((digit, index) => (
                            <input
                              key={index}
                              ref={(element) => {
                                otpRefs.current[index] = element;
                              }}
                              value={digit}
                              onChange={(event) => updateOtpDigit(index, event.target.value)}
                              onKeyDown={(event) => handleOtpKeyDown(index, event)}
                              onPaste={handleOtpPaste}
                              inputMode="numeric"
                              maxLength={1}
                              className="h-14 rounded-2xl border border-white/10 bg-white/5 text-center text-xl font-semibold text-white outline-none transition focus:border-lime-400 focus:bg-black/40"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={isSubmitting}
                          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Code neu senden
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isSubmitting}
                          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-lime-400 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSubmitting ? 'Prüfe...' : 'Weiter →'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setStep(2);
                    }}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                  >
                    Zurück
                  </button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="flex min-h-[420px] flex-col justify-center">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-300">Step 4</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">🎾 Dein Agent ist aktiv!</h2>
                <p className="mt-4 text-base leading-7 text-zinc-300">
                  Schau auf dein Handy — dein PadelClaw-Assistent hat sich gerade per WhatsApp gemeldet und startet jetzt dein Setup.
                </p>
                <div className="mt-8 rounded-[1.75rem] border border-lime-400/20 bg-lime-400/10 p-5 text-sm leading-6 text-lime-100">
                  Kein Dashboard nötig. Club, Preise und Startkonfiguration richtest du jetzt direkt im Chat ein.
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  required = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-200">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-400 focus:bg-black/40"
      />
    </div>
  );
}
