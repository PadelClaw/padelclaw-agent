import { google } from "googleapis";

type CalendarSlot = {
  start: string;
  end: string;
};

export type CalendarSlotOption = CalendarSlot & {
  label: string;
};

export type PreferredTime = "vormittag" | "nachmittag" | "abend" | "any";

const DEFAULT_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const DEFAULT_TIMEZONE =
  process.env.GOOGLE_CALENDAR_TIMEZONE ||
  process.env.TZ ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "Europe/Berlin";
const SLOT_DURATION_MS = 60 * 60 * 1000;
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 20;
const SEARCH_DAYS = 7;
const MAX_SLOT_OPTIONS = 5;

function isCalendarEnabled() {
  return (
    process.env.GOOGLE_CALENDAR_ENABLED === "true" &&
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_REFRESH_TOKEN)
  );
}

function getCalendarClient() {
  if (!isCalendarEnabled()) {
    return null;
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.calendar({ version: "v3", auth });
}

function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function nextFullHour(date: Date) {
  const next = startOfHour(date);
  if (next <= date) {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function isWithinBusinessHours(date: Date) {
  const hour = date.getHours();
  const endHour = isWeekday(date) ? BUSINESS_END_HOUR : 14;
  return hour >= BUSINESS_START_HOUR && hour < endHour;
}

function matchesPreferredTime(slot: CalendarSlot, preferredTime: PreferredTime) {
  if (preferredTime === "any") {
    return true;
  }

  const hour = new Date(slot.start).getHours();
  if (preferredTime === "vormittag") {
    return hour >= 8 && hour < 13;
  }

  if (preferredTime === "abend") {
    return hour >= 17 && hour < 20;
  }

  return hour >= 13 && hour < 20;
}

function formatSlotLabel(slot: CalendarSlot) {
  return formatSlotDateTime(slot.start);
}

export function formatSlotDateTime(slotStart: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(slotStart));
}

function buildCandidateSlots(startDate: Date, days = SEARCH_DAYS): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const cursor = nextFullHour(startDate);
  const end = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

  while (cursor < end) {
    if (isWithinBusinessHours(cursor)) {
      const slotEnd = new Date(cursor.getTime() + SLOT_DURATION_MS);
      slots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
      });
    }
    cursor.setHours(cursor.getHours() + 1);
  }

  return slots;
}

async function listBusyWindows(timeMin: string, timeMax: string, calendarId = DEFAULT_CALENDAR_ID) {
  const calendar = getCalendarClient();

  if (!calendar) {
    return null;
  }

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    },
  });

  return response.data.calendars?.[calendarId]?.busy ?? [];
}

function overlapsBusySlot(slot: CalendarSlot, busy: Array<{ start?: string | null; end?: string | null }>) {
  const slotStart = new Date(slot.start).getTime();
  const slotEnd = new Date(slot.end).getTime();

  return busy.some((entry) => {
    if (!entry.start || !entry.end) {
      return false;
    }

    const busyStart = new Date(entry.start).getTime();
    const busyEnd = new Date(entry.end).getTime();
    return slotStart < busyEnd && slotEnd > busyStart;
  });
}

export function isGoogleCalendarEnabled() {
  return isCalendarEnabled();
}

export async function checkAvailability(date: string, calendarId = DEFAULT_CALENDAR_ID): Promise<boolean> {
  const startDate = Number.isNaN(new Date(date).getTime()) ? new Date() : new Date(date);
  const slots = buildCandidateSlots(startDate);

  if (!slots.length) {
    return false;
  }

  const busy = await listBusyWindows(slots[0].start, slots.at(-1)!.end, calendarId);
  if (busy === null) {
    return false;
  }

  return slots.some((slot) => !overlapsBusySlot(slot, busy));
}

export async function getAvailableSlotsForDate(
  date: Date,
  calendarId = DEFAULT_CALENDAR_ID,
  preferredTime: PreferredTime = "any",
): Promise<string[]> {
  const options = await getAvailableSlotOptionsForDate(date, calendarId, preferredTime);
  return options.map((slot) => slot.label);
}

export async function getAvailableSlotOptionsForDate(
  date: Date,
  calendarId = DEFAULT_CALENDAR_ID,
  preferredTime: PreferredTime = "any",
): Promise<CalendarSlotOption[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const slots = buildCandidateSlots(dayStart, 1);

  if (!slots.length) {
    return [];
  }

  const busy = await listBusyWindows(slots[0].start, slots.at(-1)!.end, calendarId);
  if (busy === null) {
    return [];
  }

  return slots
    .filter((slot) => !overlapsBusySlot(slot, busy))
    .filter((slot) => matchesPreferredTime(slot, preferredTime))
    .slice(0, MAX_SLOT_OPTIONS)
    .map((slot) => ({
      ...slot,
      label: formatSlotLabel(slot),
    }));
}

export async function getNextAvailableSlots(
  calendarId = DEFAULT_CALENDAR_ID,
  preferredTime: PreferredTime = "any",
  startDate = new Date(),
): Promise<string[]> {
  const options = await getNextAvailableSlotOptions(calendarId, preferredTime, startDate);
  return options.map((slot) => slot.label);
}

export async function getNextAvailableSlotOptions(
  calendarId = DEFAULT_CALENDAR_ID,
  preferredTime: PreferredTime = "any",
  startDate = new Date(),
): Promise<CalendarSlotOption[]> {
  const slots = buildCandidateSlots(startDate, SEARCH_DAYS * 2);

  if (!slots.length) {
    return [];
  }

  const busy = await listBusyWindows(slots[0].start, slots.at(-1)!.end, calendarId);
  if (busy === null) {
    return [];
  }

  const minStartTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // min 2h from now
  return slots
    .filter((slot) => new Date(slot.start) >= minStartTime)
    .filter((slot) => !overlapsBusySlot(slot, busy))
    .filter((slot) => matchesPreferredTime(slot, preferredTime))
    .slice(0, MAX_SLOT_OPTIONS)
    .map((slot) => ({
      ...slot,
      label: formatSlotLabel(slot),
    }));
}

export async function createCalendarEvent(params: {
  summary: string;
  startDateTime: string;
  endDateTime: string;
  description: string;
  location: string;
  calendarId?: string;
}): Promise<string> {
  const calendar = getCalendarClient();

  if (!calendar) {
    throw new Error("Google Calendar is not enabled");
  }

  const response = await calendar.events.insert({
    calendarId: params.calendarId || DEFAULT_CALENDAR_ID,
    requestBody: {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: {
        dateTime: params.startDateTime,
        timeZone: DEFAULT_TIMEZONE,
      },
      end: {
        dateTime: params.endDateTime,
        timeZone: DEFAULT_TIMEZONE,
      },
    },
  });

  if (!response.data.id) {
    throw new Error("Google Calendar event creation failed");
  }

  return response.data.id;
}

export async function deleteCalendarEvent(
  eventId: string,
  calendarId = DEFAULT_CALENDAR_ID,
): Promise<void> {
  const calendar = getCalendarClient();

  if (!calendar) {
    throw new Error("Google Calendar is not enabled");
  }

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

    if (status === 404) {
      console.log(`Google Calendar event not found during delete: ${eventId}`);
      return;
    }

    throw error;
  }
}
