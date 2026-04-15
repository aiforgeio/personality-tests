import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { determineResult } from '../src/engine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

async function loadJSON(relativePath) {
  const fullPath = path.join(projectRoot, relativePath)
  const content = await fs.readFile(fullPath, 'utf8')
  return JSON.parse(content)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function manualScore(answers, questions, types, scoring) {
  const rawScores = Object.fromEntries(types.map((type) => [type.code, 0]))

  questions.forEach((question, index) => {
    const selected = answers[index]
    const option = question.options[selected]
    Object.entries(option.effect).forEach(([code, weight]) => {
      if (rawScores[code] != null) rawScores[code] += Number(weight) || 0
    })
  })

  const rankings = types
    .map((type, index) => ({ ...type, score: rawScores[type.code], _index: index }))
    .sort((a, b) => b.score - a.score || a._index - b._index)
    .map(({ _index, ...type }) => type)

  const total = rankings.reduce((sum, item) => sum + item.score, 0)
  const confidence = total > 0
    ? Math.min(Math.round((rankings[0].score / total) * 100 * scoring.confidenceMultiplier), scoring.maxConfidence)
    : scoring.defaultConfidence

  return {
    primary: rankings[0],
    rankings,
    rawScores,
    confidence,
  }
}

async function main() {
  const [questions, types, config] = await Promise.all([
    loadJSON('data/questions.json'),
    loadJSON('data/types.json'),
    loadJSON('data/config.json'),
  ])

  assert(questions.length === 20, `Expected 20 questions, got ${questions.length}`)
  assert(types.length === 14, `Expected 14 types, got ${types.length}`)
  assert(questions.every((question, index) => question.id === index + 1), 'Question ids are not sequential 1..20')
  assert(questions.every((question) => question.options.length === 4), 'Each question must have 4 options')

  const codes = new Set(types.map((type) => type.code))
  questions.forEach((question, index) => {
    question.options.forEach((option) => {
      Object.keys(option.effect).forEach((code) => {
        assert(codes.has(code), `Unknown code ${code} in question ${index + 1}`)
      })
    })
  })

  const samples = [
    new Array(20).fill(0),
    new Array(20).fill(1),
    [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  ]

  samples.forEach((answers, sampleIndex) => {
    const actual = determineResult(answers, questions, types, config.scoring)
    const expected = manualScore(answers, questions, types, config.scoring)
    assert(actual.primary.code === expected.primary.code, `Sample ${sampleIndex + 1}: primary mismatch`)
    assert(JSON.stringify(actual.rawScores) === JSON.stringify(expected.rawScores), `Sample ${sampleIndex + 1}: raw score mismatch`)
    assert(actual.confidence === expected.confidence, `Sample ${sampleIndex + 1}: confidence mismatch`)
    assert(actual.rankings[0].code === actual.primary.code, `Sample ${sampleIndex + 1}: rankings[0] mismatch`)
    assert(actual.confidence >= 0 && actual.confidence <= 99, `Sample ${sampleIndex + 1}: confidence out of range`)
  })

  console.log('GBTI validation passed')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
