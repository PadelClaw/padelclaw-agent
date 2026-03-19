import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/runner'
import { runAgentTrainer } from '@/lib/agent/runner-trainer'
import { prisma } from '@/lib/prisma'
import { isTrainerPhone } from '@/lib/db/trainer-config'
import { sendWhatsApp } from '@/lib/whatsapp-meta'

export const runtime = 'nodejs'

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string
          text?: {
            body?: string
          }
        }>
      }
    }>
  }>
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const verifyToken = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    verifyToken &&
    verifyToken === process.env.META_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as MetaWebhookPayload
  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  const from = message?.from?.trim() ?? ''
  const messageBody = message?.text?.body?.trim() ?? ''

  if (from && messageBody) {
    processMessage(from, messageBody).catch((err) =>
      console.error('Background Meta WhatsApp processing failed:', err),
    )
  }

  return NextResponse.json({ ok: true })
}

async function processMessage(from: string, messageBody: string) {
  const start = Date.now()
  let response: string

  try {
    const trainerMode = await isTrainerPhone(from)
    response = trainerMode
      ? await runAgentTrainer(messageBody, from)
      : await runAgent(messageBody, from)
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
