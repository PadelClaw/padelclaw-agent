import { prisma } from '@/lib/prisma'

export async function getTrainerMemory(trainerId: number): Promise<string> {
  const memories = await prisma.trainerMemory.findMany({
    where: { trainerId },
    orderBy: { updatedAt: 'desc' },
    select: { key: true, value: true },
  })

  if (!memories.length) return ''

  return memories.map((m) => `- ${m.value}`).join('\n')
}

export async function upsertTrainerMemory(
  trainerId: number,
  key: string,
  value: string,
): Promise<void> {
  await prisma.trainerMemory.upsert({
    where: { trainerId_key: { trainerId, key } },
    update: { value },
    create: { trainerId, key, value },
  })
}
