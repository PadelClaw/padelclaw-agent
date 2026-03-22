import type { ChatCompletionTool } from 'openai/resources'
import { convexMutation, convexQuery } from '@/lib/convex-http'
import { getTrainerConfig } from '@/lib/db/trainer-config'
import { getOrCreatePlayer } from './history'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarEnabled,
  type PreferredTime,
} from '@/lib/calendar/google-calendar'

type FreeSlot = {
  label: string
  start: string
  end: string
}

type BookingRecord = {
  _id: string
  slotStart: string
  slotEnd: string
  calendarEventId?: string
}

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
    const pref = (args.time_preference ?? 'any') as PreferredTime
    const targetDate = args.date_preference ?? args.date ?? new Date().toISOString()
    const slots = await convexQuery<FreeSlot[]>('bookings:getFreeSlots', {
      date: targetDate,
      trainerPhone: config.trainerPhone,
      timePreference: pref,
    })

    return JSON.stringify(slots.length ? slots : [{ error: 'Keine freien Slots in den nächsten 14 Tagen' }])
  }

  if (name === 'create_booking') {
    const slotStart = args.slot_start
    const slotEnd = new Date(new Date(slotStart).getTime() + 3600000).toISOString()
    const playerPhone = args.player_phone || 'via-whatsapp'

    const conflict = await convexQuery<BookingRecord | null>('bookings:findConflict', {
      slotStart,
    })
    if (conflict) {
      const date = new Date(slotStart)
      const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(date)
      const timeLabel = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
      return JSON.stringify({ error: 'slot_taken', dateLabel, timeLabel })
    }

    const bookingId = await convexMutation<string>('bookings:createBooking', {
      trainerId: config.id === 'default-trainer' ? undefined : config.id,
      playerName: args.player_name,
      playerPhone,
      slotStart,
      slotEnd,
    })
    await getOrCreatePlayer(playerPhone, args.player_name)

    let eventId: string | null = null
    if (isGoogleCalendarEnabled()) {
      try {
        eventId = await createCalendarEvent({
          summary: `🎾 Training: ${args.player_name} (${playerPhone})`,
          startDateTime: slotStart,
          endDateTime: slotEnd,
          description: `Spieler: ${args.player_name}\nTelefon: ${playerPhone}\nBuchung via PadelClaw Agent`,
          location: config.location,
          calendarId: config.calendarId,
        })
        if (eventId) {
          await convexMutation('bookings:updateCalendarEventId', {
            bookingId,
            calendarEventId: eventId,
          })
        }
      } catch (_) {
        // Calendar failed. The booking still exists in Convex.
      }
    }

    const date = new Date(slotStart)
    const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    const timeLabel = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
    return JSON.stringify({ success: true, eventId, dateLabel, timeLabel, location: config.location })
  }

  if (name === 'cancel_booking') {
    const booking = await convexQuery<BookingRecord | null>('bookings:findByPhone', {
      playerPhone: args.player_phone,
      status: 'confirmed',
    })
    if (!booking) {
      return JSON.stringify({ error: 'Keine aktive Buchung gefunden' })
    }

    if (booking.calendarEventId && isGoogleCalendarEnabled()) {
      await deleteCalendarEvent(booking.calendarEventId)
    }

    await convexMutation('bookings:cancelBooking', {
      bookingId: booking._id,
    })

    const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(booking.slotStart))
    return JSON.stringify({ success: true, dateLabel })
  }

  return JSON.stringify({ error: 'Unknown tool' })
}
