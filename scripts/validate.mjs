import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFlowController } from '../src/flows/index.js'
import { dimensionPatternMatcherScorer } from '../src/scorers/dimension-pattern-matcher.js'
import { validateActiveTestConfig, validatePackManifest, validateTestPack } from '../src/test-pack/schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const PACK_IDS = ['gbti', 'sbti']
const LEVEL_TO_TARGET_VALUES = {
  L: [1, 1],
  M: [1, 3],
  H: [3, 3],
}

const FALLBACK_LEVELS = {
  gbti: {
    R1: 'H',
    R2: 'H',
    R3: 'M',
    T1: 'L',
    T2: 'H',
    T3: 'L',
    I1: 'L',
    I2: 'M',
    I3: 'L',
    M1: 'L',
    M2: 'H',
    M3: 'M',
    S1: 'M',
    S2: 'M',
    S3: 'M',
  },
  sbti: {
    S1: 'L',
    S2: 'L',
    S3: 'L',
    E1: 'H',
    E2: 'H',
    E3: 'M',
    A1: 'H',
    A2: 'H',
    A3: 'H',
    Ac1: 'M',
    Ac2: 'H',
    Ac3: 'L',
    So1: 'L',
    So2: 'L',
    So3: 'M',
  },
}

async function loadJson(relativePath) {
  const fullPath = path.join(projectRoot, relativePath)
  return JSON.parse(await fs.readFile(fullPath, 'utf8'))
}

function resolveRelativeDataPath(relativePath, baseRelativePath = '') {
  const rawPath = String(relativePath || '')
  if (!rawPath) {
    return baseRelativePath
  }

  if (rawPath.startsWith('/')) {
    return rawPath.replace(/^\/+/, '')
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(baseRelativePath), rawPath))
}

function resolveValidationImagePath(imagePath, manifestPath) {
  if (!imagePath || /^(https?:|data:)/.test(imagePath)) {
    return imagePath || ''
  }

  const resolved = resolveRelativeDataPath(imagePath, manifestPath)
  return path.join(projectRoot, 'data', resolved)
}

function normalizePackForValidation(pack, manifestPath) {
  return {
    ...pack,
    outcomes: pack.outcomes.map((outcome) => ({
      ...outcome,
      image: resolveValidationImagePath(outcome.image, manifestPath),
      heroImage: resolveValidationImagePath(outcome.heroImage, manifestPath),
      imageUrl: resolveValidationImagePath(outcome.imageUrl, manifestPath),
    })),
  }
}

async function loadPack(packId) {
  const manifestRelativePath = `tests/${packId}/manifest.json`
  const manifest = validatePackManifest(await loadJson(`data/${manifestRelativePath}`))
  const questions = await loadJson(`data/tests/${packId}/questions.json`)
  const outcomes = await loadJson(`data/tests/${packId}/outcomes.json`)
  const specialQuestions = await loadJson(`data/tests/${packId}/special-questions.json`)
  const dimensions = await loadJson(`data/tests/${packId}/dimensions.json`)
  const patterns = await loadJson(`data/tests/${packId}/patterns.json`)

  return validateTestPack(normalizePackForValidation({
    ...manifest,
    questions,
    outcomes,
    specialQuestions,
    dimensions,
    patterns,
  }, manifestRelativePath))
}

function getPatternLevels(pack, code) {
  const pattern = pack.patterns.normalTypes.find((item) => item.code === code)
  assert(pattern, `Missing pattern for ${code}`)
  return pattern.dimensions
}

function getRegularQuestionsByDimension(pack) {
  return pack.questions.reduce((acc, question) => {
    const key = String(question.dim)
    if (!acc.has(key)) {
      acc.set(key, [])
    }
    acc.get(key).push(question)
    return acc
  }, new Map())
}

function buildAnswerPlanFromLevels(pack, levels) {
  const byDimension = getRegularQuestionsByDimension(pack)
  const plan = {}

  pack.dimensions.order.forEach((dimensionId) => {
    const questions = byDimension.get(String(dimensionId)) || []
    assert.equal(questions.length, 2, `${pack.id}:${dimensionId} should map to 2 regular questions`)

    const targetValues = LEVEL_TO_TARGET_VALUES[levels[dimensionId]]
    assert(targetValues, `${pack.id}:${dimensionId} must resolve to L/M/H`)

    questions.forEach((question, index) => {
      const optionIndex = question.options.findIndex((option) => Number(option.value) === targetValues[index])
      assert(optionIndex >= 0, `${pack.id}:${question.id} should expose value ${targetValues[index]}`)
      plan[question.id] = optionIndex
    })
  })

  return plan
}

function createScenarioPlan(pack, { levels, triggerGate = false, triggerHidden = false }) {
  const plan = buildAnswerPlanFromLevels(pack, levels)
  const gateQuestionId = pack.specialLogic?.gateQuestionId
  const triggerQuestionId = pack.specialLogic?.triggerQuestionId

  if (gateQuestionId) {
    plan[gateQuestionId] = triggerGate ? 2 : 0
  }

  if (triggerQuestionId && triggerHidden) {
    plan[triggerQuestionId] = 1
  }

  return plan
}

function completeFlow(pack, answerPlan, randomFn = () => 0) {
  const flow = createFlowController(pack, { randomFn })
  let guard = 0

  while (guard < 200) {
    const snapshot = flow.getSnapshot()
    const question = snapshot.currentQuestion
    assert(question, `${pack.id}: expected current question during flow execution`)

    const optionIndex = answerPlan[question.id]
    assert(Number.isInteger(optionIndex), `${pack.id}:${question.id} is missing from the answer plan`)
    flow.selectOption(optionIndex)

    const afterSelect = flow.getSnapshot()
    if (afterSelect.currentIndex >= afterSelect.totalQuestions - 1) {
      break
    }

    const moved = flow.goNext()
    assert(moved, `${pack.id}: expected to move to next question`)
    guard += 1
  }

  assert(guard < 200, `${pack.id}: flow execution exceeded the safety limit`)
  return flow.exportResult()
}

function scoreScenario(pack, scenarioPlan) {
  const exportResult = completeFlow(pack, scenarioPlan)
  return {
    flowResult: exportResult,
    result: dimensionPatternMatcherScorer.score({
      answers: exportResult.answers,
      pack,
      flowState: exportResult.flowState,
    }),
  }
}

function validateActiveTest() {
  return loadJson('data/active-test.json').then((config) => {
    const active = validateActiveTestConfig(config)
    assert.equal(active.id, 'gbti', 'Default active test should remain gbti')
    assert.equal(active.manifestPath, 'tests/gbti/manifest.json', 'active-test.json should point to the gbti manifest')
  })
}

function validateFlowBehavior(pack) {
  const flow = createFlowController(pack, { randomFn: () => 0 })
  const gateQuestionId = pack.specialLogic.gateQuestionId
  const triggerQuestionId = pack.specialLogic.triggerQuestionId
  const firstSnapshot = flow.getSnapshot()

  assert.equal(firstSnapshot.totalQuestions, 31, `${pack.id}: should start with 30 regular questions + 1 static gate question`)
  assert.equal(firstSnapshot.questionIds, undefined)
  assert.equal(firstSnapshot.flowState.questionIds[1], gateQuestionId, `${pack.id}: gate question should be inserted at the predictable slot`)
  assert.equal(firstSnapshot.flowState.questionIds.includes(triggerQuestionId), false, `${pack.id}: trigger question should stay hidden before gate`)

  flow.selectOption(0)
  flow.goNext()
  assert.equal(flow.getSnapshot().currentQuestion.id, gateQuestionId, `${pack.id}: expected to reach the gate question`)

  flow.selectOption(0)
  let snapshot = flow.getSnapshot()
  assert.equal(snapshot.flowState.questionIds.includes(triggerQuestionId), false, `${pack.id}: trigger question should remain hidden when gate is not hit`)

  flow.selectOption(2)
  snapshot = flow.getSnapshot()
  assert.equal(snapshot.flowState.questionIds.includes(triggerQuestionId), true, `${pack.id}: trigger question should appear when gate is hit`)
  assert.equal(snapshot.totalQuestions, 32, `${pack.id}: visible question count should include the inserted trigger question`)

  flow.goNext()
  assert.equal(flow.getSnapshot().currentQuestion.id, triggerQuestionId, `${pack.id}: trigger question should appear immediately after gate`)
  flow.selectOption(1)
  assert(flow.getSnapshot().answers[triggerQuestionId], `${pack.id}: trigger answer should be recorded`)

  flow.goPrevious()
  flow.selectOption(0)
  snapshot = flow.getSnapshot()
  assert.equal(snapshot.flowState.questionIds.includes(triggerQuestionId), false, `${pack.id}: trigger question should be removed when gate is reverted`)
  assert.equal(snapshot.answers[triggerQuestionId], undefined, `${pack.id}: removed trigger question answer should be pruned`)
}

async function validatePackScenario(pack) {
  validateFlowBehavior(pack)

  const normalCode = pack.id === 'gbti' ? 'GURU' : 'CTRL'
  const normalPlan = createScenarioPlan(pack, {
    levels: getPatternLevels(pack, normalCode),
    triggerGate: false,
    triggerHidden: false,
  })
  const hiddenPlan = createScenarioPlan(pack, {
    levels: getPatternLevels(pack, normalCode),
    triggerGate: true,
    triggerHidden: true,
  })
  const fallbackPlan = createScenarioPlan(pack, {
    levels: FALLBACK_LEVELS[pack.id],
    triggerGate: false,
    triggerHidden: false,
  })

  const normal = scoreScenario(pack, normalPlan).result
  const hidden = scoreScenario(pack, hiddenPlan).result
  const fallback = scoreScenario(pack, fallbackPlan).result

  assert.equal(normal.hero.code, normalCode, `${pack.id}: normal fixture should hit ${normalCode}`)
  assert.equal(normal.meta.confidence, 100, `${pack.id}: exact pattern match should yield 100 confidence`)
  assert.equal(normal.secondaryHero, null, `${pack.id}: normal result should not produce a secondary hero`)

  if (pack.id === 'gbti') {
    assert.equal(hidden.hero.code, 'TEN_JQKA', 'gbti: hidden fixture should hit TEN_JQKA')
    assert.equal(fallback.hero.code, 'WATCHER', 'gbti: fallback fixture should hit WATCHER')
  } else {
    assert.equal(hidden.hero.code, 'DRUNK', 'sbti: hidden fixture should hit DRUNK')
    assert.equal(fallback.hero.code, 'HHHH', 'sbti: fallback fixture should hit HHHH')
  }

  assert(hidden.secondaryHero, `${pack.id}: hidden result should preserve the best normal type as secondary hero`)
  assert.equal(Boolean(fallback.secondaryHero), true, `${pack.id}: fallback result should preserve the best normal type as secondary hero`)
  assert(hidden.meta.confidence >= 100 || hidden.hero.code === 'DRUNK' || hidden.hero.code === 'TEN_JQKA')

  ;[normal, hidden, fallback].forEach((result) => {
    assert(result.hero.image, `${pack.id}:${result.hero.code} should expose a resolved hero.image`)
    assert.equal(typeof result.hero.image, 'string', `${pack.id}:${result.hero.code} hero.image should be a string`)
    assert.equal(
      result.dimensions.every((item) => typeof item.description === 'string' && item.description.length > 0),
      true,
      `${pack.id}:${result.hero.code} dimensions should resolve to concrete explanation strings`,
    )
  })

  assert.equal(hidden.meta.stats[0].value, '100%', `${pack.id}: hidden result should surface 100% match in stats`)
  assert.equal(
    fallback.meta.confidence < pack.specialLogic.similarityFloor,
    true,
    `${pack.id}: fallback result should stay below the similarity floor`,
  )
}

async function main() {
  await validateActiveTest()

  const packs = await Promise.all(PACK_IDS.map(loadPack))
  assert.equal(packs.length, 2, 'Expected exactly two normalized packs')

  for (const pack of packs) {
    await validatePackScenario(pack)
  }

  console.log('Validation passed for gbti and sbti packs.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
