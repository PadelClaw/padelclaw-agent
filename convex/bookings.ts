import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const DAY_SLOTS: Record<number, [number, number]> = {
  1: [9, 19],
  2: [9, 19],
  3: [9, 19],
  4: [9, 19],
  5: [9, 19],
  6: [10, 14],
};

const PREFERRED_RANGES: Record<string, [number, number]> = {
  vormittag: [9, 12],
  nachmittag: [12, 17],
  abend: [17, 19],
  any: [0, 23],
};

export const createBooking = mutation({
  args: {
    trainerId: v.optional(v.id('trainers')),
    playerName: v.string(),
    playerPhone: v.string(),
    slotStart: v.string(),
    slotEnd: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('bookings', {
      ...args,
      status: 'confirmed',
      createdAt: Date.now(),
    });
  },
});

export const findConflict = query({
  args: {
    slotStart: v.string(),
  },
  handler: async (ctx, { slotStart }) => {
    const bookings = await ctx.db.query('bookings').collect();

    return (
      bookings.find((booking) => booking.status === 'confirmed' && booking.slotStart === slotStart) ?? null
    );
  },
});

export const findByPhone = query({
  args: {
    playerPhone: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { playerPhone, status }) => {
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_player_phone', (q) => q.eq('playerPhone', playerPhone))
      .collect();

    const targetStatus = status ?? 'confirmed';
    const matches = bookings
      .filter((booking) => booking.status === targetStatus)
      .sort((left, right) => right.createdAt - left.createdAt);

    return matches[0] ?? null;
  },
});

export const cancelBooking = mutation({
  args: {
    bookingId: v.id('bookings'),
  },
  handler: async (ctx, { bookingId }) => {
    await ctx.db.patch(bookingId, {
      status: 'cancelled',
    });
  },
});

export const updateCalendarEventId = mutation({
  args: {
    bookingId: v.id('bookings'),
    calendarEventId: v.string(),
  },
  handler: async (ctx, { bookingId, calendarEventId }) => {
    await ctx.db.patch(bookingId, {
      calendarEventId,
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

    return bookings.filter((booking) => booking.slotStart.startsWith(todayKey));
  },
});

export const getFreeSlots = query({
  args: {
    date: v.string(),
    trainerPhone: v.optional(v.string()),
    timePreference: v.optional(v.string()),
  },
  handler: async (ctx, { date, trainerPhone, timePreference }) => {
    const baseDate = Number.isNaN(new Date(date).getTime()) ? new Date() : new Date(date);
    const pref = timePreference ?? 'any';
    const [prefStart, prefEnd] = PREFERRED_RANGES[pref] ?? PREFERRED_RANGES.any;

    let trainerId;
    if (trainerPhone) {
      const trainer = await ctx.db
        .query('trainers')
        .withIndex('by_phone', (q) => q.eq('phone', trainerPhone))
        .first();
      trainerId = trainer?._id;
    }

    const bookings = trainerId
      ? await ctx.db
          .query('bookings')
          .withIndex('by_trainer', (q) => q.eq('trainerId', trainerId))
          .collect()
      : await ctx.db.query('bookings').collect();

    const confirmed = bookings.filter((booking) => booking.status === 'confirmed');
    const slots: Array<{ label: string; start: string; end: string }> = [];

    for (let offset = 0; offset < 14 && slots.length < 5; offset += 1) {
      const day = new Date(baseDate);
      day.setDate(baseDate.getDate() + offset);
      day.setHours(0, 0, 0, 0);

      const hours = DAY_SLOTS[day.getDay()];
      if (!hours) {
        continue;
      }

      const dayKey = day.toISOString().slice(0, 10);
      const bookedHours = new Set(
        confirmed
          .filter((booking) => booking.slotStart.startsWith(dayKey))
          .map((booking) => new Date(booking.slotStart).getHours()),
      );

      const [dayStart, dayEnd] = hours;
      for (let hour = Math.max(dayStart, prefStart); hour < Math.min(dayEnd, prefEnd); hour += 1) {
        if (bookedHours.has(hour)) {
          continue;
        }

        const slotStart = new Date(day);
        slotStart.setHours(hour, 0, 0, 0);
        if (slotStart <= new Date()) {
          continue;
        }

        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
        const label =
          new Intl.DateTimeFormat('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          }).format(slotStart) + `, ${String(hour).padStart(2, '0')}:00 Uhr`;

        slots.push({
          label,
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });

        if (slots.length >= 5) {
          break;
        }
      }
    }

    return slots;
  },
});
