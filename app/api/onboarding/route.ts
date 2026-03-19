import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/whatsapp-meta'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const languageOptions = new Set(['de', 'en', 'es'])

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
  name?: unknown
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

function buildWelcomeMessage(name: string, agentNumber: string, language: string) {
  if (language === 'en') {
    return `Hi ${name}, your PadelClaw trainer agent is ready. Your agent WhatsApp number is ${agentNumber}. Save it and start testing right away.`
  }

  if (language === 'es') {
    return `Hola ${name}, tu agente de PadelClaw ya está listo. El número de WhatsApp de tu agente es ${agentNumber}. Guárdalo y empieza a probarlo ahora.`
  }

  return `Hi ${name}, dein PadelClaw Trainer-Agent ist bereit. Die WhatsApp-Nummer deines Agents ist ${agentNumber}. Speichere sie direkt und teste los.`
}

export async function POST(req: NextRequest) {
  let payload: OnboardingPayload

  try {
    payload = (await req.json()) as OnboardingPayload
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 })
  }

  const name = asCleanString(payload.name)
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

  if (!name || !clubName || !location) {
    return NextResponse.json({ error: 'Name, Club-Name und Standort sind Pflichtfelder.' }, { status: 400 })
  }

  if (!languageOptions.has(language)) {
    return NextResponse.json({ error: 'Ungültige Sprache.' }, { status: 400 })
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

  const agentNumber = '+1 555 186 3357'

  try {
    const createdTrainer = await prisma.trainerConfig.create({
      data: {
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
        buildWelcomeMessage(name, agentNumber, language),
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
