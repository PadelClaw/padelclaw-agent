import OpenAI from 'openai'
export const ollamaClient = new OpenAI({
  baseURL: 'https://ollama.com/v1',
  apiKey: process.env.OLLAMA_API_KEY!,
})
export const AGENT_MODEL = 'minimax-m2.5'
