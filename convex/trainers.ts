import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const MAGIC_TOKEN_LENGTH = 6;
const MAGIC_TOKEN_TTL_MS = 1000 * 60 * 15;
const MAGIC_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateMagicToken() {
  let token = '';

  for (let index = 0; index < MAGIC_TOKEN_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * MAGIC_TOKEN_ALPHABET.length);
    token += MAGIC_TOKEN_ALPHABET[randomIndex];
  }

  return token;
}

export const createTrainer = mutation({
  args: {
    email: v.string(),
    phone: v.string(),
    name: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    const existingTrainer = await ctx.db
      .query('trainers')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existingTrainer) {
      throw new Error('Trainer with this email already exists');
    }

    const now = Date.now();
    const magicToken = generateMagicToken();

    return await ctx.db.insert('trainers', {
      ...args,
      createdAt: now,
      magicToken,
      magicTokenExpiry: now + MAGIC_TOKEN_TTL_MS,
      verified: false,
      agentDeployed: false,
    });
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query('trainers')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();
  },
});

export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    return await ctx.db
      .query('trainers')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first();
  },
});

export const getByMagicToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query('trainers')
      .withIndex('by_magic_token', (q) => q.eq('magicToken', token))
      .first();
  },
});

export const verifyMagicToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const trainer = await ctx.db
      .query('trainers')
      .withIndex('by_magic_token', (q) => q.eq('magicToken', token))
      .first();

    if (!trainer) {
      return { success: false, message: 'Magic token not found' };
    }

    if (trainer.magicTokenExpiry < Date.now()) {
      return { success: false, message: 'Magic token expired' };
    }

    await ctx.db.patch(trainer._id, {
      verified: true,
    });

    return { success: true, trainerId: trainer._id };
  },
});

export const ensureTrainer = mutation({
  args: {
    email: v.string(),
    phone: v.string(),
    name: v.string(),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trainerByPhone = await ctx.db
      .query('trainers')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first();

    if (trainerByPhone) {
      await ctx.db.patch(trainerByPhone._id, {
        email: args.email,
        name: args.name,
        verified: true,
      });

      return trainerByPhone._id;
    }

    const trainerByEmail = await ctx.db
      .query('trainers')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (trainerByEmail) {
      await ctx.db.patch(trainerByEmail._id, {
        phone: args.phone,
        name: args.name,
        verified: true,
      });

      return trainerByEmail._id;
    }

    return await ctx.db.insert('trainers', {
      email: args.email,
      phone: args.phone,
      name: args.name,
      plan: args.plan ?? 'free',
      createdAt: Date.now(),
      magicToken: '',
      magicTokenExpiry: 0,
      verified: true,
      agentDeployed: false,
    });
  },
});
