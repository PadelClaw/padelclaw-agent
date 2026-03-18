import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/runner'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    const from = params.get('From') ?? ''
    const messageBody = params.get('Body') ?? ''

    const response = await runAgent(messageBody, from)
    const durationMs = Date.now() - start

    await prisma.messageLog.createMany({
      data: [
        { from, body: messageBody, role: 'user', durationMs: 0 },
        { from, body: response, role: 'assistant', durationMs },
      ],
    })

    const escaped = response
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (err) {
    console.error('Webhook error:', err)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Entschuldigung, es gab einen Fehler. Bitte versuche es nochmal.</Message></Response>'
    return new NextResponse(twiml, { status: 200, headers: { 'Content-Type': 'text/xml' } })
  }
}
