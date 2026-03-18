import OpenAI from 'openai'
export const ollamaClient = new OpenAI({
  baseURL: 'https://api.ollama.com/v1',
  apiKey: process.env.OLLAMA_API_KEY!,
})
export const AGENT_MODEL = 'qwen3.5:9b'
