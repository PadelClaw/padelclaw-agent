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
      description: 'Zeigt freie Trainingslots. IMMER aufrufen bevor create_booking. Aufrufen wenn Spieler einen Termin sehen, anfragen oder buchen möchte.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Datum z.B. morgen, Freitag, 2026-03-20' },
          time_preference: { type: 'string', enum: ['vormittag','nachmittag','abend','any'] },
          date_preference: { type: 'string', description: 'ISO-Datum wenn Spieler ein bestimmtes Datum will, z.B. 2026-03-25' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Erstellt Buchung. NUR aufrufen NACHDEM Spieler eine konkrete Slot-Nummer (1-5) aus check_slots bestätigt hat. Benötigt: slot_start (ISO), player_name, player_phone.',
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
      description: 'Storniert letzte Buchung. Aufrufen wenn Spieler schreibt: stornieren, absagen, abbrechen, cancel.',
      parameters: {
        type: 'object',
        properties: {
          player_phone: { type: 'string' },
        },
        required: ['player_phone'],
      },
    },
  },
]

export async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  const config = await getTrainerConfig()

  if (name === 'check_slots') {
    if (!isGoogleCalendarEnabled()) {
      // Calculate free slots from DB-based availability (no Google Calendar needed)
      const pref = (args.time_preference ?? 'any') as PreferredTime
      const baseDate = args.date_preference ? new Date(args.date_preference) : new Date()
      const slots: { label: string; start: string }[] = []
      const daySlots: Record<number, [number, number]> = { 1: [9,19], 2: [9,19], 3: [9,19], 4: [9,19], 5: [9,19], 6: [10,14] } // Mo-Sa
      const prefRanges: Record<string, [number, number]> = { vormittag: [9,12], nachmittag: [12,17], abend: [17,19], any: [0,23] }
      const [prefStart, prefEnd] = prefRanges[pref] ?? prefRanges.any

      for (let d = 0; d < 14 && slots.length < 5; d++) {
        const day = new Date(baseDate)
        day.setDate(baseDate.getDate() + d)
        day.setHours(0, 0, 0, 0)
        const dow = day.getDay() // 0=Sun
        const range = daySlots[dow]
        if (!range) continue
        const [hStart, hEnd] = range

        // Get existing bookings for this day
        const dayStr = day.toISOString().slice(0, 10)
        const existing = await prisma.booking.findMany({
          where: { slotStart: { startsWith: dayStr }, status: 'confirmed' },
          select: { slotStart: true },
        })
        const bookedHours = new Set(existing.map(b => new Date(b.slotStart).getHours()))

        for (let h = Math.max(hStart, prefStart); h < Math.min(hEnd, prefEnd); h++) {
          if (bookedHours.has(h)) continue
          if (d === 0 && h <= new Date().getHours()) continue // skip past hours today
          const slotDate = new Date(day)
          slotDate.setHours(h, 0, 0, 0)
          const label = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(slotDate)
            + `, ${String(h).padStart(2, '0')}:00 Uhr`
          slots.push({ label, start: slotDate.toISOString() })
          if (slots.length >= 5) break
        }
      }
      return JSON.stringify(slots.length ? slots : [{ error: 'Keine freien Slots in den nächsten 14 Tagen' }])
    }
    const pref = (args.time_preference ?? 'any') as PreferredTime
    const startDate = args.date_preference ? new Date(args.date_preference) : new Date()
    const slots = await getNextAvailableSlotOptions(config.calendarId, pref, startDate)
    return JSON.stringify(slots.slice(0, 5))
  }

  if (name === 'create_booking') {
    const slotEnd = new Date(new Date(args.slot_start).getTime() + 3600000).toISOString()
    const playerPhone = args.player_phone || 'via-whatsapp'

    // Prüfe Doppelbuchung
    const conflict = await prisma.booking.findFirst({
      where: { slotStart: args.slot_start, status: 'confirmed' }
    })
    if (conflict) {
      const date = new Date(args.slot_start)
      const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(date)
      const timeLabel = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
      return JSON.stringify({ error: 'slot_taken', dateLabel, timeLabel })
    }

    // DB first — if DB fails, no orphaned calendar event
    const booking = await prisma.booking.create({
      data: { playerName: args.player_name, playerPhone: playerPhone, slotStart: args.slot_start, slotEnd, calendarEventId: null, status: 'confirmed' }
    })
    await getOrCreatePlayer(playerPhone, args.player_name)

    // Calendar second — if it fails, booking still exists (calendarEventId stays null)
    let eventId: string | null = null
    if (isGoogleCalendarEnabled()) {
      try {
        eventId = await createCalendarEvent({
          summary: `🎾 Training: ${args.player_name} (${playerPhone})`,
          startDateTime: args.slot_start,
          endDateTime: slotEnd,
          description: `Spieler: ${args.player_name}\nTelefon: ${playerPhone}\nBuchung via PadelClaw Agent`,
          location: config.location,
          calendarId: config.calendarId,
        })
        if (eventId) {
          await prisma.booking.update({ where: { id: booking.id }, data: { calendarEventId: eventId } })
        }
      } catch (_) {
        // Calendar failed — booking still valid, calendarEventId remains null
      }
    }
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
