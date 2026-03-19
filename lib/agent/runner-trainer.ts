import { ollamaClient, AGENT_MODEL } from './ollama'
import { toolDefinitions, executeTool } from './tools'
import { prisma } from '@/lib/prisma'
import { getTrainerConfig } from '@/lib/db/trainer-config'
import type { ChatCompletionMessageParam } from 'openai/resources'

function formatUpcomingBookings(
  bookings: Array<{
    playerName: string
    playerPhone: string
    slotStart: string
    slotEnd: string
    status: string
  }>,
): string {
  if (!bookings.length) {
    return '- Keine bestätigten Buchungen in den nächsten 7 Tagen.'
  }

  return bookings
    .map((booking) => {
      const start = new Date(booking.slotStart)
      const end = new Date(booking.slotEnd)
      const day = new Intl.DateTimeFormat('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }).format(start)
      const startTime = new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(start)
      const endTime = new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(end)

      return `- ${day} ${startTime}-${endTime}: ${booking.playerName} (${booking.playerPhone})`
    })
    .join('\n')
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
