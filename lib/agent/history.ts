import { prisma } from '@/lib/prisma'

export async function getHistory(from: string, limit = 10) {
  const logs = await prisma.messageLog.findMany({
    where: {
      from,
      createdAt: {
        gte: new Date(Date.now() - 72 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { role: true, body: true },
  })
  return logs.reverse().map(l => ({ role: l.role as 'user' | 'assistant', content: l.body }))
}

export async function getOrCreatePlayer(phone: string, name?: string): Promise<{ name: string | null }> {
  if (name) {
    const player = await prisma.player.upsert({
      where: { phone },
      update: { name },
      create: { phone, name },
      select: { name: true },
    })
    return { name: player.name }
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: { name: true },
  })

  return { name: player?.name ?? null }
}
