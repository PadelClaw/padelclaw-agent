import { convexMutation, convexQuery } from '@/lib/convex-http'

type MessageLogEntry = {
  role: string
  body: string
}

type PlayerPayload = {
  name: string
}

export async function getHistory(from: string, limit = 10) {
  const logs = await convexQuery<MessageLogEntry[]>('messageLogs:getRecentLogs', {
    from,
    limitHours: 72,
    limit,
  })

  return logs.map((log) => ({
    role: log.role as 'user' | 'assistant',
    content: log.body,
  }))
}

export async function getOrCreatePlayer(phone: string, name?: string): Promise<{ name: string | null }> {
  if (name?.trim()) {
    const player = await convexMutation<PlayerPayload>('players:upsertPlayer', {
      phone,
      name: name.trim(),
    })
    return { name: player.name }
  }

  const player = await convexQuery<PlayerPayload | null>('players:getPlayer', {
    phone,
  })

  return { name: player?.name ?? null }
}
