import { clamp, isPlainObject, toKey } from '../utils.js'

const DEFAULT_FLOW = {
  mode: 'linear',
  shuffleQuestions: false,
  staticInsertions: [],
}

function normalizeFlowConfig(pack) {
  return {
    ...DEFAULT_FLOW,
    ...(pack.flow || {}),
  }
}

function createQuestionLookup(pack) {
  const questions = [...(pack.questions || []), ...(pack.specialQuestions || [])]
  return new Map(questions.map((question) => [toKey(question.id), question]))
}

function shuffleList(list, randomFn) {
  const items = [...list]

  for (let index = items.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(randomFn() * (index + 1))
    ;[items[index], items[nextIndex]] = [items[nextIndex], items[index]]
  }

  return items
}

function insertStaticQuestions(questions, flow, questionById, randomFn) {
  const nextQuestions = [...questions]

  ;(flow.staticInsertions || []).forEach((insertion) => {
    const question = questionById.get(toKey(insertion.questionId))
    if (!question) return

    const alreadyIncluded = nextQuestions.some((item) => toKey(item.id) === toKey(question.id))
    if (alreadyIncluded) return

    const minIndex = clamp(insertion.minIndex ?? 0, 0, nextQuestions.length)
    const insertionIndex = insertion.strategy === 'random-slot'
      ? minIndex + Math.floor(randomFn() * (nextQuestions.length - minIndex + 1))
      : nextQuestions.length

    nextQuestions.splice(insertionIndex, 0, question)
  })

  return nextQuestions
}

function buildInitialSequence(pack, flow, questionById, randomFn) {
  const baseQuestions = flow.shuffleQuestions
    ? shuffleList(pack.questions || [], randomFn)
    : [...(pack.questions || [])]

  return insertStaticQuestions(baseQuestions, flow, questionById, randomFn)
}

function createAnswerRecord(question, optionIndex) {
  const option = question?.options?.[optionIndex]
  if (!option) return null

  return {
    questionId: toKey(question.id),
    optionIndex,
    optionId: option.id ?? null,
    optionValue: option.value ?? option.id ?? option.label ?? optionIndex,
    label: option.label ?? '',
    kind: question.kind ?? 'single',
    dim: question.dim ?? null,
    special: Boolean(question.special),
  }
}

function valueMatchesCandidate(expected, candidates) {
  if (Array.isArray(expected)) {
    return expected.some((item) => valueMatchesCandidate(item, candidates))
  }

  if (isPlainObject(expected)) {
    return Object.entries(expected).every(([key, value]) => {
      return candidates.some((candidate) => isPlainObject(candidate) && candidate[key] === value)
    })
  }

  return candidates.some((candidate) => {
    if (candidate == null) return false
    return candidate === expected || String(candidate) === String(expected)
  })
}

function matchesTrigger(answer, triggerValue) {
  if (!answer) return false
  if (triggerValue == null) return true

  const candidates = [
    answer.optionValue,
    answer.optionId,
    answer.optionIndex,
    answer.label,
    answer,
  ]

  return valueMatchesCandidate(triggerValue, candidates)
}

function shouldInsertSpecialQuestion(pack, answerStore) {
  const logic = pack.specialLogic || {}
  const triggerQuestionId = logic.gateQuestionId ?? logic.triggerQuestionId
  const triggerAnswer = answerStore[toKey(triggerQuestionId)]
  const expectedValue = logic.gateValues ?? logic.triggerValue

  if (!logic.insertQuestionId || !triggerQuestionId) {
    return false
  }

  return matchesTrigger(triggerAnswer, expectedValue)
}

function buildConditionalSequence(pack, questionById, answerStore) {
  const questions = [...(pack.questions || [])]
  const logic = pack.specialLogic || {}

  if (!shouldInsertSpecialQuestion(pack, answerStore)) {
    return questions
  }

  const insertQuestion = questionById.get(toKey(logic.insertQuestionId))
  if (!insertQuestion) {
    return questions
  }

  const alreadyIncluded = questions.some((question) => toKey(question.id) === toKey(insertQuestion.id))
  if (alreadyIncluded) {
    return questions
  }

  const anchorId = logic.insertAfterQuestionId ?? logic.gateQuestionId ?? logic.triggerQuestionId
  const anchorIndex = questions.findIndex((question) => toKey(question.id) === toKey(anchorId))
  const insertionIndex = anchorIndex >= 0 ? anchorIndex + 1 : questions.length

  questions.splice(insertionIndex, 0, insertQuestion)
  return questions
}

function resolveQuestions(pack, questionById, answerStore) {
  const flow = normalizeFlowConfig(pack)

  if (flow.mode === 'conditional') {
    return buildConditionalSequence(pack, questionById, answerStore)
  }

  return [...(pack.questions || [])]
}

function toAnswerMap(questions, answerStore) {
  return Object.fromEntries(
    questions
      .map((question) => {
        const answer = answerStore[toKey(question.id)]
        return answer ? [toKey(question.id), answer] : null
      })
      .filter(Boolean),
  )
}

function pruneHiddenAnswers(answerStore, questions) {
  const visibleQuestionIds = new Set(questions.map((question) => toKey(question.id)))

  return Object.fromEntries(
    Object.entries(answerStore).filter(([questionId]) => visibleQuestionIds.has(toKey(questionId))),
  )
}

export function createFlowController(pack, { randomFn = Math.random } = {}) {
  const flow = normalizeFlowConfig(pack)
  const questionById = createQuestionLookup(pack)
  const baseQuestionIds = new Set((pack.questions || []).map((question) => toKey(question.id)))
  const sessionBaseQuestions = buildInitialSequence(pack, flow, questionById, randomFn)
  const sessionPack = {
    ...pack,
    questions: sessionBaseQuestions,
  }

  let currentIndex = 0
  let answerStore = {}
  let questions = resolveQuestions(sessionPack, questionById, answerStore)

  function syncQuestions(anchorQuestionId = null) {
    const previousIndex = currentIndex
    questions = resolveQuestions(sessionPack, questionById, answerStore)
    answerStore = pruneHiddenAnswers(answerStore, questions)

    if (!questions.length) {
      currentIndex = 0
      return
    }

    if (anchorQuestionId) {
      const anchorIndex = questions.findIndex((question) => toKey(question.id) === toKey(anchorQuestionId))
      if (anchorIndex >= 0) {
        currentIndex = anchorIndex
        return
      }
    }

    currentIndex = clamp(previousIndex, 0, questions.length - 1)
  }

  function getCurrentQuestion() {
    return questions[currentIndex] ?? null
  }

  function getAnswer(questionId) {
    return answerStore[toKey(questionId)] ?? null
  }

  function getSnapshot() {
    const currentQuestion = getCurrentQuestion()
    const activeAnswers = toAnswerMap(questions, answerStore)
    const answeredCount = Object.keys(activeAnswers).length

    return {
      mode: flow.mode,
      questions,
      currentIndex,
      currentQuestion,
      totalQuestions: questions.length,
      answers: activeAnswers,
      orderedAnswers: questions.map((question) => getAnswer(question.id)),
      canGoBack: currentIndex > 0,
      canGoNext: currentIndex < questions.length - 1,
      hasCurrentAnswer: currentQuestion ? Boolean(getAnswer(currentQuestion.id)) : false,
      progress: {
        current: currentQuestion ? currentIndex + 1 : questions.length,
        answered: answeredCount,
        total: questions.length,
        percentage: questions.length ? (answeredCount / questions.length) * 100 : 0,
      },
      flowState: {
        mode: flow.mode,
        questionIds: questions.map((question) => toKey(question.id)),
        insertedQuestionIds: questions
          .filter((question) => !baseQuestionIds.has(toKey(question.id)))
          .map((question) => toKey(question.id)),
        sessionBaseQuestionIds: sessionBaseQuestions.map((question) => toKey(question.id)),
      },
    }
  }

  function selectOption(optionIndex) {
    const currentQuestion = getCurrentQuestion()
    if (!currentQuestion) return null

    const answer = createAnswerRecord(currentQuestion, optionIndex)
    if (!answer) return null

    answerStore = {
      ...answerStore,
      [toKey(currentQuestion.id)]: answer,
    }

    syncQuestions(currentQuestion.id)
    return answer
  }

  function goNext() {
    if (currentIndex >= questions.length - 1) {
      return false
    }

    currentIndex += 1
    return true
  }

  function goPrevious() {
    if (currentIndex <= 0) {
      return false
    }

    currentIndex -= 1
    return true
  }

  function exportResult() {
    const snapshot = getSnapshot()
    return {
      answers: snapshot.answers,
      flowState: snapshot.flowState,
      orderedAnswers: snapshot.orderedAnswers,
      questionIds: snapshot.flowState.questionIds,
    }
  }

  return {
    getSnapshot,
    getCurrentQuestion,
    getAnswer,
    selectOption,
    goNext,
    goPrevious,
    exportResult,
  }
}
