import * as fs from 'fs'
import * as path from 'path'
import { ollamaClient, AGENT_MODEL } from './ollama'
import { toolDefinitions, executeTool } from './tools'
import { getHistory, getOrCreatePlayer } from './history'
import { getTrainerConfig } from '@/lib/db/trainer-config'
import type { ChatCompletionMessageParam } from 'openai/resources'

export async function runAgent(userMessage: string, from: string): Promise<string> {
  const soulPath = path.join(process.cwd(), 'agents/fernando/SOUL.md')
  const soul = fs.existsSync(soulPath)
    ? fs.readFileSync(soulPath, 'utf-8')
    : 'Du bist ein hilfreicher Padel-Buchungsassistent.'

  // Lade Config direkt in System-Prompt — kein Tool-Call für simple Infos nötig
  const config = await getTrainerConfig()
  const now = new Date()
  const player = await getOrCreatePlayer(from)
  const playerContext = player.name
    ? `\n\nDer Spieler heißt: ${player.name}. Verwende diesen Namen und frage nicht erneut danach.`
    : ''
  const phoneContext = `\n\nDie WhatsApp-Nummer des Spielers ist: ${from}. Nutze diese als player_phone beim Buchen — frage NICHT danach.`

  const systemPrompt = `${soul}

## Aktuelle Trainer-Daten (direkt verfügbar, kein Tool-Call nötig):
- Preise: ${config.priceSingle}€/Stunde | 5er-Paket: ${config.pricePackage5}€ | 10er-Paket: ${config.pricePackage10}€
- Location: ${config.location}
- Verfügbarkeit: Mo-Fr 09-19 Uhr, Sa 10-14 Uhr, So kein Training
- Aktuelles Datum/Zeit: ${now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}, ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr

Nutze Tools NUR für: Slots anzeigen (check_slots), Buchung erstellen (create_booking), Buchung stornieren (cancel_booking).
Preise und Verfügbarkeitsinfos kannst du direkt aus obigen Daten beantworten.${playerContext}${phoneContext}`

  const history = await getHistory(from, 20)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
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
        const args = JSON.parse(toolCall.function.arguments || '{}')
        if (toolCall.function.name === 'create_booking' && typeof args.player_name === 'string' && args.player_name.trim()) {
          await getOrCreatePlayer(from, args.player_name.trim())
        }
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
