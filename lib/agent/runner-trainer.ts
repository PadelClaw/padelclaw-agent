import { ollamaClient, AGENT_MODEL } from './ollama'
import { toolDefinitions, executeTool } from './tools'
import { convexMutation, convexQuery } from '@/lib/convex-http'
import { getTrainerChannelProfileByPhone, getTrainerConfigByPhone } from '@/lib/db/trainer-config'
import { getTrainerMemory, upsertTrainerMemory } from '@/lib/db/trainer-memory'
import { generateWeekImage } from '@/lib/calendar/generate-image'
import {
  addDays,
  getDateKey,
  getIsoWeek,
  getUpcomingTrainerBookings,
  parseBookingDate,
  startOfDay,
  type TrainerScheduleBooking,
} from '@/lib/calendar/schedule'
import type { ChatCompletionMessageParam } from 'openai/resources'

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

type ConvexTrainer = {
  _id: string
  name: string
  phone: string
  location?: string
  region?: string
  club?: string
  priceSingle?: number
  pricePackage5?: number
  pricePackage10?: number
  onboardingStep?: string
}

export type TrainerAgentResponse =
  | { type: 'text'; body: string }
  | { type: 'image'; imageBase64: string; caption?: string }

function formatDateLabel(date: Date): string {
  const dayLabel = WEEKDAY_LABELS[date.getDay()]
  const dateLabel = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
  return `${dayLabel} ${dateLabel}`
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatUpcomingBookings(bookings: TrainerScheduleBooking[]): string {
  if (!bookings.length) {
    return '- Keine bestätigten Buchungen in den nächsten 7 Tagen.'
  }

  return bookings
    .map((booking) => {
      const start = parseBookingDate(booking.slotStart)
      const end = parseBookingDate(booking.slotEnd)
      return `- ${formatDateLabel(start)} ${formatTime(start)}-${formatTime(end)}: ${booking.playerName} (${booking.playerPhone})`
    })
    .join('\n')
}

function formatBookingsForWhatsApp(
  bookings: TrainerScheduleBooking[],
  variant: 'week' | 'today' | 'tomorrow',
  now: Date = new Date(),
  location: string = 'Padel Club Ibiza',
): string {
  const today = startOfDay(now)

  if (variant === 'today' || variant === 'tomorrow') {
    const targetDate = variant === 'today' ? today : addDays(today, 1)
    const targetKey = getDateKey(targetDate)
    const dayBookings = bookings
      .filter((booking) => getDateKey(parseBookingDate(booking.slotStart)) === targetKey)
      .sort((a, b) => parseBookingDate(a.slotStart).getTime() - parseBookingDate(b.slotStart).getTime())

    const title = variant === 'today' ? '📅 Dein Tag heute' : '📅 Dein Tag morgen'
    const header = dayBookings.length ? `${formatDateLabel(targetDate)} 🟢` : `${formatDateLabel(targetDate)} ⚪ frei`

    if (!dayBookings.length) {
      return `${title}\n\n${header}\n\nGesamt: 0 Sessions`
    }

    const lines = dayBookings.map((booking) => `• ${formatTime(parseBookingDate(booking.slotStart))}-${formatTime(parseBookingDate(booking.slotEnd) <= parseBookingDate(booking.slotStart) ? new Date(parseBookingDate(booking.slotStart).getTime() + 3600000) : parseBookingDate(booking.slotEnd))} ${booking.playerName}`)
    return `${title}\n\n${header}\n${lines.join('\n')}\n📍 ${location}\n\nGesamt: ${dayBookings.length} ${dayBookings.length === 1 ? 'Session' : 'Sessions'}`
  }

  const weekStart = addDays(today, -(today.getDay() === 0 ? 6 : today.getDay() - 1))
  const allDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const bookingsByDay = new Map<string, TrainerScheduleBooking[]>()

  for (const booking of bookings) {
    const key = getDateKey(parseBookingDate(booking.slotStart))
    const existing = bookingsByDay.get(key) ?? []
    existing.push(booking)
    bookingsByDay.set(key, existing)
  }

  const visibleDays = allDays.filter((day) => {
    const weekday = day.getDay()
    return weekday >= 1 && weekday <= 5 ? true : (bookingsByDay.get(getDateKey(day))?.length ?? 0) > 0
  })

  const sections = visibleDays.map((day) => {
    const dayBookings = (bookingsByDay.get(getDateKey(day)) ?? []).sort(
      (a, b) => parseBookingDate(a.slotStart).getTime() - parseBookingDate(b.slotStart).getTime(),
    )

    if (!dayBookings.length) {
      return `${formatDateLabel(day)} ⚪ frei`
    }

    const grouped = new Map<string, { time: string; playerName: string; count: number }>()
    for (const booking of dayBookings) {
      const time = formatTime(parseBookingDate(booking.slotStart))
      const key = `${time}|${booking.playerName}`
      const current = grouped.get(key)
      if (current) {
        current.count += 1
      } else {
        grouped.set(key, { time, playerName: booking.playerName, count: 1 })
      }
    }

    const lines = Array.from(grouped.values()).map((entry) =>
      entry.count > 1 ? `• ${entry.time} ${entry.playerName} (${entry.count}h)` : `• ${entry.time} ${entry.playerName}`,
    )

    return `${formatDateLabel(day)} 🟢\n${lines.join('\n')}`
  })

  const totalSessions = bookings.length
  return `📅 KW ${getIsoWeek(today)} – Deine Woche\n\n${sections.join('\n\n')}\n\nGesamt: ${totalSessions} ${totalSessions === 1 ? 'Session' : 'Sessions'} diese Woche`
}

function detectTrainerOverviewIntent(message: string): 'week' | 'today' | 'tomorrow' | null {
  const normalized = message.toLowerCase()

  if (normalized.includes('heute')) {
    return 'today'
  }

  if (normalized.includes('morgen')) {
    return 'tomorrow'
  }

  const overviewKeywords = ['woche', 'termine', 'was habe ich', 'übersicht', 'plan']
  return overviewKeywords.some((keyword) => normalized.includes(keyword)) ? 'week' : null
}

function wantsCalendarImage(message: string): boolean {
  const normalized = message.toLowerCase()
  const keywords = ['bild', 'foto', 'image', 'png', 'grafik']
  return keywords.some((keyword) => normalized.includes(keyword))
}

function wantsCalendarLink(message: string): boolean {
  const normalized = message.toLowerCase()
  const keywords = ['ical', 'kalender link', 'importieren', 'subscribe']
  return keywords.some((keyword) => normalized.includes(keyword))
}

function normalizeConvexPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

async function getConvexTrainerByPhone(phone: string): Promise<ConvexTrainer | null> {
  const digits = phone.replace(/\D/g, '')
  if (!digits) {
    return null
  }

  for (const candidate of [normalizeConvexPhone(phone), digits]) {
    if (!candidate) {
      continue
    }

    const trainer = await convexQuery<ConvexTrainer | null>('trainers:getByPhone', {
      phone: candidate,
    })

    if (trainer) {
      return trainer
    }
  }

  return null
}

function parseEuroAmount(message: string): number | null {
  const match = message.replace(',', '.').match(/(\d{1,4})(?:[.,]\d{1,2})?/)
  if (!match) {
    return null
  }

  const amount = Number.parseInt(match[1] ?? '', 10)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function parsePackagePrices(message: string): { pricePackage5: number; pricePackage10: number } | null {
  const normalized = message.toLowerCase().replace(/€/g, ' ')
  const price5Match = normalized.match(/5(?:er)?(?:[\s-]*(?:karte|paket))?[^\d]{0,12}(\d{1,4})/)
  const price10Match = normalized.match(/10(?:er)?(?:[\s-]*(?:karte|paket))?[^\d]{0,12}(\d{1,4})/)

  const price5 = price5Match ? Number.parseInt(price5Match[1] ?? '', 10) : null
  const price10 = price10Match ? Number.parseInt(price10Match[1] ?? '', 10) : null

  if (price5 && price10) {
    return { pricePackage5: price5, pricePackage10: price10 }
  }

  const allNumbers = Array.from(normalized.matchAll(/\d{2,4}/g)).map((match) => Number.parseInt(match[0], 10))
  if (allNumbers.length >= 2) {
    return {
      pricePackage5: allNumbers[0],
      pricePackage10: allNumbers[1],
    }
  }

  return null
}

async function handleTrainerOnboarding(trainer: ConvexTrainer, message: string): Promise<TrainerAgentResponse | null> {
  const step = trainer.onboardingStep

  if (!step || step === 'done') {
    return null
  }

  if (step === 'location') {
    const location = message.trim()
    if (!location) {
      return {
        type: 'text',
        body: 'Wie heißt dein Club oder deine Trainings-Location?',
      }
    }

    await convexMutation<{ success: boolean }>('trainers:updateOnboarding', {
      trainerId: trainer._id,
      location,
      onboardingStep: 'price_single',
    })

    return {
      type: 'text',
      body: 'Perfekt. Was kostet eine Einzelstunde bei dir?',
    }
  }

  if (step === 'price_single') {
    const priceSingle = parseEuroAmount(message)
    if (!priceSingle) {
      return {
        type: 'text',
        body: 'Was kostet eine Einzelstunde bei dir? Schreib einfach zum Beispiel 65.',
      }
    }

    await convexMutation<{ success: boolean }>('trainers:updateOnboarding', {
      trainerId: trainer._id,
      priceSingle,
      onboardingStep: 'price_packages',
    })

    return {
      type: 'text',
      body: 'Top. Welche Paketpreise hast du fuer 5er- und 10er-Karten? Schreib zum Beispiel: 5er 300, 10er 550.',
    }
  }

  if (step === 'price_packages') {
    const prices = parsePackagePrices(message)
    if (!prices) {
      return {
        type: 'text',
        body: 'Bitte schick mir beide Paketpreise, zum Beispiel: 5er 300, 10er 550.',
      }
    }

    await convexMutation<{ success: boolean }>('trainers:updateOnboarding', {
      trainerId: trainer._id,
      pricePackage5: prices.pricePackage5,
      pricePackage10: prices.pricePackage10,
      onboardingStep: 'done',
    })

    return {
      type: 'text',
      body: 'Perfekt! 🎾 Dein Agent ist jetzt bereit. Deine Spieler können ab sofort über WhatsApp buchen!',
    }
  }

  return null
}

async function analyzeTrainerFeedback(trainerId: number, message: string): Promise<void> {
  const normalized = message.toLowerCase()
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  const complaintKeywords = ['zu forsch', 'nicht so', 'falsch', 'schlecht', 'nervig', 'zu viel']
  const positiveKeywords = ['gut', 'perfekt', 'genau so', 'super', 'top', 'danke']

  if (complaintKeywords.some((kw) => normalized.includes(kw))) {
    await upsertTrainerMemory(trainerId, `complaint_${today}`, `Beschwerde ${today}: ${message.slice(0, 120)}`)
  }

  if (positiveKeywords.some((kw) => normalized.includes(kw))) {
    await upsertTrainerMemory(trainerId, `positive_${today}`, `Positiv ${today}: ${message.slice(0, 120)}`)
  }

  const spanishStarters = ['hola', 'buenos', 'buenas', 'oye', 'dime']
  if (spanishStarters.some((kw) => normalized.startsWith(kw))) {
    await upsertTrainerMemory(trainerId, 'language_preference', 'Beginnt Konversation manchmal auf Spanisch')
  }
}

export async function runAgentTrainer(message: string, from: string): Promise<TrainerAgentResponse> {
  const trainerProfile = await getTrainerChannelProfileByPhone(from)
  if (!trainerProfile) {
    return { type: 'text', body: 'Trainer-Konfiguration nicht gefunden.' }
  }

  const convexTrainer = await getConvexTrainerByPhone(from)
  if (convexTrainer?.onboardingStep && convexTrainer.onboardingStep !== 'done') {
    const onboardingResponse = await handleTrainerOnboarding(convexTrainer, message)
    if (onboardingResponse) {
      return onboardingResponse
    }
  }

  const prismaConfig =
    typeof trainerProfile.id === 'number' ? await getTrainerConfigByPhone(from) : null
  const now = new Date()
  const upcomingBookings = prismaConfig ? await getUpcomingTrainerBookings(now) : []

  if (prismaConfig && wantsCalendarImage(message)) {
    const imageBuffer = await generateWeekImage(String(prismaConfig.id))
    return {
      type: 'image',
      imageBase64: imageBuffer.toString('base64'),
      caption: `KW ${String(getIsoWeek(now)).padStart(2, '0')} — ${trainerProfile.name}`,
    }
  }

  if (prismaConfig && wantsCalendarLink(message)) {
    return {
      type: 'text',
      body:
        `Hier ist dein Kalender-Link zum Importieren:\n` +
        `https://meniscoid-lena-superofficiously.ngrok-free.dev/api/calendar/${prismaConfig.id}.ics\n\n` +
        `Einfach in Apple Calendar, Google Calendar oder Outlook importieren!`,
    }
  }

  const overviewIntent = detectTrainerOverviewIntent(message)
  if (overviewIntent) {
    return {
      type: 'text',
      body: formatBookingsForWhatsApp(upcomingBookings, overviewIntent, now, trainerProfile.location),
    }
  }

  const trainerMemory = prismaConfig ? await getTrainerMemory(prismaConfig.id) : ''

  const memorySection = trainerMemory
    ? `\n\n## Was ich über ${trainerProfile.name} weiß\n${trainerMemory}`
    : ''

  const systemPrompt = `Du bist der digitale Assistent von Coach ${trainerProfile.name}. Du kommunizierst DIREKT mit dem Trainer.

Beim ALLERERSTEN Kontakt des Tages (wenn keine History vorhanden): Begrüße mit 'Hallo Fernando 👋'
Danach: Kein 'Hallo' mehr — direkt zur Antwort. Natürliche Konversation wie mit einem Kollegen.
Antworte auf Deutsch, kurz und direkt.
WICHTIG: Stelle am Ende KEINE Rückfragen wie "Möchtest du weitere Termine sehen?" — der Trainer weiß selbst was er braucht. Nur antworten was gefragt wurde.

## Trainer-Kontext
- Trainer: ${trainerProfile.name}
- Telefonnummer des Trainers: ${trainerProfile.trainerPhone ?? process.env.TRAINER_PHONE ?? from}
- Location: ${trainerProfile.location}
- Preise: ${trainerProfile.priceSingle}€/Stunde | 5er-Paket: ${trainerProfile.pricePackage5}€ | 10er-Paket: ${trainerProfile.pricePackage10}€
- Aktuelles Datum/Zeit: ${now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}, ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr

## Buchungen der nächsten 7 Tage
${formatUpcomingBookings(upcomingBookings)}${memorySection}

## Tool-Regeln
- Nutze dieselben Tools wie gewohnt: check_slots, create_booking, cancel_booking.
- Nutze check_slots, wenn Fernando freie Termine sehen will.
- Nutze create_booking nur mit slot_start, player_name und player_phone.
- Nutze cancel_booking nur mit der Telefonnummer des Spielers.
- Wenn die Antwort schon direkt aus dem Kontext möglich ist, antworte ohne Tool-Call.
- Keine Konversationshistorie verwenden. Behandle jede Nachricht eigenständig.`

  // Analyze trainer message for feedback/preferences (fire-and-forget)
  if (prismaConfig) {
    analyzeTrainerFeedback(prismaConfig.id, message).catch(() => {})
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ]

  for (let i = 0; i < 5; i++) {
    const response = await ollamaClient.chat.completions.create({
      model: AGENT_MODEL,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    if (!choice) break

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      messages.push(choice.message)
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, string>
        const result = await executeTool(toolCall.function.name, args)
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
      }
      continue
    }

    const msg = choice.message as { content?: string | null; reasoning?: string }
    const text = msg.content || msg.reasoning || ''
    return {
      type: 'text',
      body: text.trim() || 'Entschuldigung, bitte versuche es nochmal.',
    }
  }

  return { type: 'text', body: 'Entschuldigung, ich konnte deine Anfrage nicht verarbeiten.' }
}
