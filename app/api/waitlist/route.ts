import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string }
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ message: 'E-Mail ist erforderlich.' }, { status: 400 })
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { message: 'Bitte gib eine gueltige E-Mail-Adresse ein.' },
        { status: 400 }
      )
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const createdAt = new Date().toISOString()

    if (!resendApiKey) {
      console.log(`Neue Waitlist Anmeldung: ${email}`, { createdAt })
      return NextResponse.json({ message: 'Waitlist-Eintrag gespeichert.' }, { status: 201 })
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'waitlist@padelclaw.ai',
        to: 'admin@padelclaw.ai',
        subject: 'Neue Waitlist Anmeldung',
        text: `Neue Waitlist Anmeldung: ${email}`,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error('Resend waitlist email failed', {
        status: resendResponse.status,
        body: errorText,
        email,
      })

      return NextResponse.json(
        { message: 'Waitlist konnte nicht gespeichert werden.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Waitlist-Eintrag gespeichert.' }, { status: 201 })
  } catch {
    return NextResponse.json(
      { message: 'Waitlist konnte nicht gespeichert werden.' },
      { status: 500 }
    )
  }
}
