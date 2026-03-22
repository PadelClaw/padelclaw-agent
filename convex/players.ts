import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const upsertPlayer = mutation({
  args: {
    phone: v.string(),
    name: v.string(),
    trainerId: v.optional(v.id('trainers')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('players')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        ...(args.trainerId ? { trainerId: args.trainerId } : {}),
        lastSeen: now,
      });
      return { name: args.name };
    }

    await ctx.db.insert('players', {
      phone: args.phone,
      name: args.name,
      ...(args.trainerId ? { trainerId: args.trainerId } : {}),
      lastSeen: now,
    });

    return { name: args.name };
  },
});

export const getPlayer = query({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, { phone }) => {
    const player = await ctx.db
      .query('players')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first();

    return player ? { name: player.name } : null;
  },
});
