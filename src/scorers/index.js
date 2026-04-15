import { dimensionPatternMatcherScorer } from './dimension-pattern-matcher.js'

export function createScorerRegistry(extraScorers = []) {
  const scorers = new Map(
    [
      dimensionPatternMatcherScorer,
      ...extraScorers,
    ].map((scorer) => [scorer.id, scorer]),
  )

  return {
    get(id) {
      const scorer = scorers.get(id)

      if (!scorer) {
        throw new Error(`Unknown scorer: ${id}`)
      }

      return scorer
    },
  }
}
