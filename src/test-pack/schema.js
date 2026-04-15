import { isPlainObject, toKey } from '../utils.js'

const SECTION_TYPES = new Set([
  'hero-summary',
  'image-panel',
  'stats-inline',
  'dimension-list',
  'tag-list',
  'bullet-list',
])

const FLOW_MODES = new Set(['linear', 'conditional'])
const STATIC_INSERTION_STRATEGIES = new Set(['random-slot'])

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertString(value, message) {
  assert(typeof value === 'string' && value.trim(), message)
}

function assertOptionalString(value, message) {
  if (value != null) {
    assert(typeof value === 'string', message)
  }
}

function assertStringArray(value, message) {
  assert(Array.isArray(value), message)
  value.forEach((item, index) => {
    assertString(item, `${message}[${index}]`)
  })
}

function assertPositiveInteger(value, message) {
  assert(Number.isInteger(value) && value > 0, message)
}

function assertNonNegativeInteger(value, message) {
  assert(Number.isInteger(value) && value >= 0, message)
}

function validateTemplateSection(section, index) {
  assert(isPlainObject(section), `resultTemplate.sections[${index}] must be an object`)
  assertString(section.id, `resultTemplate.sections[${index}].id is required`)
  assertString(section.type, `resultTemplate.sections[${index}].type is required`)
  assert(SECTION_TYPES.has(section.type), `Unsupported section type: ${section.type}`)

  if (section.title != null) {
    assertString(section.title, `resultTemplate.sections[${index}].title must be a string`)
  }

  assertOptionalString(section.source, `resultTemplate.sections[${index}].source must be a string`)
  assertOptionalString(section.secondarySource, `resultTemplate.sections[${index}].secondarySource must be a string`)
  assertOptionalString(section.group, `resultTemplate.sections[${index}].group must be a string`)

  if (section.card != null) {
    assert(typeof section.card === 'boolean', `resultTemplate.sections[${index}].card must be a boolean`)
  }

  if (section.enabled != null) {
    assert(typeof section.enabled === 'boolean', `resultTemplate.sections[${index}].enabled must be a boolean`)
  }
}

function validateFlowConfig(flow) {
  assert(isPlainObject(flow), 'pack.flow must be an object')
  assertString(flow.mode, 'pack.flow.mode is required')
  assert(FLOW_MODES.has(flow.mode), `Unsupported flow mode: ${flow.mode}`)

  if (flow.shuffleQuestions != null) {
    assert(typeof flow.shuffleQuestions === 'boolean', 'pack.flow.shuffleQuestions must be a boolean')
  }

  if (flow.staticInsertions != null) {
    assert(Array.isArray(flow.staticInsertions), 'pack.flow.staticInsertions must be an array')
    flow.staticInsertions.forEach((insertion, index) => {
      assert(isPlainObject(insertion), `pack.flow.staticInsertions[${index}] must be an object`)
      assertString(insertion.questionId, `pack.flow.staticInsertions[${index}].questionId is required`)
      assertString(insertion.strategy, `pack.flow.staticInsertions[${index}].strategy is required`)
      assert(
        STATIC_INSERTION_STRATEGIES.has(insertion.strategy),
        `Unsupported static insertion strategy: ${insertion.strategy}`,
      )
      if (insertion.minIndex != null) {
        assertNonNegativeInteger(
          insertion.minIndex,
          `pack.flow.staticInsertions[${index}].minIndex must be a non-negative integer`,
        )
      }
    })
  }
}

function validateDisplay(display) {
  assert(isPlainObject(display), 'pack.display is required')

  ;[
    'introEyebrow',
    'introTitle',
    'subtitle',
    'statsLine',
    'estimatedDurationLabel',
    'secondaryNote',
    'disclaimer',
    'startButtonLabel',
    'restartButtonLabel',
    'downloadButtonLabel',
  ].forEach((key) => {
    assertOptionalString(display[key], `pack.display.${key} must be a string`)
  })

  if (display.trustBadges != null) {
    assertStringArray(display.trustBadges, 'pack.display.trustBadges must be an array of strings')
  }

  if (display.spotlightCodes != null) {
    assertStringArray(display.spotlightCodes, 'pack.display.spotlightCodes must be an array of strings')
  }

  if (display.benefits != null) {
    assert(Array.isArray(display.benefits), 'pack.display.benefits must be an array')
    display.benefits.forEach((item, index) => {
      assert(isPlainObject(item), `pack.display.benefits[${index}] must be an object`)
      assertString(item.title, `pack.display.benefits[${index}].title is required`)
      assertString(item.text, `pack.display.benefits[${index}].text is required`)
    })
  }
}

function validateSpecialLogic(specialLogic) {
  assert(isPlainObject(specialLogic), 'pack.specialLogic must be an object')
  assertOptionalString(specialLogic.gateQuestionId, 'pack.specialLogic.gateQuestionId must be a string')
  assertOptionalString(specialLogic.insertQuestionId, 'pack.specialLogic.insertQuestionId must be a string')
  assertOptionalString(specialLogic.insertAfterQuestionId, 'pack.specialLogic.insertAfterQuestionId must be a string')
  assertOptionalString(specialLogic.triggerQuestionId, 'pack.specialLogic.triggerQuestionId must be a string')
  assertOptionalString(specialLogic.hiddenTypeCode, 'pack.specialLogic.hiddenTypeCode must be a string')
  assertOptionalString(specialLogic.fallbackTypeCode, 'pack.specialLogic.fallbackTypeCode must be a string')

  if (specialLogic.similarityFloor != null) {
    assert(
      typeof specialLogic.similarityFloor === 'number' && specialLogic.similarityFloor >= 0,
      'pack.specialLogic.similarityFloor must be a non-negative number',
    )
  }
}

function validateDimensionExplanation(value, label) {
  assert(
    typeof value === 'string' || isPlainObject(value),
    `${label} must be a string or an object keyed by level code`,
  )

  if (isPlainObject(value)) {
    Object.entries(value).forEach(([level, explanation]) => {
      assertString(level, `${label} level key must be a string`)
      assertString(explanation, `${label}.${level} must be a string`)
    })
  }
}

function validateDimensions(dimensions) {
  assert(isPlainObject(dimensions), 'pack.dimensions must be an object')
  assert(Array.isArray(dimensions.order) && dimensions.order.length > 0, 'pack.dimensions.order must be a non-empty array')

  const seen = new Set()
  dimensions.order.forEach((dimensionId, index) => {
    assertString(dimensionId, `pack.dimensions.order[${index}] must be a string`)
    assert(!seen.has(dimensionId), `Duplicate dimension id in pack.dimensions.order: ${dimensionId}`)
    seen.add(dimensionId)
  })

  if (dimensions.meta != null) {
    assert(isPlainObject(dimensions.meta), 'pack.dimensions.meta must be an object')
  }

  if (dimensions.explanations != null) {
    assert(isPlainObject(dimensions.explanations), 'pack.dimensions.explanations must be an object')
    Object.entries(dimensions.explanations).forEach(([dimensionId, value]) => {
      validateDimensionExplanation(value, `pack.dimensions.explanations.${dimensionId}`)
    })
  }

  if (dimensions.sumToLevel != null) {
    assert(isPlainObject(dimensions.sumToLevel), 'pack.dimensions.sumToLevel must be an object')
  }
}

function validatePatterns(patterns) {
  assert(isPlainObject(patterns), 'pack.patterns must be an object')
  assert(Array.isArray(patterns.normalTypes) && patterns.normalTypes.length > 0, 'pack.patterns.normalTypes must be a non-empty array')

  patterns.normalTypes.forEach((pattern, index) => {
    assert(isPlainObject(pattern), `pack.patterns.normalTypes[${index}] must be an object`)
    assertString(pattern.code, `pack.patterns.normalTypes[${index}].code is required`)
    assert(
      isPlainObject(pattern.pattern || pattern.dimensions),
      `pack.patterns.normalTypes[${index}] must provide pattern or dimensions`,
    )
  })
}

function validateQuestion(question, label, questionIds) {
  assert(isPlainObject(question), `${label} must be an object`)
  assert(question.id != null, `${label}.id is required`)

  const questionId = toKey(question.id)
  assert(!questionIds.has(questionId), `Duplicate question id: ${questionId}`)
  questionIds.add(questionId)

  assertString(question.prompt, `${label}.prompt is required`)
  assertOptionalString(question.description, `${label}.description must be a string`)
  assertOptionalString(question.caption, `${label}.caption must be a string`)
  assertOptionalString(question.dim, `${label}.dim must be a string`)
  assertOptionalString(question.kind, `${label}.kind must be a string`)

  if (question.special != null) {
    assert(typeof question.special === 'boolean', `${label}.special must be a boolean`)
  }

  assert(Array.isArray(question.options) && question.options.length > 0, `${label}.options must be a non-empty array`)

  question.options.forEach((option, optionIndex) => {
    const optionLabel = `${label}.options[${optionIndex}]`
    assert(isPlainObject(option), `${optionLabel} must be an object`)
    assertString(option.label, `${optionLabel}.label is required`)
    assertOptionalString(option.hint, `${optionLabel}.hint must be a string`)
  })
}

function validateOutcome(outcome, label) {
  assert(isPlainObject(outcome), `${label} must be an object`)
  assertString(outcome.code, `${label}.code is required`)

  ;['alias', 'badge', 'brief', 'description', 'note', 'image'].forEach((key) => {
    if (outcome[key] != null) {
      assertOptionalString(outcome[key], `${label}.${key} must be a string`)
    }
  })

  ;['tags', 'scenes', 'mantras', 'tips', 'reasons'].forEach((key) => {
    if (outcome[key] != null) {
      assertStringArray(outcome[key], `${label}.${key} must be an array of strings`)
    }
  })
}

export function validateActiveTestConfig(config) {
  assert(isPlainObject(config), 'active-test config must be an object')
  assertString(config.id, 'active-test.id is required')
  assertString(config.manifestPath, 'active-test.manifestPath is required')
  return config
}

export function validatePackManifest(manifest) {
  assert(isPlainObject(manifest), 'Test pack manifest must be an object')
  assertString(manifest.id, 'pack.id is required')
  assertString(manifest.scorerId, 'pack.scorerId is required')
  assertString(manifest.questionsPath, 'pack.questionsPath is required')
  assertString(manifest.outcomesPath, 'pack.outcomesPath is required')
  assert(isPlainObject(manifest.meta), 'pack.meta is required')
  validateDisplay(manifest.display)
  assert(isPlainObject(manifest.resultTemplate), 'pack.resultTemplate is required')
  assert(Array.isArray(manifest.resultTemplate.sections), 'pack.resultTemplate.sections must be an array')
  assert(isPlainObject(manifest.shareConfig), 'pack.shareConfig is required')

  manifest.resultTemplate.sections.forEach(validateTemplateSection)

  if (manifest.resultTemplate.disclaimer != null) {
    const disclaimer = manifest.resultTemplate.disclaimer
    assert(isPlainObject(disclaimer), 'pack.resultTemplate.disclaimer must be an object')
    assert(
      typeof disclaimer.text === 'string' || typeof disclaimer.source === 'string',
      'pack.resultTemplate.disclaimer must provide text or source',
    )
  }

  if (manifest.flow != null) {
    validateFlowConfig(manifest.flow)
  }

  if (manifest.specialLogic != null) {
    validateSpecialLogic(manifest.specialLogic)
  }

  if (manifest.dimensions != null) {
    validateDimensions(manifest.dimensions)
  }

  if (manifest.patterns != null) {
    validatePatterns(manifest.patterns)
  }

  if (manifest.assets != null) {
    assert(isPlainObject(manifest.assets), 'pack.assets must be an object')
  }

  ;['specialQuestionsPath', 'dimensionsPath', 'patternsPath'].forEach((pathKey) => {
    assertOptionalString(manifest[pathKey], `pack.${pathKey} must be a string`)
  })

  if (manifest.shareConfig.rankingLimit != null) {
    assertPositiveInteger(manifest.shareConfig.rankingLimit, 'pack.shareConfig.rankingLimit must be a positive integer')
  }

  if (manifest.shareConfig.linkCopyText != null) {
    assertOptionalString(manifest.shareConfig.linkCopyText, 'pack.shareConfig.linkCopyText must be a string')
  }

  ;[
    'promptTitle',
    'promptBody',
    'primaryActionLabel',
    'secondaryActionLabel',
    'floatingLabel',
  ].forEach((key) => {
    if (manifest.shareConfig[key] != null) {
      assertOptionalString(manifest.shareConfig[key], `pack.shareConfig.${key} must be a string`)
    }
  })

  return manifest
}

export function validateTestPack(pack) {
  validatePackManifest(pack)
  assert(pack.scorerId === 'dimension-pattern-matcher', 'This host currently supports only the dimension-pattern-matcher scorer')
  assert(Array.isArray(pack.questions) && pack.questions.length > 0, 'pack.questions must be a non-empty array')
  assert(Array.isArray(pack.outcomes) && pack.outcomes.length > 0, 'pack.outcomes must be a non-empty array')

  const questionIds = new Set()
  pack.questions.forEach((question, index) => {
    validateQuestion(question, `questions[${index}]`, questionIds)
  })

  if (pack.specialQuestions != null) {
    assert(Array.isArray(pack.specialQuestions), 'pack.specialQuestions must be an array')
    pack.specialQuestions.forEach((question, index) => {
      validateQuestion(question, `specialQuestions[${index}]`, questionIds)
    })
  }

  const outcomeCodes = new Set()
  pack.outcomes.forEach((outcome, index) => {
    validateOutcome(outcome, `outcomes[${index}]`)
    assert(!outcomeCodes.has(outcome.code), `Duplicate outcome code: ${outcome.code}`)
    outcomeCodes.add(outcome.code)
  })

  validateDimensions(pack.dimensions)
  validatePatterns(pack.patterns)

  if (pack.specialLogic != null) {
    const knownQuestionIds = new Set([
      ...(pack.questions || []).map((question) => toKey(question.id)),
      ...((pack.specialQuestions || []).map((question) => toKey(question.id))),
    ])

    ;[
      ['gateQuestionId', pack.specialLogic.gateQuestionId],
      ['insertQuestionId', pack.specialLogic.insertQuestionId],
      ['insertAfterQuestionId', pack.specialLogic.insertAfterQuestionId],
      ['triggerQuestionId', pack.specialLogic.triggerQuestionId],
    ].forEach(([name, value]) => {
      if (value != null) {
        assert(knownQuestionIds.has(toKey(value)), `pack.specialLogic.${name} references an unknown question id`)
      }
    })

    ;[
      ['hiddenTypeCode', pack.specialLogic.hiddenTypeCode],
      ['fallbackTypeCode', pack.specialLogic.fallbackTypeCode],
    ].forEach(([name, value]) => {
      if (value != null) {
        assert(outcomeCodes.has(value), `pack.specialLogic.${name} references an unknown outcome code`)
      }
    })
  }

  if (pack.flow?.staticInsertions) {
    const knownQuestionIds = new Set([
      ...(pack.questions || []).map((question) => toKey(question.id)),
      ...((pack.specialQuestions || []).map((question) => toKey(question.id))),
    ])

    pack.flow.staticInsertions.forEach((insertion, index) => {
      assert(
        knownQuestionIds.has(toKey(insertion.questionId)),
        `pack.flow.staticInsertions[${index}].questionId references an unknown question id`,
      )
    })
  }

  if (pack.display?.spotlightCodes) {
    pack.display.spotlightCodes.forEach((code) => {
      assert(outcomeCodes.has(code), `pack.display.spotlightCodes references an unknown outcome code: ${code}`)
    })
  }

  return pack
}
