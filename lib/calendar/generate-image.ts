import { createCanvas, type CanvasRenderingContext2D } from 'canvas'
import { getTrainerConfig } from '@/lib/db/trainer-config'
import {
  DAY_COUNT,
  SCHEDULE_END_HOUR,
  SCHEDULE_START_HOUR,
  getBookingEndDate,
  getDateKey,
  getIsoWeek,
  getUpcomingDays,
  getUpcomingTrainerBookings,
  parseBookingDate,
} from '@/lib/calendar/schedule'

const WIDTH = 800
const HEIGHT = 600
const HEADER_HEIGHT = 72
const FOOTER_HEIGHT = 20
const LEFT_GUTTER = 84
const RIGHT_GUTTER = 20
const TOP_GUTTER = 20
const BOTTOM_GUTTER = 20
const HOURS = SCHEDULE_END_HOUR - SCHEDULE_START_HOUR
const COLORS = {
  green: '#16a34a',
  greenDark: '#166534',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray300: '#d1d5db',
  gray500: '#6b7280',
  gray800: '#1f2937',
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawTextInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }

    if (current) {
      lines.push(current)
    }
    current = word

    if (lines.length === maxLines) {
      break
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current)
  }

  const visibleLines = lines.slice(0, maxLines)
  if (lines.length > maxLines && visibleLines.length) {
    const lastLine = visibleLines[visibleLines.length - 1] ?? ''
    visibleLines[visibleLines.length - 1] = lastLine.length > 2 ? `${lastLine.slice(0, -1)}…` : `${lastLine}…`
  }

  visibleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * 14)
  })
}

export async function generateWeekImage(trainerId: string): Promise<Buffer> {
  const trainer = await getTrainerConfig(trainerId)
  if (!trainer) {
    throw new Error('Trainer not found')
  }

  const now = new Date()
  const bookings = await getUpcomingTrainerBookings(now, trainer.id)
  const days = getUpcomingDays(now, bookings)
  const bookingsByDay = new Map<string, typeof bookings>()

  for (const booking of bookings) {
    const key = getDateKey(parseBookingDate(booking.slotStart))
    const existing = bookingsByDay.get(key) ?? []
    existing.push(booking)
    bookingsByDay.set(key, existing)
  }

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')
  const gridX = LEFT_GUTTER
  const gridY = HEADER_HEIGHT + TOP_GUTTER + 26
  const gridWidth = WIDTH - LEFT_GUTTER - RIGHT_GUTTER
  const gridHeight = HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - TOP_GUTTER - BOTTOM_GUTTER - 26
  const columnWidth = gridWidth / DAY_COUNT
  const rowHeight = gridHeight / HOURS

  ctx.fillStyle = COLORS.gray50
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  roundedRect(ctx, 16, 16, WIDTH - 32, HEIGHT - 32, 18)
  ctx.fillStyle = COLORS.white
  ctx.fill()

  roundedRect(ctx, 16, 16, WIDTH - 32, HEADER_HEIGHT, 18)
  ctx.fillStyle = COLORS.greenDark
  ctx.fill()
  ctx.fillRect(16, HEADER_HEIGHT, WIDTH - 32, 12)

  ctx.fillStyle = COLORS.white
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText(`KW ${String(getIsoWeek(now)).padStart(2, '0')} — ${trainer.name}`, 34, 58)

  ctx.fillStyle = COLORS.gray500
  ctx.font = '12px sans-serif'
  ctx.fillText('PadelClaw Wochenkalender', 36, 96)

  ctx.fillStyle = COLORS.gray800
  ctx.font = 'bold 12px sans-serif'

  days.forEach((day, index) => {
    const x = gridX + index * columnWidth

    roundedRect(ctx, x + 4, gridY - 24, columnWidth - 8, 22, 8)
    ctx.fillStyle = COLORS.gray100
    ctx.fill()

    ctx.fillStyle = COLORS.gray800
    const label = new Intl.DateTimeFormat('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }).format(day)
    ctx.fillText(label, x + 12, gridY - 9)
  })

  for (let hour = SCHEDULE_START_HOUR; hour < SCHEDULE_END_HOUR; hour++) {
    const rowIndex = hour - SCHEDULE_START_HOUR
    const y = gridY + rowIndex * rowHeight

    ctx.fillStyle = COLORS.gray500
    ctx.font = '12px sans-serif'
    ctx.fillText(`${String(hour).padStart(2, '0')}:00`, 22, y + 17)

    for (let dayIndex = 0; dayIndex < DAY_COUNT; dayIndex++) {
      const x = gridX + dayIndex * columnWidth
      roundedRect(ctx, x + 4, y + 2, columnWidth - 8, rowHeight - 4, 10)
      ctx.fillStyle = COLORS.gray100
      ctx.fill()
      ctx.strokeStyle = COLORS.gray300
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  for (const [dayKey, dayBookings] of bookingsByDay.entries()) {
    const dayIndex = days.findIndex((day) => getDateKey(day) === dayKey)
    if (dayIndex === -1) {
      continue
    }

    for (const booking of dayBookings) {
      const start = parseBookingDate(booking.slotStart)
      const end = getBookingEndDate(booking)
      const startHour = start.getHours() + start.getMinutes() / 60
      const endHour = end.getHours() + end.getMinutes() / 60

      if (endHour <= SCHEDULE_START_HOUR || startHour >= SCHEDULE_END_HOUR) {
        continue
      }

      const clippedStart = Math.max(startHour, SCHEDULE_START_HOUR)
      const clippedEnd = Math.min(endHour, SCHEDULE_END_HOUR)
      const x = gridX + dayIndex * columnWidth + 7
      const y = gridY + (clippedStart - SCHEDULE_START_HOUR) * rowHeight + 4
      const height = Math.max((clippedEnd - clippedStart) * rowHeight - 8, 28)
      const width = columnWidth - 14

      roundedRect(ctx, x, y, width, height, 12)
      ctx.fillStyle = COLORS.green
      ctx.fill()

      ctx.fillStyle = COLORS.white
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(
        `${start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
        x + 10,
        y + 18,
      )

      ctx.font = '11px sans-serif'
      drawTextInBox(ctx, booking.playerName, x + 10, y + 34, width - 20, 2)
    }
  }

  return canvas.toBuffer('image/png')
}
