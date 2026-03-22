import { prisma } from '@/lib/prisma'
import { convexQuery } from '@/lib/convex-http'
import type { TrainerConfig } from '@prisma/client'

function normalizeTrainerPhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9)
}

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

export type TrainerChannelProfile = {
  source: 'prisma' | 'convex'
  id: number | string
  name: string
  trainerPhone: string
  location: string
  priceSingle: number
  pricePackage5: number
  pricePackage10: number
  personality: string | null
  onboardingStep: string | null
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

export async function getTrainerConfigByPhone(phone: string): Promise<TrainerConfig | null> {
  const normalizedInput = normalizeTrainerPhone(phone)

  if (!normalizedInput) return null

  const configs = await prisma.trainerConfig.findMany({
    where: {
      trainerPhone: {
        not: null,
      },
    },
  })

  return (
    configs.find((config) => {
      if (!config.trainerPhone) return false
      return normalizeTrainerPhone(config.trainerPhone) === normalizedInput
    }) ?? null
  )
}

export async function getTrainerChannelProfileByPhone(phone: string): Promise<TrainerChannelProfile | null> {
  const convexTrainer = await getConvexTrainerByPhone(phone)
  if (convexTrainer) {
    return {
      source: 'convex',
      id: convexTrainer._id,
      name: convexTrainer.name,
      trainerPhone: convexTrainer.phone,
      location: convexTrainer.location ?? convexTrainer.club ?? convexTrainer.region ?? 'Noch nicht gesetzt',
      priceSingle: convexTrainer.priceSingle ?? 65,
      pricePackage5: convexTrainer.pricePackage5 ?? 300,
      pricePackage10: convexTrainer.pricePackage10 ?? 550,
      personality: convexTrainer.personality ?? null,
      onboardingStep: convexTrainer.onboardingStep ?? null,
    }
  }

  const prismaTrainer = await getTrainerConfigByPhone(phone)
  if (!prismaTrainer?.trainerPhone) {
    return null
  }

  return {
    source: 'prisma',
    id: prismaTrainer.id,
    name: prismaTrainer.name,
    trainerPhone: prismaTrainer.trainerPhone,
    location: prismaTrainer.location,
    priceSingle: prismaTrainer.priceSingle,
    pricePackage5: prismaTrainer.pricePackage5,
    pricePackage10: prismaTrainer.pricePackage10,
    personality: null,
    onboardingStep: 'done',
  }
}

export async function getTrainerConfig(): Promise<TrainerConfig>
export async function getTrainerConfig(trainerId: number): Promise<TrainerConfig | null>
export async function getTrainerConfig(trainerId?: number): Promise<TrainerConfig | null> {
  let config = trainerId
    ? await prisma.trainerConfig.findUnique({ where: { id: trainerId } })
    : await prisma.trainerConfig.findFirst()

  if (!config) {
    if (trainerId) {
      return null
    }

    config = await prisma.trainerConfig.create({
      data: {
        plan: 'free',
        name: 'Fernando García',
        clubName: 'Padel Club Ibiza',
        trainerPhone: process.env.TRAINER_PHONE?.trim() || null,
        location: 'Padel Club Ibiza',
        priceSingle: 65,
        pricePackage5: 300,
        pricePackage10: 550,
        availabilityJson: JSON.stringify({ mo:'09:00-19:00',tu:'09:00-19:00',we:'09:00-19:00',th:'09:00-19:00',fr:'09:00-19:00',sa:'10:00-14:00',su:null }),
        language: 'de',
        calendarId: 'primary',
      },
    })
  }
  return config
}

export async function isTrainerPhone(phone: string): Promise<boolean> {
  return Boolean(await getTrainerChannelProfileByPhone(phone))
}
