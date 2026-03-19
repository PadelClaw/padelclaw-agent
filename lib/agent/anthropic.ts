import Anthropic from '@anthropic-ai/sdk'

export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const AGENT_MODEL = 'claude-haiku-4-5-20251001'

export type AnthropicTool = Anthropic.Tool

/** Convert OpenAI-style tool defs to Anthropic format */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toAnthropicTools(openaiTools: any[]): AnthropicTool[] {
  return openaiTools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? '',
    input_schema: (t.function.parameters ?? { type: 'object', properties: {} }) as Anthropic.Tool['input_schema'],
  }))
}

export interface RunWithToolsOptions {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: AnthropicTool[]
  executeTool: (name: string, args: Record<string, string>) => Promise<string>
  onToolUse?: (name: string, args: Record<string, string>) => Promise<void>
  maxIterations?: number
}

export async function runWithTools(opts: RunWithToolsOptions): Promise<string> {
  const { system, tools, executeTool, onToolUse, maxIterations = 5 } = opts

  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  for (let i = 0; i < maxIterations; i++) {
    const response = await anthropicClient.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools,
    })

    // Check if there are any tool_use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlock & { type: 'tool_use' } => block.type === 'tool_use',
    )

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // Extract text response
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      )
      return textBlocks.map((b) => b.text).join('\n').trim()
    }

    // Add assistant response with tool_use blocks
    messages.push({ role: 'assistant', content: response.content })

    // Execute each tool and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const toolUse of toolUseBlocks) {
      const args = (toolUse.input ?? {}) as Record<string, string>
      if (onToolUse) await onToolUse(toolUse.name, args)
      const result = await executeTool(toolUse.name, args)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return ''
}
