import { prisma } from '@/lib/prisma'
import type { TrainerConfig } from '@prisma/client'

function normalizeTrainerPhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9)
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
        name: 'Fernando García',
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
  const normalizedInput = normalizeTrainerPhone(phone)

  if (!normalizedInput) return false

  const configs = await prisma.trainerConfig.findMany({
    where: {
      trainerPhone: {
        not: null,
      },
    },
    select: {
      trainerPhone: true,
    },
  })

  return configs.some((config) => {
    if (!config.trainerPhone) return false
    return normalizeTrainerPhone(config.trainerPhone) === normalizedInput
  })
}
