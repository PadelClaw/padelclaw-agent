import fs from 'fs'
import path from 'path'

const KNOWLEDGE_ROOT = path.join(process.cwd(), 'knowledge')
const BASE_FILES = [path.join(KNOWLEDGE_ROOT, 'base', 'padel-basics.json')]
const RULE_FILES = [path.join(KNOWLEDGE_ROOT, 'rules', 'fip-rules.json')]
const BOOKING_PRIORITY_PATTERN =
  /\b(buch|buche|buchen|buchung|slot|slots|termin|termine|verf[uü]gbar|frei(?:e|en|er)?\s+slots?|storn|absag|cancel|umbuch|verschieb)\b/i

const TIER_PRIORITY = {
  trainer: 0,
  base: 1,
  rules: 2,
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/g, 'ss')
}

function readJsonArray(filePath, tier) {
  if (!fs.existsSync(filePath)) {
    return []
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        id: String(entry.id ?? ''),
        title: String(entry.title ?? ''),
        keywords: Array.isArray(entry.keywords) ? entry.keywords.map((keyword) => String(keyword)) : [],
        content: String(entry.content ?? ''),
        sourceLabel: String(entry.sourceLabel ?? ''),
        tier,
      }))
      .filter((entry) => entry.id && entry.title && entry.content && entry.keywords.length)
  } catch (error) {
    console.error('[knowledge] failed to read', filePath, error)
    return []
  }
}

function loadEntries(trainerId) {
  const trainerFile = trainerId
    ? path.join(KNOWLEDGE_ROOT, 'trainers', `${trainerId}.json`)
    : null

  const trainerEntries = trainerFile ? readJsonArray(trainerFile, 'trainer') : []
  const baseEntries = BASE_FILES.flatMap((filePath) => readJsonArray(filePath, 'base'))
  const ruleEntries = RULE_FILES.flatMap((filePath) => readJsonArray(filePath, 'rules'))

  return [...trainerEntries, ...baseEntries, ...ruleEntries]
}

function scoreEntry(entry, normalizedMessage) {
  let score = 0

  for (const rawKeyword of entry.keywords) {
    const keyword = normalizeText(rawKeyword).trim()
    if (!keyword) {
      continue
    }

    if (normalizedMessage.includes(keyword)) {
      score += keyword.includes(' ') ? 8 : 5
      continue
    }

    const parts = keyword.split(/\s+/).filter(Boolean)
    const partialMatches = parts.filter((part) => normalizedMessage.includes(part)).length
    if (partialMatches) {
      score += partialMatches
    }
  }

  if (score > 0 && normalizedMessage.includes(normalizeText(entry.title))) {
    score += 3
  }

  return score
}

export function isBookingPriorityMessage(message) {
  return BOOKING_PRIORITY_PATTERN.test(message)
}

export function retrieveKnowledge(message, options = {}) {
  const { trainerId, maxEntries = 2 } = options
  const normalizedMessage = normalizeText(message)
  if (!normalizedMessage.trim()) {
    return []
  }

  const ranked = loadEntries(trainerId)
    .map((entry) => ({
      ...entry,
      score: scoreEntry(entry, normalizedMessage),
      tierPriority: TIER_PRIORITY[entry.tier] ?? 99,
    }))
    .filter((entry) => entry.score > 0)
  const sortedWithinTier = (entries) =>
    entries.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.title.localeCompare(right.title, 'de')
    })
  const trainerMatches = sortedWithinTier(ranked.filter((entry) => entry.tier === 'trainer'))
  const baseMatches = sortedWithinTier(ranked.filter((entry) => entry.tier === 'base'))
  const ruleMatches = sortedWithinTier(ranked.filter((entry) => entry.tier === 'rules'))
  const ordered = [...trainerMatches, ...baseMatches, ...ruleMatches]

  return ordered.slice(0, maxEntries)
}

export function buildKnowledgePrompt(message, options = {}) {
  if (isBookingPriorityMessage(message)) {
    return ''
  }

  const matches = retrieveKnowledge(message, options)
  if (!matches.length) {
    return ''
  }

  const formattedMatches = matches
    .map((entry, index) => {
      return `${index + 1}. ${entry.title} [${entry.sourceLabel}]\n${entry.content}`
    })
    .join('\n\n')

  return `

## Zusatzwissen fuer diese konkrete Nutzeranfrage
Nutze dieses Wissen nur, wenn es direkt zur letzten Frage passt.
Prioritaet: Trainer Override vor Padel Base vor FIP-Regeln.
Booking bleibt immer wichtiger als Wissensantworten. Wenn der Nutzer buchen, Slots sehen oder stornieren will, folge dem Booking-Flow und ignoriere dieses Zusatzwissen.
Wenn du mit diesem Wissen antwortest, antworte kurz, konkret und ohne Halluzinationen. Erfinde keine Trainer-Methodik, die nicht im Kontext steht.

${formattedMatches}`
}
