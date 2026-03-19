import { NextRequest } from 'next/server'
import { runAgent } from '@/lib/agent/runner'
import { prisma } from '@/lib/prisma'
import { sendWhatsApp } from '@/lib/twilio'

export const runtime = 'nodejs'

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = new URLSearchParams(body)
  const from = params.get('From') ?? ''
  const messageBody = params.get('Body') ?? ''

  // Respond to Twilio immediately (avoids 15s timeout)
  // Process message and reply via REST API in the background
  processMessage(from, messageBody).catch((err) =>
    console.error('Background message processing failed:', err),
  )

  return new Response(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

async function processMessage(from: string, messageBody: string) {
  const start = Date.now()
  let response: string

  try {
    response = await runAgent(messageBody, from)
  } catch (err) {
    console.error('Agent error:', err)
    response = 'Entschuldigung, bitte versuche es nochmal.'
  }

  const durationMs = Date.now() - start

  await Promise.all([
    prisma.messageLog.createMany({
      data: [
        { from, body: messageBody, role: 'user', durationMs: 0 },
        { from, body: response, role: 'assistant', durationMs },
      ],
    }),
    sendWhatsApp(from, response),
  ])
}
