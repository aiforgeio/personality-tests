import { isPlainObject, loadJSON } from '../utils.js'
import { validateActiveTestConfig, validatePackManifest, validateTestPack } from './schema.js'

const JSON_ASSET_URLS = import.meta.glob('../../data/**/*.json', {
  eager: true,
  query: '?url',
  import: 'default',
})

const FILE_ASSET_URLS = import.meta.glob('../../data/**/*.{png,jpg,jpeg,gif,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const OPTIONAL_BLOCKS = [
  ['specialQuestionsPath', 'specialQuestions'],
  ['dimensionsPath', 'dimensions'],
  ['patternsPath', 'patterns'],
]

function normalizeDataPath(path) {
  return String(path || '')
    .replace(/^\.?\//, '')
    .replace(/^data\//, '')
}

function toPathSegments(path) {
  return normalizeDataPath(path).split('/').filter(Boolean)
}

function resolveDataPath(path, basePath = '') {
  const rawPath = String(path || '')
  if (!rawPath) return normalizeDataPath(basePath)
  if (rawPath.startsWith('/')) {
    return normalizeDataPath(rawPath)
  }

  const segments = rawPath.split('/').filter(Boolean)
  const baseSegments = toPathSegments(basePath)
  if (baseSegments.length > 0) {
    baseSegments.pop()
  }

  const resolved = rawPath.startsWith('./') || rawPath.startsWith('../')
    ? [...baseSegments]
    : []

  segments.forEach((segment) => {
    if (segment === '.') return
    if (segment === '..') {
      resolved.pop()
      return
    }
    resolved.push(segment)
  })

  return resolved.join('/')
}

function resolveDataAssetUrl(path, { basePath = '', assetUrls = JSON_ASSET_URLS } = {}) {
  const resolvedPath = resolveDataPath(path, basePath)
  const key = `../../data/${resolvedPath}`
  const assetUrl = assetUrls[key]

  if (!assetUrl) {
    throw new Error(`Missing data asset: ${resolvedPath}`)
  }

  return assetUrl
}

function resolveOptionalAssetUrl(path, { basePath = '' } = {}) {
  if (!path || /^(https?:|\/|data:)/.test(path)) {
    return path || ''
  }

  const resolvedPath = resolveDataPath(path, basePath)
  const key = `../../data/${resolvedPath}`
  return FILE_ASSET_URLS[key] || path
}

function normalizeOption(option, index) {
  const nextOption = isPlainObject(option) ? option : {}
  const label = typeof nextOption.label === 'string' ? nextOption.label : ''

  return {
    ...nextOption,
    id: nextOption.id ?? `option-${index + 1}`,
    label,
    hint: nextOption.hint ?? nextOption.roast ?? '',
    value: nextOption.value ?? nextOption.id ?? label ?? index,
  }
}

function normalizeQuestion(question, index, { special = false } = {}) {
  const nextQuestion = isPlainObject(question) ? question : {}

  return {
    ...nextQuestion,
    id: nextQuestion.id ?? `question-${index + 1}`,
    prompt: nextQuestion.prompt ?? nextQuestion.text ?? '',
    description: nextQuestion.description ?? '',
    caption: nextQuestion.caption ?? '',
    kind: nextQuestion.kind ?? 'single',
    special: nextQuestion.special ?? special,
    options: Array.isArray(nextQuestion.options)
      ? nextQuestion.options.map(normalizeOption)
      : [],
  }
}

function normalizeOutcome(outcome, manifestPath) {
  const nextOutcome = isPlainObject(outcome) ? outcome : {}

  return {
    ...nextOutcome,
    image: resolveOptionalAssetUrl(nextOutcome.image, { basePath: manifestPath }),
    heroImage: resolveOptionalAssetUrl(nextOutcome.heroImage, { basePath: manifestPath }),
    imageUrl: resolveOptionalAssetUrl(nextOutcome.imageUrl, { basePath: manifestPath }),
  }
}

function normalizePack(manifest, data, manifestPath) {
  const questions = Array.isArray(data.questions)
    ? data.questions.map((question, index) => normalizeQuestion(question, index))
    : []
  const specialQuestions = Array.isArray(data.specialQuestions)
    ? data.specialQuestions.map((question, index) => normalizeQuestion(question, index, { special: true }))
    : undefined

  return {
    ...manifest,
    ...data,
    questions,
    outcomes: Array.isArray(data.outcomes)
      ? data.outcomes.map((outcome) => normalizeOutcome(outcome, manifestPath))
      : [],
    specialQuestions,
  }
}

export function createLocalTestPackSource({ activeTestPath = 'active-test.json' } = {}) {
  const manifestPromises = new Map()
  const packPromises = new Map()
  let activeConfigPromise

  async function loadActiveTestConfig() {
    if (!activeConfigPromise) {
      activeConfigPromise = loadJSON(resolveDataAssetUrl(activeTestPath)).then(validateActiveTestConfig)
    }

    return activeConfigPromise
  }

  async function loadManifestByPath(manifestPath) {
    const resolvedManifestPath = resolveDataPath(manifestPath)

    if (!manifestPromises.has(resolvedManifestPath)) {
      const manifestPromise = loadJSON(resolveDataAssetUrl(resolvedManifestPath))
        .then((manifest) => validatePackManifest({
          ...manifest,
          __manifestPath: resolvedManifestPath,
        }))
      manifestPromises.set(resolvedManifestPath, manifestPromise)
    }

    return manifestPromises.get(resolvedManifestPath)
  }

  async function loadPackByManifestPath(manifestPath) {
    const resolvedManifestPath = resolveDataPath(manifestPath)

    if (!packPromises.has(resolvedManifestPath)) {
      const packPromise = loadManifestByPath(resolvedManifestPath).then(async (manifest) => {
        const [questions, outcomes, optionalBlocks] = await Promise.all([
          loadJSON(resolveDataAssetUrl(manifest.questionsPath, { basePath: manifest.__manifestPath })),
          loadJSON(resolveDataAssetUrl(manifest.outcomesPath, { basePath: manifest.__manifestPath })),
          Promise.all(
            OPTIONAL_BLOCKS
              .filter(([pathKey]) => manifest[pathKey])
              .map(async ([pathKey, targetKey]) => {
                const value = await loadJSON(resolveDataAssetUrl(manifest[pathKey], { basePath: manifest.__manifestPath }))
                return [targetKey, value]
              }),
          ).then(Object.fromEntries),
        ])

        return validateTestPack(normalizePack(manifest, {
          ...optionalBlocks,
          questions,
          outcomes,
          specialQuestions: optionalBlocks.specialQuestions ?? manifest.specialQuestions,
          dimensions: optionalBlocks.dimensions ?? manifest.dimensions,
          patterns: optionalBlocks.patterns ?? manifest.patterns,
        }, manifest.__manifestPath))
      })

      packPromises.set(resolvedManifestPath, packPromise)
    }

    return packPromises.get(resolvedManifestPath)
  }

  async function loadActiveManifest() {
    const config = await loadActiveTestConfig()
    return loadManifestByPath(config.manifestPath)
  }

  async function loadActivePack() {
    const config = await loadActiveTestConfig()
    return loadPackByManifestPath(config.manifestPath)
  }

  return {
    loadActiveTestConfig,
    loadManifestByPath,
    loadPackByManifestPath,
    loadActiveManifest,
    loadActivePack,
    warmActivePack: loadActivePack,
  }
}
