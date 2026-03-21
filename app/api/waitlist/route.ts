import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const CONVEX_HTTP_URL = 'https://intent-squirrel-292.eu-west-1.convex.cloud/api/mutation'

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

    try {
      const convexResponse = await fetch(CONVEX_HTTP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: 'waitlist:add',
          args: { email },
          format: 'json',
        }),
      })

      if (!convexResponse.ok) {
        const errorText = await convexResponse.text()
        console.error('Convex waitlist mutation failed', {
          status: convexResponse.status,
          body: errorText,
          email,
        })
      }
    } catch (error) {
      console.error('Convex waitlist mutation unreachable', {
        error,
        email,
      })
    }

    return NextResponse.json({ message: 'Waitlist-Eintrag gespeichert.' }, { status: 201 })
  } catch {
    return NextResponse.json(
      { message: 'Waitlist konnte nicht gespeichert werden.' },
      { status: 500 }
    )
  }
}
