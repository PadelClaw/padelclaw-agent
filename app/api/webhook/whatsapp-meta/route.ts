import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/runner'
import { runAgentTrainer } from '@/lib/agent/runner-trainer'
import { prisma } from '@/lib/prisma'
import { isTrainerPhone } from '@/lib/db/trainer-config'
import { sendWhatsApp, sendWhatsAppImage } from '@/lib/whatsapp-meta'
import { transcribeAudio } from '@/lib/whatsapp-media'

export const runtime = 'nodejs'

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string
          type?: string
          audio?: {
            id?: string
          }
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
  let messageBody = message?.text?.body?.trim() ?? ''

  if (message?.type === 'audio') {
    const mediaId = message.audio?.id?.trim()

    if (mediaId) {
      try {
        messageBody = (await transcribeAudio(mediaId)).trim()
      } catch (err) {
        console.error('Meta audio transcription failed:', err)
        messageBody = '[Sprachnachricht konnte nicht transkribiert werden]'
      }
    } else {
      messageBody = '[Sprachnachricht konnte nicht transkribiert werden]'
    }
  }

  if (from && messageBody) {
    processMessage(from, messageBody).catch((err) =>
      console.error('Background Meta WhatsApp processing failed:', err),
    )
  }

  return NextResponse.json({ ok: true })
}

async function processMessage(from: string, messageBody: string) {
  const start = Date.now()
  let responseText: string

  try {
    const trainerMode = await isTrainerPhone(from)
    if (trainerMode) {
      const response = await runAgentTrainer(messageBody, from)
      responseText =
        response.type === 'text'
          ? response.body
          : response.caption ?? '[Kalenderbild gesendet]'

      if (response.type === 'image') {
        await sendWhatsAppImage(
          from,
          Buffer.from(response.imageBase64, 'base64'),
          response.caption,
        )
      } else {
        await sendWhatsApp(from, response.body)
      }
    } else {
      responseText = await runAgent(messageBody, from)
      await sendWhatsApp(from, responseText)
    }
  } catch (err) {
    console.error('Agent error:', err)
    responseText = 'Entschuldigung, bitte versuche es nochmal.'
    await sendWhatsApp(from, responseText)
  }

  const durationMs = Date.now() - start

  await prisma.messageLog.createMany({
    data: [
      { from, body: messageBody, role: 'user', durationMs: 0 },
      { from, body: responseText, role: 'assistant', durationMs },
    ],
  })
}
