import * as fs from 'fs'
import * as path from 'path'
import { toAnthropicTools, runWithTools } from './anthropic'
import { toolDefinitions, executeTool } from './tools'
import { getHistory, getOrCreatePlayer } from './history'
import { getTrainerConfig } from '@/lib/db/trainer-config'

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

  // Convert history to user/assistant pairs for Anthropic
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      anthropicMessages.push({ role: msg.role, content: typeof msg.content === 'string' ? msg.content : '' })
    }
  }
  anthropicMessages.push({ role: 'user', content: userMessage })

  const tools = toAnthropicTools(toolDefinitions)

  const result = await runWithTools({
    system: systemPrompt,
    messages: anthropicMessages,
    tools,
    executeTool,
    onToolUse: async (name, args) => {
      if (name === 'create_booking' && typeof args.player_name === 'string' && args.player_name.trim()) {
        await getOrCreatePlayer(from, args.player_name.trim())
      }
    },
  })

  return result || 'Entschuldigung, ich konnte deine Anfrage nicht verarbeiten.'
}
