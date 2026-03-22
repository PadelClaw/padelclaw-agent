import { convexQuery } from '@/lib/convex-http'

function normalizeConvexPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

type ConvexTrainerProfile = {
  _id: string
  phone: string
  name: string
  location?: string
  region?: string
  club?: string
  priceSingle?: number
  pricePackage5?: number
  pricePackage10?: number
  personality?: string
  onboardingStep?: string
}

export type TrainerConfig = {
  id: string
  name: string
  trainerPhone: string
  location: string
  priceSingle: number
  pricePackage5: number
  pricePackage10: number
  personality: string | null
  onboardingStep: string | null
  calendarId: string
}

export type TrainerChannelProfile = TrainerConfig & {
  source: 'convex'
}

async function getConvexTrainerByPhone(phone: string): Promise<ConvexTrainerProfile | null> {
  const digits = phone.replace(/\D/g, '')
  if (!digits) {
    return null
  }

  for (const candidate of [normalizeConvexPhone(phone), digits]) {
    if (!candidate) {
      continue
    }

    try {
      const trainer = await convexQuery<ConvexTrainerProfile | null>('trainers:getByPhone', {
        phone: candidate,
      })

      if (trainer) {
        return trainer
      }
    } catch (error) {
      console.error('convex trainer lookup failed', error)
      return null
    }
  }

  return null
}

function resolveTrainerConfig(trainer: ConvexTrainerProfile): TrainerConfig {
  return {
    id: trainer._id,
    name: trainer.name,
    trainerPhone: trainer.phone,
    location: trainer.location ?? trainer.club ?? trainer.region ?? 'Noch nicht gesetzt',
    priceSingle: trainer.priceSingle ?? 65,
    pricePackage5: trainer.pricePackage5 ?? 300,
    pricePackage10: trainer.pricePackage10 ?? 550,
    personality: trainer.personality ?? null,
    onboardingStep: trainer.onboardingStep ?? null,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  }
}

export async function getTrainerConfigByPhone(phone: string): Promise<TrainerConfig | null> {
  const trainer = await getConvexTrainerByPhone(phone)
  return trainer ? resolveTrainerConfig(trainer) : null
}

export async function getTrainerChannelProfileByPhone(phone: string): Promise<TrainerChannelProfile | null> {
  const trainer = await getConvexTrainerByPhone(phone)
  if (!trainer) {
    return null
  }

  return {
    source: 'convex',
    ...resolveTrainerConfig(trainer),
  }
}

export async function getTrainerConfig(): Promise<TrainerConfig>
export async function getTrainerConfig(trainerId: string | number): Promise<TrainerConfig | null>
export async function getTrainerConfig(trainerId?: string | number): Promise<TrainerConfig | null> {
  if (trainerId) {
    const trainer =
      typeof trainerId === 'string' && trainerId.startsWith('+')
        ? await convexQuery<ConvexTrainerProfile | null>('trainers:getByPhone', {
            phone: trainerId,
          }).catch(() => null)
        : await convexQuery<ConvexTrainerProfile | null>('trainers:getById', {
            trainerId: String(trainerId),
          }).catch(() => null)

    if (trainer) {
      return resolveTrainerConfig(trainer)
    }
  }

  const fallbackPhone = process.env.TRAINER_PHONE?.trim()
  if (fallbackPhone) {
    const trainer = await getConvexTrainerByPhone(fallbackPhone)
    if (trainer) {
      return resolveTrainerConfig(trainer)
    }
  }

  return {
    id: 'default-trainer',
    name: process.env.TRAINER_NAME?.trim() || 'Fernando García',
    trainerPhone: fallbackPhone || '',
    location: process.env.TRAINER_LOCATION?.trim() || 'Padel Club Ibiza',
    priceSingle: Number(process.env.TRAINER_PRICE_SINGLE || 65),
    pricePackage5: Number(process.env.TRAINER_PRICE_PACKAGE_5 || 300),
    pricePackage10: Number(process.env.TRAINER_PRICE_PACKAGE_10 || 550),
    personality: null,
    onboardingStep: 'done',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  }
}

export async function isTrainerPhone(phone: string): Promise<boolean> {
  return Boolean(await getTrainerChannelProfileByPhone(phone))
}
