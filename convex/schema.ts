import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index('by_email', ['email']),
  otps: defineTable({
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index('by_phone', ['phone']),
  trainers: defineTable({
    email: v.string(),
    phone: v.string(),
    name: v.string(),
    plan: v.string(),
    personality: v.optional(v.string()),
    onboardingStep: v.optional(v.string()),
    region: v.optional(v.string()),
    club: v.optional(v.string()),
    location: v.optional(v.string()),
    priceSingle: v.optional(v.number()),
    pricePackage5: v.optional(v.number()),
    pricePackage10: v.optional(v.number()),
    createdAt: v.number(),
    magicToken: v.string(),
    magicTokenExpiry: v.number(),
    verified: v.boolean(),
    agentDeployed: v.boolean(),
  })
    .index('by_email', ['email'])
    .index('by_phone', ['phone'])
    .index('by_magic_token', ['magicToken']),
  bookings: defineTable({
    trainerId: v.id('trainers'),
    playerName: v.string(),
    playerPhone: v.string(),
    slot: v.string(),
    status: v.string(),
    createdAt: v.number(),
  })
    .index('by_trainer', ['trainerId'])
    .index('by_trainer_slot', ['trainerId', 'slot']),
  players: defineTable({
    phone: v.string(),
    name: v.string(),
    trainerId: v.id('trainers'),
    lastSeen: v.number(),
  })
    .index('by_phone', ['phone'])
    .index('by_trainer', ['trainerId']),
});
