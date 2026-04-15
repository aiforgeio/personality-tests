import { getByPath } from '../utils.js'

function toTitle(value) {
  return value.alias ?? value.name ?? value.title ?? value.code ?? ''
}

function toSubtitle(value) {
  return value.english ?? value.subtitle ?? ''
}

function resolveHeroImage(outcome, pack) {
  const image = [outcome.heroImage, outcome.image, outcome.imageUrl].find((value) => typeof value === 'string' && value.trim()) || ''
  if (!image) return ''

  if (/^(https?:|\/|data:)/.test(image)) {
    return image
  }

  const basePath = pack.assets?.heroImageBasePath
  if (!basePath) {
    return image
  }

  return `${String(basePath).replace(/\/$/, '')}/${String(image).replace(/^\//, '')}`
}

function toTextItems(values) {
  if (!Array.isArray(values)) return []

  return values
    .filter((value) => value != null && value !== '')
    .map((value) => {
      if (typeof value === 'object') {
        return {
          text: value.text ?? value.label ?? value.value ?? '',
          note: value.note ?? '',
        }
      }

      return { text: String(value), note: '' }
    })
}

function toStatItems(values) {
  if (!Array.isArray(values)) return []

  return values
    .filter(Boolean)
    .map((value) => {
      if (typeof value === 'object') {
        return {
          label: value.label ?? '',
          value: value.value ?? value.text ?? '',
          note: value.note ?? '',
          tone: value.tone ?? 'default',
        }
      }

      return {
        label: '',
        value: String(value),
        note: '',
        tone: 'default',
      }
    })
}

function toReasonItems(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (value && typeof value === 'object') {
    return [
      value.main ? `主导因子：${value.main}` : '',
      value.second ? `第二标签：${value.second}` : '',
      value.third ? `第三标签：${value.third}` : '',
      value.judge ? `人格判断：${value.judge}` : '',
    ].filter(Boolean)
  }

  return []
}

function toDimensionItems(values) {
  if (!Array.isArray(values)) return []

  return values
    .filter(Boolean)
    .map((value) => ({
      id: value.id ?? '',
      label: value.label ?? value.id ?? '',
      shortLabel: value.shortLabel ?? value.label ?? value.id ?? '',
      model: value.model ?? '',
      score: value.score ?? 0,
      percentage: value.percentage ?? 0,
      levelCode: value.levelCode ?? value.level ?? '',
      levelLabel: value.levelLabel ?? value.level ?? '',
      description: value.description ?? '',
      explanation: value.explanation ?? '',
    }))
}

function defaultSourceForSection(type) {
  if (type === 'hero-summary' || type === 'image-panel') {
    return 'hero'
  }

  if (type === 'stats-inline') {
    return 'meta.stats'
  }

  if (type === 'dimension-list') {
    return 'dimensions'
  }

  return ''
}

function resolveSectionPayload(section, context) {
  const sourcePath = section.source || defaultSourceForSection(section.type)
  const secondarySourcePath = section.secondarySource || ''
  const source = sourcePath ? getByPath(context, sourcePath, null) : null
  const secondarySource = secondarySourcePath ? getByPath(context, secondarySourcePath, null) : null

  switch (section.type) {
    case 'tag-list':
    case 'bullet-list':
      return { items: toTextItems(source) }
    case 'stats-inline':
      return { items: toStatItems(source) }
    case 'dimension-list':
      return { items: toDimensionItems(source) }
    case 'hero-summary':
      return {
        content: {
          hero: source ?? context.hero,
          secondaryHero: secondarySource ?? context.secondaryHero,
          shareBadgeText: context.share?.badgeText ?? '',
          specialState: context.specialState ?? null,
        },
      }
    case 'image-panel':
      return {
        content: {
          hero: source ?? context.hero,
          secondaryHero: secondarySource ?? context.secondaryHero,
          posterMode: context.pack.assets?.posterMode ?? 'text-card',
        },
      }
    default:
      return { items: [] }
  }
}

function normalizeMeta(pack, meta = {}) {
  const existingStats = toStatItems(meta.stats)

  if (existingStats.length > 0) {
    return {
      ...meta,
      stats: existingStats,
    }
  }

  const fallbackStats = [
    { label: '题量', value: `${pack.questions?.length ?? 0} 题` },
    { label: '人格池', value: `${pack.outcomes?.length ?? 0} 型` },
  ]

  if (meta.confidence != null) {
    fallbackStats.push({ label: '匹配度', value: `${meta.confidence}%`, tone: 'accent' })
  }

  return {
    ...meta,
    stats: fallbackStats,
  }
}

export function createHeroViewModel(outcome, pack, meta = {}) {
  const subtitle = toSubtitle(outcome)

  return {
    kicker: outcome.kicker ?? meta.kicker ?? '',
    code: outcome.code ?? '',
    title: toTitle(outcome),
    subtitle,
    sub: outcome.sub ?? subtitle,
    badge: outcome.badge ?? '',
    description: outcome.brief ?? outcome.description ?? '',
    note: outcome.systemNote ?? outcome.note ?? '',
    image: resolveHeroImage(outcome, pack),
    rarity: outcome.rarity ?? '',
    art: outcome.art ?? null,
    tags: Array.isArray(outcome.tags) ? outcome.tags : [],
    scenes: Array.isArray(outcome.scenes) ? outcome.scenes : [],
    mantras: Array.isArray(outcome.mantras) ? outcome.mantras : [],
    tips: Array.isArray(outcome.tips) ? outcome.tips : [],
    reasons: toReasonItems(outcome.reasons),
    confidence: meta.confidence ?? null,
    data: outcome,
  }
}

export function createRankingViewModel(rankingOutcomes) {
  return rankingOutcomes.map((item, index) => ({
    code: item.code,
    title: toTitle(item),
    subtitle: toSubtitle(item),
    score: item.score ?? 0,
    rank: index + 1,
    isPrimary: index === 0,
    data: item,
  }))
}

export function buildTemplateSections(template, context) {
  const sections = template?.sections ?? []

  return sections.flatMap((section) => {
    if (section.enabled === false) {
      return []
    }

    return [{
      id: section.id,
      type: section.type,
      title: section.title ?? '',
      group: section.group ?? null,
      card: Boolean(section.card),
      ...resolveSectionPayload(section, context),
    }]
  })
}

function resolveDisclaimer(template, context) {
  const disclaimer = template?.disclaimer
  if (!disclaimer) return ''

  if (typeof disclaimer.text === 'string') {
    return disclaimer.text
  }

  if (typeof disclaimer.source === 'string') {
    return getByPath(context, disclaimer.source, '')
  }

  return ''
}

export function buildShareModel({ pack, hero, ranking, meta, secondaryHero }) {
  const rankingLimit = pack.shareConfig?.rankingLimit ?? 3

  return {
    title: pack.shareConfig?.title ?? pack.meta?.browserTitle ?? hero.title,
    footer: pack.shareConfig?.footer ?? '',
    rankingTitle: pack.shareConfig?.rankingTitle ?? '人格匹配',
    rankingLimit,
    rankingItems: ranking.slice(0, rankingLimit),
    badgeText: meta.confidence != null
      ? `${pack.shareConfig?.badgeLabel ?? '匹配度'} ${meta.confidence}%`
      : '',
    heroImage: hero.image ?? '',
    heroArt: hero.art ?? null,
    secondaryTitle: secondaryHero?.title ?? '',
    fileName: `${pack.shareConfig?.filenamePrefix ?? pack.id}-${hero.code}.png`,
  }
}

export function createStandardResultViewModel({
  pack,
  heroOutcome,
  rankingOutcomes,
  secondaryHeroOutcome = null,
  dimensions = [],
  specialState = null,
  meta,
  raw,
}) {
  const normalizedMeta = normalizeMeta(pack, meta)
  const hero = createHeroViewModel(heroOutcome, pack, normalizedMeta)
  const secondaryHero = secondaryHeroOutcome
    ? createHeroViewModel(secondaryHeroOutcome, pack, normalizedMeta)
    : null
  const ranking = createRankingViewModel(rankingOutcomes)
  const share = buildShareModel({ pack, hero, ranking, meta: normalizedMeta, secondaryHero })
  const context = {
    hero,
    secondaryHero,
    dimensions,
    specialState,
    ranking,
    pack,
    meta: normalizedMeta,
    raw,
    share,
  }

  return {
    hero,
    secondaryHero,
    dimensions,
    specialState,
    ranking,
    sections: buildTemplateSections(pack.resultTemplate, context),
    share,
    disclaimer: resolveDisclaimer(pack.resultTemplate, context),
    meta: normalizedMeta,
    raw,
  }
}
