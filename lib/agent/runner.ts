import * as fs from 'fs'
import * as path from 'path'
import { ollamaClient, AGENT_MODEL } from './ollama'
import { toolDefinitions, executeTool } from './tools'
import { getHistory } from './history'
import type { ChatCompletionMessageParam } from 'openai/resources'

export async function runAgent(userMessage: string, from: string): Promise<string> {
  const soulPath = path.join(process.cwd(), 'agents/fernando/SOUL.md')
  const soul = fs.existsSync(soulPath)
    ? fs.readFileSync(soulPath, 'utf-8')
    : 'Du bist ein hilfreicher Padel-Buchungsassistent.'

  const history = await getHistory(from, 10)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: soul },
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
        const result = await executeTool(toolCall.function.name, args)
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
      }
      continue
    }

    return choice.message.content ?? 'Entschuldigung, bitte versuche es nochmal.'
  }

  return 'Entschuldigung, ich konnte deine Anfrage nicht verarbeiten.'
}
