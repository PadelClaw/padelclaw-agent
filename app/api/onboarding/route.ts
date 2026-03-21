import { NextRequest, NextResponse } from 'next/server'
import { convexMutation } from '@/lib/convex-http'
import { sendWhatsApp } from '@/lib/whatsapp-meta'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const languageOptions = new Set(['de', 'en', 'es'])
const planOptions = new Set(['free', 'basic', 'pro'])

type AvailabilityInput = Record<
  string,
  {
    label?: string
    days?: string
    enabled?: boolean
    startTime?: string
    endTime?: string
  }
>

type OnboardingPayload = {
  plan?: unknown
  name?: unknown
  region?: unknown
  club?: unknown
  phone?: unknown
  clubName?: unknown
  location?: unknown
  language?: unknown
  priceSingle?: unknown
  pricePackage5?: unknown
  pricePackage10?: unknown
  availability?: unknown
  countryCode?: unknown
  whatsappNumber?: unknown
}

function asCleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizePhone(countryCode: string, phone: string) {
  const digits = `${countryCode}${phone}`.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

function normalizeSinglePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

function isValidTimeRange(startTime: string, endTime: string) {
  return Boolean(startTime && endTime && startTime < endTime)
}

function validateAvailability(input: unknown) {
  if (!input || typeof input !== 'object') return null

  const availability = input as AvailabilityInput
  const keys = ['weekdays', 'saturday']
  const normalized: Record<string, { label: string; days: string; enabled: boolean; startTime: string; endTime: string }> = {}

  for (const key of keys) {
    const entry = availability[key]

    if (!entry || typeof entry !== 'object') {
      return null
    }

    const enabled = Boolean(entry.enabled)
    const startTime = asCleanString(entry.startTime)
    const endTime = asCleanString(entry.endTime)

    if (enabled && !isValidTimeRange(startTime, endTime)) {
      return null
    }

    normalized[key] = {
      label: asCleanString(entry.label) || key,
      days: asCleanString(entry.days) || key,
      enabled,
      startTime,
      endTime,
    }
  }

  if (!Object.values(normalized).some((entry) => entry.enabled)) {
    return null
  }

  return normalized
}

function buildWelcomeMessage(name: string, plan: string) {
  if (plan === 'basic') {
    return `Hallo ${name}! 🎾 Dein Basic Agent mit Kalender-Bild ist bereit.`
  }

  if (plan === 'pro') {
    return `Hallo ${name}! 🏆 Dein Pro Agent mit voller Ausstattung ist bereit.`
  }

  return `Hallo ${name}! 👋 Dein kostenloser PadelClaw Agent ist bereit.`
}

export async function POST(req: NextRequest) {
  let payload: OnboardingPayload

  try {
    payload = (await req.json()) as OnboardingPayload
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 })
  }

  const name = asCleanString(payload.name)
  const plan = asCleanString(payload.plan) || 'free'
  const region = asCleanString(payload.region)
  const club = asCleanString(payload.club)
  const phone = normalizeSinglePhone(asCleanString(payload.phone))
  const clubName = asCleanString(payload.clubName)
  const location = asCleanString(payload.location)
  const language = asCleanString(payload.language)
  const countryCode = asCleanString(payload.countryCode)
  const whatsappNumber = asCleanString(payload.whatsappNumber)

  const priceSingle = parsePositiveInt(payload.priceSingle)
  const pricePackage5 = parsePositiveInt(payload.pricePackage5)
  const pricePackage10 = parsePositiveInt(payload.pricePackage10)
  const availability = validateAvailability(payload.availability)
  const trainerPhone = normalizePhone(countryCode, whatsappNumber)

  if (plan === 'free-beta') {
    if (!name || phone.replace(/\D/g, '').length < 8) {
      return NextResponse.json(
        { error: 'Name und gültige WhatsApp-Nummer sind erforderlich.' },
        { status: 400 },
      )
    }

    try {
      const trainerId = await convexMutation<string>('trainers:upsertBetaTrainer', {
        name,
        region: region || undefined,
        club: club || undefined,
        phone,
        plan,
      })

      return NextResponse.json({
        success: true,
        trainerId,
      })
    } catch (error) {
      console.error('Beta onboarding failed:', error)
      return NextResponse.json(
        { error: 'Beta-Onboarding konnte nicht abgeschlossen werden.' },
        { status: 500 },
      )
    }
  }

  if (!name || !clubName || !location) {
    return NextResponse.json({ error: 'Name, Club-Name und Standort sind Pflichtfelder.' }, { status: 400 })
  }

  if (!languageOptions.has(language)) {
    return NextResponse.json({ error: 'Ungültige Sprache.' }, { status: 400 })
  }

  if (!planOptions.has(plan)) {
    return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 })
  }

  if (!priceSingle || !pricePackage5 || !pricePackage10) {
    return NextResponse.json({ error: 'Bitte gib gültige Preise an.' }, { status: 400 })
  }

  if (!availability) {
    return NextResponse.json({ error: 'Bitte prüfe deine Verfügbarkeit.' }, { status: 400 })
  }

  if (trainerPhone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ error: 'Bitte gib eine gültige WhatsApp-Nummer an.' }, { status: 400 })
  }

  try {
    const createdTrainer = await prisma.trainerConfig.create({
      data: {
        plan,
        name,
        clubName,
        location,
        language,
        trainerPhone,
        priceSingle,
        pricePackage5,
        pricePackage10,
        availabilityJson: JSON.stringify(availability),
        calendarId: 'primary',
      },
    })

    try {
      await sendWhatsApp(
        trainerPhone,
        buildWelcomeMessage(name, plan),
      )
    } catch (sendError) {
      await prisma.trainerConfig.delete({ where: { id: createdTrainer.id } })
      throw sendError
    }

    return NextResponse.json({
      success: true,
      trainerId: createdTrainer.id,
    })
  } catch (error) {
    console.error('Onboarding failed:', error)
    return NextResponse.json(
      { error: 'Onboarding konnte nicht abgeschlossen werden.' },
      { status: 500 },
    )
  }
}
