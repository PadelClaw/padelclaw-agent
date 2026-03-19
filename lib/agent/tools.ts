import type { ChatCompletionTool } from 'openai/resources'
import { getTrainerConfig } from '@/lib/db/trainer-config'
import { prisma } from '@/lib/prisma'
import { getOrCreatePlayer } from './history'
import {
  getNextAvailableSlotOptions,
  createCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarEnabled,
  type PreferredTime,
} from '@/lib/calendar/google-calendar'

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_slots',
      description: 'Zeigt verfügbare Trainingslots. Nutze dies wenn der Spieler Termine sehen oder buchen möchte.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Datum z.B. morgen, Freitag, 2026-03-20' },
          time_preference: { type: 'string', enum: ['vormittag','nachmittag','abend','any'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Erstellt eine Buchung im Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          slot_start: { type: 'string', description: 'ISO-Datetime des Slots' },
          player_name: { type: 'string' },
          player_phone: { type: 'string' },
        },
        required: ['slot_start', 'player_name', 'player_phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description: 'Storniert die neueste Buchung eines Spielers.',
      parameters: {
        type: 'object',
        properties: {
          player_phone: { type: 'string' },
        },
        required: ['player_phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_prices',
      description: 'Gibt aktuelle Preise zurück.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

export async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  const config = await getTrainerConfig()

  if (name === 'get_prices') {
    return JSON.stringify({ single: config.priceSingle, package5: config.pricePackage5, package10: config.pricePackage10 })
  }

  if (name === 'check_slots') {
    if (!isGoogleCalendarEnabled()) return JSON.stringify([{ label: 'Mo, 20.03., 10:00 Uhr', start: new Date().toISOString() }])
    const pref = (args.time_preference ?? 'any') as PreferredTime
    const slots = await getNextAvailableSlotOptions(config.calendarId, pref)
    return JSON.stringify(slots.slice(0, 5))
  }

  if (name === 'create_booking') {
    const slotEnd = new Date(new Date(args.slot_start).getTime() + 3600000).toISOString()
    let eventId: string | null = null
    if (isGoogleCalendarEnabled()) {
      eventId = await createCalendarEvent({
        summary: `🎾 Training: ${args.player_name} (${args.player_phone})`,
        startDateTime: args.slot_start,
        endDateTime: slotEnd,
        description: `Spieler: ${args.player_name}\nTelefon: ${args.player_phone}\nBuchung via PadelClaw Agent`,
        location: config.location,
        calendarId: config.calendarId,
      })
    }
    await prisma.booking.create({
      data: { playerName: args.player_name, playerPhone: args.player_phone, slotStart: args.slot_start, slotEnd, calendarEventId: eventId, status: 'confirmed' }
    })
    await getOrCreatePlayer(args.player_phone, args.player_name)
    const date = new Date(args.slot_start)
    const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    const timeLabel = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
    return JSON.stringify({ success: true, eventId, dateLabel, timeLabel, location: config.location })
  }

  if (name === 'cancel_booking') {
    const booking = await prisma.booking.findFirst({
      where: { playerPhone: args.player_phone, status: 'confirmed' },
      orderBy: { createdAt: 'desc' },
    })
    if (!booking) return JSON.stringify({ error: 'Keine aktive Buchung gefunden' })
    if (booking.calendarEventId && isGoogleCalendarEnabled()) await deleteCalendarEvent(booking.calendarEventId)
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } })
    const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(booking.slotStart))
    return JSON.stringify({ success: true, dateLabel })
  }

  return JSON.stringify({ error: 'Unknown tool' })
}
