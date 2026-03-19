import { ollamaClient, AGENT_MODEL } from './ollama'
import { toolDefinitions, executeTool } from './tools'
import { prisma } from '@/lib/prisma'
import { getTrainerConfig } from '@/lib/db/trainer-config'
import type { ChatCompletionMessageParam } from 'openai/resources'

type TrainerBooking = {
  playerName: string
  playerPhone: string
  slotStart: string
  slotEnd: string
  status: string
}

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

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

function getDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getIsoWeek(date: Date): number {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7))
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
}

function formatUpcomingBookings(bookings: TrainerBooking[]): string {
  if (!bookings.length) {
    return '- Keine bestätigten Buchungen in den nächsten 7 Tagen.'
  }

  return bookings
    .map((booking) => {
      const start = new Date(booking.slotStart)
      const end = new Date(booking.slotEnd)
      return `- ${formatDateLabel(start)} ${formatTime(start)}-${formatTime(end)}: ${booking.playerName} (${booking.playerPhone})`
    })
    .join('\n')
}

function formatBookingsForWhatsApp(
  bookings: TrainerBooking[],
  variant: 'week' | 'today' | 'tomorrow',
  now: Date = new Date(),
): string {
  const today = startOfDay(now)

  if (variant === 'today' || variant === 'tomorrow') {
    const targetDate = variant === 'today' ? today : addDays(today, 1)
    const targetKey = getDateKey(targetDate)
    const dayBookings = bookings
      .filter((booking) => getDateKey(new Date(booking.slotStart)) === targetKey)
      .sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime())

    const title = variant === 'today' ? '📅 Dein Tag heute' : '📅 Dein Tag morgen'
    const header = dayBookings.length ? `${formatDateLabel(targetDate)} 🟢` : `${formatDateLabel(targetDate)} ⚪ frei`

    if (!dayBookings.length) {
      return `${title}\n\n${header}\n\nGesamt: 0 Sessions`
    }

    const lines = dayBookings.map((booking) => `• ${formatTime(new Date(booking.slotStart))} ${booking.playerName}`)
    return `${title}\n\n${header}\n${lines.join('\n')}\n\nGesamt: ${dayBookings.length} ${dayBookings.length === 1 ? 'Session' : 'Sessions'}`
  }

  const weekStart = addDays(today, -(today.getDay() === 0 ? 6 : today.getDay() - 1))
  const allDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const bookingsByDay = new Map<string, TrainerBooking[]>()

  for (const booking of bookings) {
    const key = getDateKey(new Date(booking.slotStart))
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
      (a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime(),
    )

    if (!dayBookings.length) {
      return `${formatDateLabel(day)} ⚪ frei`
    }

    const grouped = new Map<string, { time: string; playerName: string; count: number }>()
    for (const booking of dayBookings) {
      const time = formatTime(new Date(booking.slotStart))
      const key = `${time}|${booking.playerName}`
      const current = grouped.get(key)
      if (current) {
        current.count += 1
      } else {
        grouped.set(key, { time, playerName: booking.playerName, count: 1 })
      }
    }

    const lines = Array.from(grouped.values()).map((entry) =>
      entry.count > 1 ? `• ${entry.time} ${entry.playerName} (${entry.count} Sessions)` : `• ${entry.time} ${entry.playerName}`,
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

export async function runAgentTrainer(message: string, from: string): Promise<string> {
  const config = await getTrainerConfig()
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const upcomingBookings = await prisma.booking.findMany({
    where: {
      status: 'confirmed',
      slotStart: {
        gte: now.toISOString(),
        lte: nextWeek.toISOString(),
      },
    },
    orderBy: {
      slotStart: 'asc',
    },
    select: {
      playerName: true,
      playerPhone: true,
      slotStart: true,
      slotEnd: true,
      status: true,
    },
  })

  const overviewIntent = detectTrainerOverviewIntent(message)
  if (overviewIntent) {
    return formatBookingsForWhatsApp(upcomingBookings, overviewIntent, now)
  }

  const systemPrompt = `Du bist der digitale Assistent von Coach ${config.name}. Du kommunizierst DIREKT mit dem Trainer.

WICHTIG: Beim ersten Kontakt oder bei allgemeinen Anfragen, begrüße ihn IMMER mit seinem Namen:
"Hallo Fernando 👋 [Antwort]"

So weiß der Trainer sofort: Du sprichst mit dem Trainer-Assistenten, nicht mit dem Spieler-Bot.
Antworte auf Deutsch, kurz und direkt.
WICHTIG: Stelle am Ende KEINE Rückfragen wie "Möchtest du weitere Termine sehen?" — der Trainer weiß selbst was er braucht. Nur antworten was gefragt wurde.

## Trainer-Kontext
- Trainer: ${config.name}
- Telefonnummer des Trainers: ${config.trainerPhone ?? process.env.TRAINER_PHONE ?? from}
- Location: ${config.location}
- Preise: ${config.priceSingle}€/Stunde | 5er-Paket: ${config.pricePackage5}€ | 10er-Paket: ${config.pricePackage10}€
- Aktuelles Datum/Zeit: ${now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}, ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr

## Buchungen der nächsten 7 Tage
${formatUpcomingBookings(upcomingBookings)}

## Tool-Regeln
- Nutze dieselben Tools wie gewohnt: check_slots, create_booking, cancel_booking.
- Nutze check_slots, wenn Fernando freie Termine sehen will.
- Nutze create_booking nur mit slot_start, player_name und player_phone.
- Nutze cancel_booking nur mit der Telefonnummer des Spielers.
- Wenn die Antwort schon direkt aus dem Kontext möglich ist, antworte ohne Tool-Call.
- Keine Konversationshistorie verwenden. Behandle jede Nachricht eigenständig.`

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
    return text.trim() || 'Entschuldigung, bitte versuche es nochmal.'
  }

  return 'Entschuldigung, ich konnte deine Anfrage nicht verarbeiten.'
}
