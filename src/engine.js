const DEFAULT_SCORING = {
  confidenceMultiplier: 2.2,
  defaultConfidence: 50,
  maxConfidence: 99,
}

function normalizeAnswers(answers, questions) {
  if (Array.isArray(answers)) return answers

  return questions.map((question) => {
    const direct = answers?.[question.id]
    if (direct != null) return direct
    const numeric = answers?.[String(question.id)]
    return numeric ?? null
  })
}

export function calculateRawScores(answers, questions, types) {
  const orderedAnswers = normalizeAnswers(answers, questions)
  const rawScores = Object.fromEntries(types.map((type) => [type.code, 0]))

  questions.forEach((question, index) => {
    const selectedIndex = orderedAnswers[index]
    if (selectedIndex == null) return
    const option = question.options?.[selectedIndex]
    if (!option?.effect) return

    Object.entries(option.effect).forEach(([code, weight]) => {
      if (rawScores[code] != null) {
        rawScores[code] += Number(weight) || 0
      }
    })
  })

  return rawScores
}

export function rankTypes(rawScores, types) {
  return types
    .map((type, index) => ({
      ...type,
      score: rawScores[type.code] ?? 0,
      _index: index,
    }))
    .sort((a, b) => b.score - a.score || a._index - b._index)
    .map(({ _index, ...type }) => type)
}

export function calculateConfidence(rankings, scoring = {}) {
  const options = { ...DEFAULT_SCORING, ...scoring }
  const total = rankings.reduce((sum, item) => sum + item.score, 0)
  if (total <= 0) return options.defaultConfidence

  const top = rankings[0]?.score ?? 0
  const confidence = Math.round((top / total) * 100 * options.confidenceMultiplier)
  return Math.min(confidence, options.maxConfidence)
}

export function determineResult(answers, questions, types, scoring = {}) {
  const rawScores = calculateRawScores(answers, questions, types)
  const rankings = rankTypes(rawScores, types)
  const confidence = calculateConfidence(rankings, scoring)

  return {
    primary: rankings[0] || null,
    rankings,
    rawScores,
    confidence,
    totalScore: rankings.reduce((sum, item) => sum + item.score, 0),
  }
}
