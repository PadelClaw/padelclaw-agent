import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/runner'
import { prisma } from '@/lib/prisma'
import { sendWhatsApp } from '@/lib/whatsapp360'

export const runtime = 'nodejs'

type Dialog360Webhook = {
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

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as Dialog360Webhook
  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  const from = message?.from?.trim() ?? ''
  const messageBody = message?.text?.body?.trim() ?? ''

  if (from && messageBody) {
    processMessage(from, messageBody).catch((err) =>
      console.error('Background 360dialog processing failed:', err),
    )
  }

  return NextResponse.json({ ok: true })
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
