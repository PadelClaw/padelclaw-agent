import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { buildKnowledgePrompt, isBookingPriorityMessage, retrieveKnowledge } from '../lib/agent/knowledge.mjs'

const bandejaMatches = retrieveKnowledge('Was ist eine Bandeja und wann spiele ich sie?', {
  trainerId: 'missing-trainer',
})
assert.ok(bandejaMatches.length > 0, 'expected bandeja knowledge match')
assert.equal(bandejaMatches[0].id, 'bandeja')

const scoringMatches = retrieveKnowledge('Wie funktioniert das Scoring bei 40:40 und gibt es Golden Point?', {
  trainerId: 'missing-trainer',
})
assert.ok(scoringMatches.some((entry) => entry.id === 'scoring'), 'expected scoring rules match')

const trainerId = '__smoke_test_trainer__'
const trainerOverridePath = path.join(process.cwd(), 'knowledge', 'trainers', `${trainerId}.json`)
try {
  fs.writeFileSync(
    trainerOverridePath,
    JSON.stringify([
      {
        id: 'bandeja-override',
        title: 'Bandeja nach Coach Override',
        keywords: ['bandeja'],
        content: 'Trainer-spezifischer Hinweis zur Bandeja.',
        sourceLabel: 'Trainer Override',
      },
    ], null, 2),
  )

  const trainerMatches = retrieveKnowledge('Bandeja kurz erklaeren', { trainerId })
  assert.ok(trainerMatches.length > 0, 'expected trainer override match')
  assert.equal(trainerMatches[0].id, 'bandeja-override')
} finally {
  if (fs.existsSync(trainerOverridePath)) {
    fs.unlinkSync(trainerOverridePath)
  }
}

assert.equal(isBookingPriorityMessage('Hast du morgen freie Slots?'), true)
assert.equal(buildKnowledgePrompt('Hast du morgen freie Slots?', { trainerId: 'missing-trainer' }), '')

const viboraPrompt = buildKnowledgePrompt('Kurz: Unterschied Bandeja vs Vibora?', {
  trainerId: 'missing-trainer',
})
assert.ok(viboraPrompt.includes('Zusatzwissen fuer diese konkrete Nutzeranfrage'))
assert.ok(viboraPrompt.includes('Bandeja vs. Vibora'))

console.log('knowledge-layer-smoke: ok')
