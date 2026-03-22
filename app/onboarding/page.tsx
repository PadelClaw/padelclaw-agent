'use client'

import type { ClipboardEvent, HTMLAttributes, KeyboardEvent } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type PlanCode = 'free' | 'basic' | 'pro';

const allowedPlans: PlanCode[] = ['free', 'basic', 'pro'];
const countryCodes = [
  { value: '+49', label: 'DE +49' },
  { value: '+34', label: 'ES +34' },
  { value: '+43', label: 'AT +43' },
  { value: '+41', label: 'CH +41' },
  { value: '+1', label: 'US +1' },
];

function parsePlan(value: string | null): PlanCode {
  return allowedPlans.includes(value as PlanCode) ? (value as PlanCode) : 'free';
}

function formatPlanLabel(plan: PlanCode) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function normalizePhone(countryCode: string, phone: string) {
  const digits = `${countryCode}${phone}`.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<PlanCode>('free');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+49');
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);

  const phone = useMemo(
    () => normalizePhone(countryCode, whatsAppNumber),
    [countryCode, whatsAppNumber],
  );
  const otpCode = useMemo(() => otpDigits.join(''), [otpDigits]);
  const currentStepLabel = useMemo(() => `Schritt ${step} von 3`, [step]);
  const selectedPlanLabel = useMemo(() => formatPlanLabel(plan), [plan]);

  useEffect(() => {
    const queryPlan = parsePlan(searchParams.get('plan'));
    const storedPlan =
      typeof window !== 'undefined' ? parsePlan(window.localStorage.getItem('padelclaw-plan')) : 'free';
    const resolvedPlan = searchParams.get('plan') ? queryPlan : storedPlan;

    setPlan(resolvedPlan);
    window.localStorage.setItem('padelclaw-plan', resolvedPlan);
  }, [searchParams]);

  function validateStepOne() {
    if (!name.trim() || !email.trim()) {
      setError('Bitte gib Name und E-Mail an.');
      return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return false;
    }

    if (phone.replace(/\D/g, '').length < 8) {
      setError('Bitte gib eine gültige WhatsApp-Nummer ein.');
      return false;
    }

    setError('');
    return true;
  }

  async function handleSendOtp() {
    if (!validateStepOne()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), phone }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'OTP konnte nicht versendet werden.');
      }

      setOtpDigits(['', '', '', '', '', '']);
      setStep(2);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'OTP konnte nicht versendet werden.',
      );
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
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          code: otpCode,
        }),
      });

      const result = (await response.json()) as { success?: boolean; trainerId?: string; error?: string };

      if (!response.ok || !result.success || !result.trainerId) {
        throw new Error(result.error || 'OTP konnte nicht verifiziert werden.');
      }

      setStep(3);
      router.push(`/onboarding/success?trainerId=${result.trainerId}`);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : 'OTP konnte nicht verifiziert werden.',
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

    const nextIndex = Math.min(pastedDigits.length, 5);
    otpRefs.current[nextIndex]?.focus();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 px-4 py-8 text-slate-900">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="rounded-3xl bg-white p-6 shadow-[0_20px_80px_-40px_rgba(22,163,74,0.45)] ring-1 ring-green-100">
          <div className="flex items-center justify-between text-sm font-medium text-green-700">
            <span>{currentStepLabel}</span>
            <span>{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-green-100">
            <div
              className="h-2 rounded-full bg-green-600 transition-all"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div className="mt-6">
            <div className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              Plan: {selectedPlanLabel}
            </div>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
              WhatsApp Login
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Verifiziere dich in 60 Sekunden
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Gib deine Trainerdaten ein, empfange deinen 6-stelligen Code per WhatsApp und logge dich direkt ein.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            {step === 1 ? (
              <>
                <Input
                  label="Dein Name"
                  placeholder="Fernando García"
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                />
                <Input
                  label="E-Mail"
                  placeholder="fernando@club.de"
                  value={email}
                  onChange={setEmail}
                  inputMode="email"
                  autoComplete="email"
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">WhatsApp-Nummer</label>
                  <div className="grid grid-cols-[116px_1fr] gap-3">
                    <select
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-green-500 focus:bg-white"
                      value={countryCode}
                      onChange={(event) => setCountryCode(event.target.value)}
                    >
                      {countryCodes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-green-500 focus:bg-white"
                      inputMode="tel"
                      placeholder="17612345678"
                      value={whatsAppNumber}
                      onChange={(event) => setWhatsAppNumber(event.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl bg-green-50 p-4 text-sm text-green-900">
                  Wir schicken den Login-Code direkt an <span className="font-semibold">{phone || 'deine Nummer'}</span>.
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="rounded-2xl bg-green-50 p-4 text-sm text-green-900">
                  Der Code wurde an <span className="font-semibold">{phone}</span> gesendet.
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">6-stelliger Code</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Gib den Code aus WhatsApp ein. Er ist 10 Minuten gültig.
                    </p>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          otpRefs.current[index] = element;
                        }}
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 text-center text-xl font-semibold outline-none transition focus:border-green-500 focus:bg-white"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(event) => updateOtpDigit(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        onPaste={handleOtpPaste}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  if (step === 2) {
                    setStep(1);
                    return;
                  }
                  router.push('/');
                }}
                disabled={isSubmitting}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === 1 ? 'Abbrechen' : 'Zurück'}
              </button>

              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
                >
                  {isSubmitting ? 'Sende Code...' : 'Code senden'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSubmitting}
                    className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Neu senden
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isSubmitting}
                    className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
                  >
                    {isSubmitting ? 'Prüfe...' : 'Verifizieren'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function OnboardingSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-[0_20px_80px_-40px_rgba(22,163,74,0.45)] ring-1 ring-green-100">
        <div className="h-2 rounded-full bg-green-100" />
        <div className="mt-6 h-6 w-28 rounded-full bg-green-100" />
        <div className="mt-4 h-10 w-3/4 rounded-2xl bg-slate-100" />
        <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
      </div>
    </main>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChange,
  inputMode = 'text',
  autoComplete,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-green-500 focus:bg-white"
        placeholder={placeholder}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
