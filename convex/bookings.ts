import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const createBooking = mutation({
  args: {
    trainerId: v.id('trainers'),
    playerName: v.string(),
    playerPhone: v.string(),
    slot: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('bookings', {
      ...args,
      status: 'confirmed',
      createdAt: Date.now(),
    });
  },
});

export const getByTrainer = query({
  args: {
    trainerId: v.id('trainers'),
  },
  handler: async (ctx, { trainerId }) => {
    return await ctx.db
      .query('bookings')
      .withIndex('by_trainer', (q) => q.eq('trainerId', trainerId))
      .collect();
  },
});

export const getTodayByTrainer = query({
  args: {
    trainerId: v.id('trainers'),
  },
  handler: async (ctx, { trainerId }) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_trainer', (q) => q.eq('trainerId', trainerId))
      .collect();

    return bookings.filter((booking) => booking.slot.startsWith(todayKey));
  },
});
