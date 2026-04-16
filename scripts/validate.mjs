import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFlowController } from '../src/flows/index.js'
import { resolveInlineShareState, resolveResultActionState, splitDetailSectionsForDisplay } from '../src/result.js'
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

const MONTE_CARLO_SAMPLE_COUNT = 2400
const MONTE_CARLO_SEED = 0x5b1a2026

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

function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function scoreRandomScenario(pack, randomFn) {
  const flow = createFlowController(pack, { randomFn })
  let guard = 0

  while (guard < 200) {
    const snapshot = flow.getSnapshot()
    const question = snapshot.currentQuestion
    assert(question, `${pack.id}: expected current question during random flow execution`)

    const optionIndex = Math.floor(randomFn() * question.options.length)
    flow.selectOption(optionIndex)

    const afterSelect = flow.getSnapshot()
    if (afterSelect.currentIndex >= afterSelect.totalQuestions - 1) {
      break
    }

    const moved = flow.goNext()
    assert(moved, `${pack.id}: expected to move to next random question`)
    guard += 1
  }

  assert(guard < 200, `${pack.id}: random flow execution exceeded the safety limit`)

  const exportResult = flow.exportResult()
  return dimensionPatternMatcherScorer.score({
    answers: exportResult.answers,
    pack,
    flowState: exportResult.flowState,
  })
}

function validateResultActionState() {
  const compactCollapsed = resolveResultActionState({
    isActive: true,
    isCompactViewport: true,
    isCollapsed: true,
    isDownloadDisabled: false,
    hasShownNudge: true,
    displayConfig: {
      downloadButtonLabel: '保存分享图片',
      restartButtonLabel: '重新测试',
    },
    shareConfig: {
      primaryActionLabel: '生成海报',
      secondaryActionLabel: '分享链接',
      floatingLabel: '生成海报',
      nudgeLabel: '生成海报，发给朋友',
    },
  })

  assert.equal(compactCollapsed.collapsed, true, 'result: compact collapsed state should remain collapsed')
  assert.equal(compactCollapsed.primaryIntent, 'download', 'result: compact collapsed primary action should download directly')
  assert.equal(compactCollapsed.primaryLabel, '生成海报，发给朋友', 'result: compact collapsed primary label should use the nudge label once it is active')
  assert.equal(compactCollapsed.primaryAriaLabel, '生成海报，发给朋友', 'result: compact collapsed aria label should stay direct even during nudges')
  assert.equal(compactCollapsed.nudgeActive, true, 'result: compact collapsed action state should flag nudge mode when active')

  const desktopExpanded = resolveResultActionState({
    isActive: true,
    isCompactViewport: false,
    isCollapsed: false,
    isDownloadDisabled: false,
    displayConfig: {
      downloadButtonLabel: '保存分享图片',
      restartButtonLabel: '重新测试',
    },
    shareConfig: {
      secondaryActionLabel: '分享链接',
    },
  })

  assert.equal(desktopExpanded.collapsed, false, 'result: desktop action state should stay expanded')
  assert.equal(desktopExpanded.primaryIntent, 'download', 'result: desktop primary action should remain download')
  assert.equal(desktopExpanded.primaryLabel, '保存分享图片', 'result: desktop primary label should prefer displayConfig.downloadButtonLabel')
}

function validateInlineShareState() {
  const configured = resolveInlineShareState({
    shareConfig: {
      inlinePromptTitle: '把这张结果海报发给朋友对照一下',
      inlinePromptBody: '一键生成海报，看看你们谁更像股神，谁又是接盘侠',
      inlinePrimaryActionLabel: '生成结果海报',
      primaryActionLabel: '生成海报',
    },
  })

  assert.equal(configured.title, '把这张结果海报发给朋友对照一下', 'result: inline share title should prefer shareConfig.inlinePromptTitle')
  assert.equal(configured.body, '一键生成海报，看看你们谁更像股神，谁又是接盘侠', 'result: inline share body should prefer shareConfig.inlinePromptBody')
  assert.equal(configured.primaryLabel, '生成结果海报', 'result: inline share button should prefer shareConfig.inlinePrimaryActionLabel')
  assert.equal(configured.hidden, false, 'result: inline share prompt should stay visible with configured copy')
}

function validateDetailSectionSplitting() {
  const sections = [
    { id: 'insight', title: '人格解读' },
    { id: 'habit', title: '交易习惯与提醒' },
    { id: 'dimensions', title: '十五维度分布' },
  ]

  const { prioritySections, overflowSections } = splitDetailSectionsForDisplay(sections)
  assert.equal(prioritySections.length, 2, 'result: detail display should keep the first two sections in the primary flow')
  assert.equal(overflowSections.length, 1, 'result: detail display should move overflow sections into the disclosure area')
  assert.equal(overflowSections[0].id, 'dimensions', 'result: the dimensions section should move into overflow when present after the primary insights')
}

function validateMonteCarloDistribution(pack) {
  if (pack.id !== 'gbti') return

  const randomFn = createSeededRandom(MONTE_CARLO_SEED)
  const heroCounts = new Map()
  const normalCounts = new Map()
  let triggeredCount = 0
  let fallbackCount = 0
  let preservedSecondaryCount = 0

  for (let index = 0; index < MONTE_CARLO_SAMPLE_COUNT; index += 1) {
    const result = scoreRandomScenario(pack, randomFn)
    const heroCode = result.hero.code
    const normalCode = result.secondaryHero?.code || heroCode

    heroCounts.set(heroCode, (heroCounts.get(heroCode) || 0) + 1)
    normalCounts.set(normalCode, (normalCounts.get(normalCode) || 0) + 1)

    if (result.specialState?.reason === 'triggered') {
      triggeredCount += 1
      assert(result.secondaryHero, 'gbti: triggered hidden results should preserve the best normal type as secondary hero')
      preservedSecondaryCount += 1
    }

    if (result.specialState?.reason === 'fallback') {
      fallbackCount += 1
    }
  }

  const tenJqkaRate = (heroCounts.get('TEN_JQKA') || 0) / MONTE_CARLO_SAMPLE_COUNT
  const triggeredRate = triggeredCount / MONTE_CARLO_SAMPLE_COUNT
  const uniqueHeroCount = heroCounts.size
  const uniqueNormalCount = normalCounts.size

  assert(
    tenJqkaRate > 0.10 && tenJqkaRate < 0.30,
    `gbti: TEN_JQKA total share should stay within a healthy band (got ${(tenJqkaRate * 100).toFixed(1)}%)`,
  )
  assert(
    triggeredRate > 0.12 && triggeredRate < 0.22,
    `gbti: hidden trigger rate should stay close to the 1/6 expectation (got ${(triggeredRate * 100).toFixed(1)}%)`,
  )
  assert(
    uniqueHeroCount >= 10,
    `gbti: Monte Carlo distribution should cover enough final hero types (got ${uniqueHeroCount})`,
  )
  assert(
    uniqueNormalCount >= 10,
    `gbti: Monte Carlo distribution should cover enough normal hero types (got ${uniqueNormalCount})`,
  )
  assert.equal(
    preservedSecondaryCount,
    triggeredCount,
    'gbti: every triggered hidden result should preserve its best normal type as secondary hero',
  )
  assert(
    fallbackCount < MONTE_CARLO_SAMPLE_COUNT * 0.1,
    `gbti: fallback should remain an edge-case path (got ${(fallbackCount / MONTE_CARLO_SAMPLE_COUNT * 100).toFixed(1)}%)`,
  )
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

  if (pack.id === 'gbti') {
    assert.equal(
      normal.dimensions.every((item) => typeof item.summaryLabel === 'string' && item.summaryLabel.length > 0),
      true,
      'gbti: dimensions should expose human-readable summary labels',
    )
    assert.equal(
      normal.dimensions.every((item) => ['L', 'M', 'H'].includes(item.levelCode) && ['高', '中', '低'].includes(item.levelLabel) === false),
      true,
      'gbti: raw scoring levels should keep stable L/M/H codes for matcher compatibility',
    )
  }

  assert.equal(hidden.meta.stats[0].value, '100%', `${pack.id}: hidden result should surface 100% match in stats`)
  assert.equal(
    fallback.meta.confidence < pack.specialLogic.similarityFloor,
    true,
    `${pack.id}: fallback result should stay below the similarity floor`,
  )
}

async function main() {
  await validateActiveTest()
  validateResultActionState()
  validateInlineShareState()
  validateDetailSectionSplitting()

  const packs = await Promise.all(PACK_IDS.map(loadPack))
  assert.equal(packs.length, 2, 'Expected exactly two normalized packs')

  for (const pack of packs) {
    await validatePackScenario(pack)
    validateMonteCarloDistribution(pack)
  }

  console.log('Validation passed for gbti and sbti packs.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
