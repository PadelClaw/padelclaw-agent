import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const add = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existing = await ctx.db
      .query('waitlist')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (existing) {
      return { success: false, message: 'Email bereits registriert.' };
    }

    await ctx.db.insert('waitlist', { email, createdAt: Date.now() });
    return { success: true };
  },
});
