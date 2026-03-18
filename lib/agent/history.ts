import { prisma } from '@/lib/prisma'
export async function getHistory(from: string, limit = 10) {
  const logs = await prisma.messageLog.findMany({
    where: { from },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { role: true, body: true },
  })
  return logs.reverse().map(l => ({ role: l.role as 'user' | 'assistant', content: l.body }))
}
