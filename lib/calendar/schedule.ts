import { prisma } from '@/lib/prisma'

export type TrainerScheduleBooking = {
  id: number
  playerName: string
  playerPhone: string
  slotStart: string
  slotEnd: string
  status: string
}

export const SCHEDULE_START_HOUR = 9
export const SCHEDULE_END_HOUR = 19
export const DAY_COUNT = 7
const DAY_MS = 24 * 60 * 60 * 1000

export function parseBookingDate(value: string): Date {
  return new Date(value)
}

export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function getUpcomingDays(now: Date = new Date()): Date[] {
  const firstDay = startOfDay(now)
  return Array.from({ length: DAY_COUNT }, (_, index) => addDays(firstDay, index))
}

export function getIsoWeek(date: Date): number {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7))
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
}

export function getDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getBookingEndDate(booking: Pick<TrainerScheduleBooking, 'slotStart' | 'slotEnd'>): Date {
  const start = parseBookingDate(booking.slotStart)
  const end = parseBookingDate(booking.slotEnd)

  if (Number.isNaN(end.getTime()) || end <= start) {
    return new Date(start.getTime() + 60 * 60 * 1000)
  }

  return end
}

export async function getUpcomingTrainerBookings(now: Date = new Date()): Promise<TrainerScheduleBooking[]> {
  const rangeStart = startOfDay(now)
  const rangeEnd = addDays(rangeStart, DAY_COUNT)

  return prisma.booking.findMany({
    where: {
      status: 'confirmed',
      slotStart: {
        gte: rangeStart.toISOString(),
        lt: rangeEnd.toISOString(),
      },
    },
    orderBy: {
      slotStart: 'asc',
    },
    select: {
      id: true,
      playerName: true,
      playerPhone: true,
      slotStart: true,
      slotEnd: true,
      status: true,
    },
  })
}
