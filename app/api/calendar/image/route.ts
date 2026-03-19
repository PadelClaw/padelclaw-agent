import { NextRequest } from 'next/server'
import { generateWeekImage } from '@/lib/calendar/generate-image'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const trainerId = req.nextUrl.searchParams.get('trainerId')

  if (!trainerId) {
    return new Response('Missing trainerId', { status: 400 })
  }

  try {
    const imageBuffer = await generateWeekImage(trainerId)
    return new Response(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate image'
    const status = message === 'Trainer not found' || message === 'Invalid trainerId' ? 404 : 500
    return new Response(message, { status })
  }
}
