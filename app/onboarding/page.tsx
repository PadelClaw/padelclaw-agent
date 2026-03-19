'use client'

import type { FormEvent, HTMLAttributes } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type LanguageCode = 'de' | 'en' | 'es'
type AvailabilityKey = 'weekdays' | 'saturday'

type AvailabilityState = Record<
  AvailabilityKey,
  {
    label: string
    days: string
    enabled: boolean
    startTime: string
    endTime: string
  }
>

const languages: Array<{ value: LanguageCode; label: string }> = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

const countryCodes = [
  { value: '+49', label: 'DE +49' },
  { value: '+34', label: 'ES +34' },
  { value: '+43', label: 'AT +43' },
  { value: '+41', label: 'CH +41' },
  { value: '+1', label: 'US +1' },
]

const initialAvailability: AvailabilityState = {
  weekdays: {
    label: 'Mo-Fr',
    days: 'wochentags',
    enabled: true,
    startTime: '09:00',
    endTime: '19:00',
  },
  saturday: {
    label: 'Sa',
    days: 'samstags',
    enabled: true,
    startTime: '10:00',
    endTime: '14:00',
  },
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [clubName, setClubName] = useState('')
  const [location, setLocation] = useState('')
  const [language, setLanguage] = useState<LanguageCode>('de')

  const [priceSingle, setPriceSingle] = useState('')
  const [pricePackage5, setPricePackage5] = useState('')
  const [pricePackage10, setPricePackage10] = useState('')
  const [availability, setAvailability] = useState<AvailabilityState>(initialAvailability)

  const [countryCode, setCountryCode] = useState('+49')
  const [whatsAppNumber, setWhatsAppNumber] = useState('')

  const currentStepLabel = useMemo(() => `Schritt ${step} von 3`, [step])

  function updateAvailability(key: AvailabilityKey, patch: Partial<AvailabilityState[AvailabilityKey]>) {
    setAvailability((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }))
  }

  function validateStep(targetStep: number): boolean {
    if (targetStep === 1) {
      if (!name.trim() || !clubName.trim() || !location.trim()) {
        setError('Bitte fülle Name, Club und Standort aus.')
        return false
      }
    }

    if (targetStep === 2) {
      const single = Number(priceSingle)
      const package5 = Number(pricePackage5)
      const package10 = Number(pricePackage10)
      const enabledSlots = Object.values(availability).filter((slot) => slot.enabled)

      if (![single, package5, package10].every((value) => Number.isFinite(value) && value > 0)) {
        setError('Bitte gib gültige Preise größer als 0 ein.')
        return false
      }

      if (enabledSlots.length === 0) {
        setError('Bitte aktiviere mindestens einen verfügbaren Zeitraum.')
        return false
      }

      if (
        enabledSlots.some(
          (slot) => !slot.startTime || !slot.endTime || slot.startTime >= slot.endTime,
        )
      ) {
        setError('Bitte prüfe die Start- und Endzeiten deiner Verfügbarkeit.')
        return false
      }
    }

    if (targetStep === 3) {
      const digits = whatsAppNumber.replace(/\D/g, '')
      if (digits.length < 6) {
        setError('Bitte gib eine gültige WhatsApp-Nummer ein.')
        return false
      }
    }

    setError('')
    return true
  }

  function goNext() {
    if (!validateStep(step)) return
    setStep((current) => Math.min(current + 1, 3))
  }

  function goBack() {
    setError('')
    setStep((current) => Math.max(current - 1, 1))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateStep(3)) return

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          clubName,
          location,
          language,
          priceSingle,
          pricePackage5,
          pricePackage10,
          availability,
          countryCode,
          whatsappNumber: whatsAppNumber,
        }),
      })

      const result = (await response.json()) as { success?: boolean; trainerId?: number; error?: string }

      if (!response.ok || !result.success || !result.trainerId) {
        throw new Error(result.error || 'Onboarding konnte nicht abgeschlossen werden.')
      }

      router.push(`/onboarding/success?trainerId=${result.trainerId}`)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Onboarding konnte nicht abgeschlossen werden.',
      )
    } finally {
      setIsSubmitting(false)
    }
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
              Self-Service Onboarding
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Erstelle deinen PadelClaw Agenten
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              In drei kurzen Schritten ist dein Trainer-Agent live und auf WhatsApp erreichbar.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {step === 1 ? (
              <>
                <Input
                  label="Dein Name"
                  placeholder="Fernando García"
                  value={name}
                  onChange={setName}
                />
                <Input
                  label="Club-Name"
                  placeholder="Padel Club Ibiza"
                  value={clubName}
                  onChange={setClubName}
                />
                <Input
                  label="Standort"
                  placeholder="Ibiza, Spanien"
                  value={location}
                  onChange={setLocation}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Sprache</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-green-500 focus:bg-white"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as LanguageCode)}
                  >
                    {languages.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="grid grid-cols-1 gap-4">
                  <Input
                    label="Einzelstunde (€)"
                    inputMode="numeric"
                    placeholder="65"
                    value={priceSingle}
                    onChange={setPriceSingle}
                  />
                  <Input
                    label="5er-Paket (€)"
                    inputMode="numeric"
                    placeholder="300"
                    value={pricePackage5}
                    onChange={setPricePackage5}
                  />
                  <Input
                    label="10er-Paket (€)"
                    inputMode="numeric"
                    placeholder="550"
                    value={pricePackage10}
                    onChange={setPricePackage10}
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Verfügbarkeit</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Aktiviere die Zeitfenster, in denen dein Agent Buchungen annehmen darf.
                    </p>
                  </div>

                  {Object.entries(availability).map(([key, slot]) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{slot.label}</p>
                          <p className="text-sm text-slate-500">{slot.days}</p>
                        </div>
                        <button
                          type="button"
                          aria-pressed={slot.enabled}
                          onClick={() =>
                            updateAvailability(key as AvailabilityKey, { enabled: !slot.enabled })
                          }
                          className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                            slot.enabled ? 'bg-green-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                              slot.enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <TimeInput
                          label="Start"
                          value={slot.startTime}
                          disabled={!slot.enabled}
                          onChange={(value) =>
                            updateAvailability(key as AvailabilityKey, { startTime: value })
                          }
                        />
                        <TimeInput
                          label="Ende"
                          value={slot.endTime}
                          disabled={!slot.enabled}
                          onChange={(value) =>
                            updateAvailability(key as AvailabilityKey, { endTime: value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
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
                  Nach dem Klick auf <span className="font-semibold">Agent erstellen</span> legen
                  wir dein Trainerprofil an und schicken direkt eine Willkommensnachricht an deine
                  WhatsApp-Nummer.
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
                onClick={goBack}
                disabled={step === 1 || isSubmitting}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Zurück
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  Weiter
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
                >
                  {isSubmitting ? 'Erstelle Agent...' : 'Agent erstellen'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

function Input({
  label,
  placeholder,
  value,
  onChange,
  inputMode = 'text',
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-green-500 focus:bg-white"
        placeholder={placeholder}
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function TimeInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-green-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  )
}
