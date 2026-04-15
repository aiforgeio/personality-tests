import { isPlainObject, toKey } from '../utils.js'
import { createStandardResultViewModel } from '../results/template.js'

function createQuestionLookup(pack) {
  return new Map(
    [...(pack.questions || []), ...(pack.specialQuestions || [])].map((question) => [String(question.id), question]),
  )
}

function resolveScoringQuestions(pack, flowState) {
  const questionLookup = createQuestionLookup(pack)

  if (Array.isArray(flowState?.sessionBaseQuestionIds) && flowState.sessionBaseQuestionIds.length > 0) {
    return flowState.sessionBaseQuestionIds
      .map((questionId) => questionLookup.get(String(questionId)))
      .filter(Boolean)
  }

  return pack.questions || []
}

function normalizeAnswers(answers, questions) {
  if (Array.isArray(answers)) {
    return questions.map((question, index) => normalizeAnswerRecord(question, answers[index]))
  }

  return questions.map((question) => {
    const direct = answers?.[question.id]
    if (direct != null) return normalizeAnswerRecord(question, direct)
    const numeric = answers?.[String(question.id)]
    return normalizeAnswerRecord(question, numeric)
  })
}

function normalizeAnswersByQuestionId(answers, pack, scoringQuestions) {
  if (Array.isArray(answers)) {
    return Object.fromEntries(
      scoringQuestions
        .map((question, index) => {
          const answer = normalizeAnswerRecord(question, answers[index])
          return answer ? [toKey(question.id), answer] : null
        })
        .filter(Boolean),
    )
  }

  if (!isPlainObject(answers)) {
    return {}
  }

  const questionLookup = createQuestionLookup(pack)

  return Object.fromEntries(
    Object.entries(answers)
      .map(([questionId, answer]) => {
        const question = questionLookup.get(toKey(questionId))
        if (!question) return null
        const normalized = normalizeAnswerRecord(question, answer)
        return normalized ? [toKey(question.id), normalized] : null
      })
      .filter(Boolean),
  )
}

function normalizeAnswerRecord(question, answer) {
  if (answer == null) return null

  if (typeof answer === 'number' && Number.isInteger(answer)) {
    return createAnswerRecord(question, answer)
  }

  if (typeof answer === 'string' && answer.trim() !== '') {
    const numeric = Number(answer)
    if (Number.isInteger(numeric)) {
      return createAnswerRecord(question, numeric)
    }
  }

  if (typeof answer === 'object') {
    const optionIndex = answer.optionIndex ?? answer.selectedIndex
    if (Number.isInteger(optionIndex)) {
      return {
        ...createAnswerRecord(question, optionIndex),
        ...answer,
        questionId: answer.questionId ?? String(question.id),
      }
    }
  }

  return null
}

function createAnswerRecord(question, optionIndex) {
  const option = question?.options?.[optionIndex]
  if (!option) return null

  return {
    questionId: String(question.id),
    optionIndex,
    optionId: option.id ?? null,
    optionValue: option.value ?? option.id ?? option.label ?? optionIndex,
    label: option.label ?? '',
    kind: question.kind ?? 'single',
    dim: question.dim ?? null,
    special: Boolean(question.special),
  }
}

function getDimensionOrder(pack) {
  return Array.isArray(pack.dimensions?.order) ? pack.dimensions.order : []
}

function getScaleRules(pack, dimensionId) {
  const rawRules = pack.dimensions?.sumToLevel?.[dimensionId]

  if (!Array.isArray(rawRules) || rawRules.length === 0) {
    return [
      { code: 'L', label: 'L', min: Number.NEGATIVE_INFINITY, max: 0 },
      { code: 'H', label: 'H', min: 0, max: Number.POSITIVE_INFINITY },
    ]
  }

  return rawRules.map((rule, index) => ({
    code: rule.code ?? `LEVEL_${index + 1}`,
    label: rule.label ?? rule.code ?? `Level ${index + 1}`,
    min: rule.min ?? Number.NEGATIVE_INFINITY,
    max: rule.max ?? Number.POSITIVE_INFINITY,
  }))
}

function findRuleIndex(rules, expected) {
  if (expected == null) return -1

  const expectedCode = isPlainObject(expected)
    ? expected.code ?? expected.level ?? expected.label ?? expected.value
    : expected

  return rules.findIndex((rule) => {
    return rule.code === expectedCode || rule.label === expectedCode || String(rule.code) === String(expectedCode)
  })
}

function resolveDimensionExplanation(pack, dimensionId, levelCode) {
  const explanation = pack.dimensions?.explanations?.[dimensionId]
  if (typeof explanation === 'string') {
    return explanation
  }

  if (isPlainObject(explanation)) {
    return explanation[levelCode] ?? explanation[String(levelCode)] ?? ''
  }

  return ''
}

function resolveDimensionLevel(pack, dimensionId, score) {
  const rules = getScaleRules(pack, dimensionId)
  const index = rules.findIndex((rule) => score >= rule.min && score < rule.max)
  const safeIndex = index >= 0 ? index : rules.length - 1
  const level = rules[safeIndex]
  const maxIndex = Math.max(rules.length - 1, 1)

  return {
    id: dimensionId,
    score,
    index: safeIndex,
    levelCode: level.code,
    levelLabel: level.label,
    percentage: Math.min(Math.max((safeIndex / maxIndex) * 100, 0), 100),
  }
}

function buildDimensionResults(pack, answers) {
  const order = getDimensionOrder(pack)
  const rawScores = Object.fromEntries(order.map((dimensionId) => [dimensionId, 0]))

  pack.questions.forEach((question, index) => {
    const answer = answers[index]
    if (!answer) return

    const option = question.options?.[answer.optionIndex]
    const value = option?.value ?? answer.optionValue

    if (question.dim && typeof value === 'number') {
      rawScores[question.dim] = (rawScores[question.dim] ?? 0) + value
      return
    }

    if (isPlainObject(value)) {
      Object.entries(value).forEach(([dimensionId, delta]) => {
        rawScores[dimensionId] = (rawScores[dimensionId] ?? 0) + (Number(delta) || 0)
      })
    }
  })

  return order.map((dimensionId) => {
    const meta = pack.dimensions?.meta?.[dimensionId] || {}
    const result = resolveDimensionLevel(pack, dimensionId, rawScores[dimensionId] ?? 0)

    return {
      id: dimensionId,
      label: meta.label ?? meta.title ?? dimensionId,
      shortLabel: meta.shortLabel ?? meta.label ?? dimensionId,
      model: meta.model ?? '',
      description: resolveDimensionExplanation(pack, dimensionId, result.levelCode),
      ...result,
    }
  })
}

function buildPatternCandidates(pack, dimensions) {
  const patterns = pack.patterns?.normalTypes ?? []

  return patterns.map((pattern, index) => {
    const expected = pattern.pattern ?? pattern.dimensions ?? {}
    let distance = 0
    let exactMatches = 0
    let counted = 0
    let maxDistance = 0

    dimensions.forEach((dimension) => {
      const rules = getScaleRules(pack, dimension.id)
      const expectedIndex = findRuleIndex(rules, expected[dimension.id])
      if (expectedIndex < 0) return

      counted += 1
      const perDimensionMaxDistance = Math.max(rules.length - 1, 1)
      const diff = Math.abs(dimension.index - expectedIndex)

      maxDistance += perDimensionMaxDistance
      distance += diff

      if (diff === 0) {
        exactMatches += 1
      }
    })

    const score = maxDistance > 0
      ? Math.max(0, Math.round((1 - distance / maxDistance) * 100))
      : 0
    const outcome = pack.outcomes.find((item) => item.code === pattern.code) || {}

    return {
      ...outcome,
      ...pattern,
      code: pattern.code,
      score,
      distance,
      exactMatches,
      _index: index,
    }
  })
}

function answerMatchesExpected(answer, expected) {
  if (!answer) return false

  if (Array.isArray(expected)) {
    return expected.some((item) => answerMatchesExpected(answer, item))
  }

  if (isPlainObject(expected)) {
    return Object.entries(expected).every(([key, value]) => answer[key] === value)
  }

  return [
    answer.optionValue,
    answer.optionIndex,
    answer.optionId,
    answer.label,
  ].some((candidate) => candidate === expected || String(candidate) === String(expected))
}

function createSpecialState(pack, answersByQuestionId, bestNormal) {
  const logic = pack.specialLogic || {}
  const triggerQuestionId = logic.triggerQuestionId ?? logic.gateQuestionId
  const triggerAnswer = answersByQuestionId[toKey(triggerQuestionId)]
  const triggered = triggerQuestionId
    ? answerMatchesExpected(triggerAnswer, logic.triggerValue ?? logic.gateValues)
    : false
  const similarity = bestNormal?.score ?? 0

  if (triggered && logic.hiddenTypeCode) {
    return {
      active: true,
      reason: 'triggered',
      primaryCode: logic.hiddenTypeCode,
      normalPrimaryCode: bestNormal?.code ?? '',
      similarity,
      exactMatches: bestNormal?.exactMatches ?? 0,
    }
  }

  if (logic.fallbackTypeCode && typeof logic.similarityFloor === 'number' && similarity < logic.similarityFloor) {
    return {
      active: true,
      reason: 'fallback',
      primaryCode: logic.fallbackTypeCode,
      normalPrimaryCode: bestNormal?.code ?? '',
      similarity,
      exactMatches: bestNormal?.exactMatches ?? 0,
    }
  }

  return {
    active: false,
    reason: 'normal',
    primaryCode: bestNormal?.code ?? '',
    normalPrimaryCode: bestNormal?.code ?? '',
    similarity,
    exactMatches: bestNormal?.exactMatches ?? 0,
  }
}

function buildHeroOutcome(pack, bestNormal, specialState, dimensions) {
  if (specialState.reason === 'triggered') {
    const specialOutcome = pack.outcomes.find((outcome) => outcome.code === specialState.primaryCode) || {}
    return {
      ...specialOutcome,
      score: 100,
      kicker: '隐藏人格已激活',
      sub: specialOutcome.sub ?? '你在关键题中触发了隐藏人格，本次结果优先走特殊归档。',
      note: specialOutcome.note ?? (
        bestNormal?.code
          ? `常规人格中你最接近 ${bestNormal.alias ?? bestNormal.code}，但隐藏触发条件优先生效。`
          : '隐藏触发条件优先生效。'
      ),
      exactMatches: bestNormal?.exactMatches ?? 0,
    }
  }

  if (specialState.reason === 'fallback') {
    const fallbackOutcome = pack.outcomes.find((outcome) => outcome.code === specialState.primaryCode) || {}
    return {
      ...fallbackOutcome,
      score: bestNormal?.score ?? 0,
      kicker: '系统稳健兜底',
      sub: fallbackOutcome.sub ?? `你的风格较混合，系统先将你归入 ${fallbackOutcome.alias ?? fallbackOutcome.code}。`,
      note: fallbackOutcome.note ?? (
        bestNormal?.code
          ? `常规人格中你最接近 ${bestNormal.alias ?? bestNormal.code}，但最高匹配仅 ${bestNormal.score ?? 0}%。`
          : `最高匹配仅 ${bestNormal?.score ?? 0}%。`
      ),
      exactMatches: bestNormal?.exactMatches ?? 0,
    }
  }

  return {
    ...bestNormal,
    kicker: bestNormal?.kicker ?? '你的主类型',
    sub: bestNormal?.sub ?? '维度命中度较高，当前结果可视为你的交易风格画像。',
    note: bestNormal?.note ?? '',
  }
}

function formatNormalPrimary(bestNormal) {
  if (!bestNormal?.code) return ''
  const title = bestNormal.alias ?? bestNormal.name ?? bestNormal.title ?? ''
  return title ? `${bestNormal.code} · ${title}` : bestNormal.code
}

export function scoreDimensionPatternMatcher({ answers, pack, flowState }) {
  const scoringQuestions = resolveScoringQuestions(pack, flowState)
  const orderedAnswers = normalizeAnswers(answers, scoringQuestions)
  const answersByQuestionId = normalizeAnswersByQuestionId(answers, pack, scoringQuestions)
  const dimensions = buildDimensionResults({ ...pack, questions: scoringQuestions }, orderedAnswers)
  const rankedNormalOutcomes = buildPatternCandidates(pack, dimensions)
    .sort((left, right) => left.distance - right.distance || right.exactMatches - left.exactMatches || right.score - left.score || left._index - right._index)
    .map(({ _index, ...item }) => item)

  const bestNormal = rankedNormalOutcomes[0] ?? {}
  const specialState = createSpecialState(pack, answersByQuestionId, bestNormal)
  const heroOutcome = buildHeroOutcome(pack, bestNormal, specialState, dimensions)
  const secondaryHeroOutcome = specialState.reason === 'normal' || bestNormal?.code === heroOutcome.code
    ? null
    : bestNormal
  const rankingOutcomes = specialState.reason === 'normal'
    ? rankedNormalOutcomes
    : [
      heroOutcome,
      ...rankedNormalOutcomes.filter((outcome) => outcome.code !== heroOutcome.code),
    ]
  const totalDimensions = dimensions.length
  const confidence = Math.max(0, Math.min(heroOutcome.score ?? 0, 100))

  return createStandardResultViewModel({
    pack,
    heroOutcome,
    secondaryHeroOutcome,
    rankingOutcomes,
    dimensions,
    specialState,
    meta: {
      packId: pack.id,
      scorerId: pack.scorerId,
      confidence,
      totalScore: rankingOutcomes.reduce((sum, item) => sum + (item.score ?? 0), 0),
      kicker: heroOutcome.kicker ?? '你的主类型',
      flowMode: flowState?.mode ?? pack.flow?.mode ?? 'linear',
      stats: [
        { label: '匹配度', value: `${heroOutcome.score ?? 0}%`, tone: 'accent' },
        { label: '精准命中', value: `${heroOutcome.exactMatches ?? bestNormal.exactMatches ?? 0}/${totalDimensions} 维` },
        { label: '常规命中', value: formatNormalPrimary(bestNormal) || '未命中' },
      ],
    },
    raw: {
      answers: orderedAnswers,
      dimensions,
      rankingOutcomes,
      bestNormal,
      flowState: flowState ?? null,
    },
  })
}

export const dimensionPatternMatcherScorer = {
  id: 'dimension-pattern-matcher',
  score: scoreDimensionPatternMatcher,
}
