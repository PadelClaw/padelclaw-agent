import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existingOtps = await ctx.db
      .query('otps')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .collect();

    for (const otp of existingOtps) {
      if (!otp.used) {
        await ctx.db.patch(otp._id, { used: true });
      }
    }

    return await ctx.db.insert('otps', {
      ...args,
      used: false,
    });
  },
});

export const verify = mutation({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { phone, code }) => {
    const now = Date.now();
    const otps = await ctx.db
      .query('otps')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .collect();

    const matchingOtp = otps
      .filter((otp) => !otp.used && otp.code === code && otp.expiresAt >= now)
      .sort((left, right) => right.expiresAt - left.expiresAt)[0];

    if (!matchingOtp) {
      return { success: false };
    }

    await ctx.db.patch(matchingOtp._id, { used: true });

    return {
      success: true,
      phone,
    };
  },
});
