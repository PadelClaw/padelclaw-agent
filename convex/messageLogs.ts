import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const createLog = mutation({
  args: {
    from: v.string(),
    trainerId: v.optional(v.id('trainers')),
    body: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messageLogs', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getRecentLogs = query({
  args: {
    from: v.string(),
    limitHours: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { from, limitHours, limit }) => {
    const hours = limitHours ?? 72;
    const maxEntries = limit ?? 20;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    const logs = await ctx.db
      .query('messageLogs')
      .withIndex('by_from_created', (q) => q.eq('from', from).gte('createdAt', cutoff))
      .order('desc')
      .take(maxEntries);

    return logs
      .reverse()
      .map((log) => ({ role: log.role, body: log.body }));
  },
});
