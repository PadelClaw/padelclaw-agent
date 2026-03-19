import ical from 'ical-generator'
import { getTrainerConfig } from '@/lib/db/trainer-config'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    trainerId: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  const { trainerId } = await context.params
  const normalizedId = trainerId.replace(/\.ics$/i, '')
  const trainerIdNumber = Number.parseInt(normalizedId, 10)

  if (!Number.isFinite(trainerIdNumber)) {
    return new Response('Invalid trainerId', { status: 400 })
  }

  const trainer = await getTrainerConfig(trainerIdNumber)
  if (!trainer) {
    return new Response('Trainer not found', { status: 404 })
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'confirmed',
    },
    orderBy: {
      slotStart: 'asc',
    },
  })

  const calendar = ical({
    name: `${trainer.name} Trainings`,
    prodId: { company: 'PadelClaw', product: 'Trainer Calendar Feed' },
  })

  for (const booking of bookings) {
    const start = new Date(booking.slotStart)
    const end = new Date(booking.slotEnd)
    const safeEnd = Number.isNaN(end.getTime()) || end <= start
      ? new Date(start.getTime() + 60 * 60 * 1000)
      : end

    calendar.createEvent({
      id: `booking-${booking.id}@padelclaw.ai`,
      start,
      end: safeEnd,
      summary: booking.playerName,
      location: trainer.location,
    })
  }

  return new Response(calendar.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="${trainerIdNumber}.ics"`,
    },
  })
}
