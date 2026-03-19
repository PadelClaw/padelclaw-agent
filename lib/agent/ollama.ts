import OpenAI from 'openai'

export const ollamaClient = new OpenAI({
  baseURL: 'https://ollama.com/v1',
  apiKey: process.env.OLLAMA_API_KEY!,
})

// Wechsel zu claude-haiku via Ollama Cloud wenn verfügbar
export const AGENT_MODEL = process.env.AGENT_MODEL ?? 'minimax-m2.7'
