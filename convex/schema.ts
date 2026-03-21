import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index('by_email', ['email']),
  trainers: defineTable({
    email: v.string(),
    phone: v.string(),
    name: v.string(),
    plan: v.string(),
    createdAt: v.number(),
    magicToken: v.string(),
    magicTokenExpiry: v.number(),
    verified: v.boolean(),
    agentDeployed: v.boolean(),
  })
    .index('by_email', ['email'])
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
