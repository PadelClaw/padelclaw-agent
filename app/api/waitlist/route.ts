import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WAITLIST_FILE = path.join(process.cwd(), 'public', 'waitlist.json')

type WaitlistEntry = {
  email: string
  createdAt: string
}

async function readWaitlist(): Promise<WaitlistEntry[]> {
  try {
    const contents = await fs.readFile(WAITLIST_FILE, 'utf8')
    const parsed = JSON.parse(contents) as unknown
    return Array.isArray(parsed) ? (parsed as WaitlistEntry[]) : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

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

    const entries = await readWaitlist()

    if (entries.some((entry) => entry.email === email)) {
      return NextResponse.json({ message: 'Diese E-Mail ist bereits eingetragen.' })
    }

    const nextEntries = [
      ...entries,
      {
        email,
        createdAt: new Date().toISOString(),
      },
    ]

    await fs.mkdir(path.dirname(WAITLIST_FILE), { recursive: true })
    await fs.writeFile(WAITLIST_FILE, JSON.stringify(nextEntries, null, 2) + '\n', 'utf8')

    return NextResponse.json({ message: 'Waitlist-Eintrag gespeichert.' }, { status: 201 })
  } catch {
    return NextResponse.json(
      { message: 'Waitlist konnte nicht gespeichert werden.' },
      { status: 500 }
    )
  }
}
