import './examples.css'

import { createStandardResultViewModel } from './results/template.js'
import { generateShareImage } from './share.js'
import { createLocalTestPackSource } from './test-pack/source.js'

const EXAMPLE_PACKS = [
  { id: 'gbti', manifestPath: 'tests/gbti/manifest.json' },
  { id: 'sbti', manifestPath: 'tests/sbti/manifest.json' },
  { id: 'abti', manifestPath: 'tests/abti/manifest.json' },
  { id: 'mpti', manifestPath: 'tests/mpti/manifest.json' },
]

const EXAMPLES_PER_PACK = 4

const root = document.getElementById('examples-app')

function hashText(value) {
  return [...String(value)].reduce((hash, char, index) => {
    return (hash * 33 + char.charCodeAt(0) + index) >>> 0
  }, 5381)
}

function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function pickRandom(randomFn, values) {
  return values[Math.floor(randomFn() * values.length)]
}

function sampleUnique(randomFn, values, count, exclude = new Set()) {
  const pool = values.filter((value) => !exclude.has(value))
  const picked = []

  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(randomFn() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }

  return picked
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function stripInfinity(rule) {
  return {
    ...rule,
    min: Number.isFinite(rule.min) ? rule.min : Number.NEGATIVE_INFINITY,
    max: Number.isFinite(rule.max) ? rule.max : Number.POSITIVE_INFINITY,
  }
}

function getScaleRules(pack, dimensionId) {
  const rawRules = pack.dimensions?.sumToLevel?.[dimensionId] || []
  return rawRules.map(stripInfinity)
}

function findRuleIndex(rules, levelCode) {
  return rules.findIndex((rule) => rule.code === levelCode || rule.label === levelCode)
}

function resolveDescription(pack, dimensionId, levelCode) {
  const explanation = pack.dimensions?.explanations?.[dimensionId]
  if (!explanation) return ''
  if (typeof explanation === 'string') return explanation
  return explanation[levelCode] || ''
}

function resolveScoreForRule(rule, randomFn) {
  const min = Number.isFinite(rule.min) ? Math.ceil(rule.min) : null
  const maxExclusive = Number.isFinite(rule.max) ? Math.ceil(rule.max) : null

  if (min == null && maxExclusive != null) {
    return maxExclusive - 1
  }

  if (min != null && maxExclusive == null) {
    return min + Math.floor(randomFn() * 2)
  }

  if (min != null && maxExclusive != null) {
    const maxInclusive = Math.max(min, maxExclusive - 1)
    return min + Math.floor(randomFn() * (maxInclusive - min + 1))
  }

  return 0
}

function buildDimensionItems(pack, patternLevels, randomFn, { mismatchRate = 0 } = {}) {
  return (pack.dimensions?.order || []).map((dimensionId) => {
    const meta = pack.dimensions?.meta?.[dimensionId] || {}
    const rules = getScaleRules(pack, dimensionId)
    const fallbackRule = rules[Math.floor((rules.length - 1) / 2)] || { code: 'M', label: 'M', min: 0, max: 1 }
    const targetCode = patternLevels?.[dimensionId] || fallbackRule.code
    const targetIndex = Math.max(findRuleIndex(rules, targetCode), 0)

    let renderIndex = targetIndex
    if (mismatchRate > 0 && randomFn() < mismatchRate && rules.length > 1) {
      const direction = randomFn() > 0.5 ? 1 : -1
      renderIndex = clamp(targetIndex + direction, 0, rules.length - 1)
    }

    const activeRule = rules[renderIndex] || fallbackRule
    const percentageBase = rules.length > 1 ? (renderIndex / (rules.length - 1)) * 100 : 100
    const percentage = clamp(percentageBase + Math.round((randomFn() - 0.5) * 14), 0, 100)

    return {
      id: dimensionId,
      label: meta.label || dimensionId,
      shortLabel: meta.shortLabel || meta.summaryLabel || meta.label || dimensionId,
      summaryLabel: meta.summaryLabel || meta.shortLabel || meta.label || dimensionId,
      model: meta.model || '',
      score: resolveScoreForRule(activeRule, randomFn),
      index: renderIndex,
      levelCode: activeRule.code,
      levelLabel: activeRule.label || activeRule.code,
      percentage,
      description: resolveDescription(pack, dimensionId, activeRule.code),
    }
  })
}

function createRankingOutcomes(pack, primaryOutcome, randomFn, confidence, { secondaryCode = '' } = {}) {
  const normalCodes = (pack.patterns?.normalTypes || []).map((item) => item.code)
  const excluded = new Set([primaryOutcome.code])
  const firstCode = secondaryCode && normalCodes.includes(secondaryCode) ? secondaryCode : ''
  if (firstCode) excluded.add(firstCode)

  const otherCodes = sampleUnique(randomFn, normalCodes, 2, excluded)
  const rankedCodes = [firstCode || primaryOutcome.code, ...otherCodes].filter(Boolean)

  return rankedCodes.map((code, index) => {
    const outcome = pack.outcomes.find((item) => item.code === code) || primaryOutcome
    return {
      ...outcome,
      score: Math.max(confidence - index * (8 + Math.floor(randomFn() * 6)), 36),
      exactMatches: Math.max((pack.dimensions?.order || []).length - index * 2, 3),
    }
  })
}

function createMockResult(pack, scenario, seed) {
  const randomFn = createSeededRandom(seed)
  const normalPatterns = pack.patterns?.normalTypes || []
  const spotlightCodes = pack.display?.spotlightCodes || []
  const normalCodePool = spotlightCodes.filter((code) => normalPatterns.some((item) => item.code === code))
  const selectedNormal = pickRandom(
    randomFn,
    normalCodePool.length > 0 ? normalCodePool.map((code) => normalPatterns.find((item) => item.code === code)) : normalPatterns,
  )
  const selectedNormalOutcome = pack.outcomes.find((item) => item.code === selectedNormal.code)
  const totalDimensions = (pack.dimensions?.order || []).length

  if (scenario === 'hidden' && pack.specialLogic?.hiddenTypeCode) {
    const heroOutcome = pack.outcomes.find((item) => item.code === pack.specialLogic.hiddenTypeCode)
    const dimensions = buildDimensionItems(pack, selectedNormal.dimensions, randomFn)
    return createStandardResultViewModel({
      pack,
      heroOutcome: {
        ...heroOutcome,
        score: 100,
        exactMatches: totalDimensions,
        kicker: '隐藏结果已激活',
        sub: heroOutcome?.brief || '这张样张展示隐藏结果的分享图表现。',
      },
      secondaryHeroOutcome: {
        ...selectedNormalOutcome,
        score: 92,
        exactMatches: Math.max(totalDimensions - 1, 1),
      },
      rankingOutcomes: createRankingOutcomes(pack, heroOutcome, randomFn, 92, { secondaryCode: selectedNormal.code }),
      dimensions,
      specialState: {
        active: true,
        reason: 'triggered',
        primaryCode: heroOutcome.code,
        normalPrimaryCode: selectedNormal.code,
        similarity: 92,
        exactMatches: Math.max(totalDimensions - 1, 1),
      },
      meta: {
        confidence: 100,
        kicker: '隐藏结果已激活',
      },
      raw: {
        source: 'examples',
        scenario,
      },
    })
  }

  if (scenario === 'fallback' && pack.specialLogic?.fallbackTypeCode) {
    const heroOutcome = pack.outcomes.find((item) => item.code === pack.specialLogic.fallbackTypeCode)
    const confidence = Math.max(32, (pack.specialLogic?.similarityFloor || 60) - 8 - Math.floor(randomFn() * 8))
    const dimensions = buildDimensionItems(pack, selectedNormal.dimensions, randomFn, { mismatchRate: 0.34 })
    return createStandardResultViewModel({
      pack,
      heroOutcome: {
        ...heroOutcome,
        score: confidence,
        exactMatches: Math.max(Math.floor(totalDimensions * 0.45), 2),
        kicker: '系统稳健兜底',
        sub: heroOutcome?.brief || '这张样张展示低匹配度兜底结果的分享图表现。',
      },
      secondaryHeroOutcome: {
        ...selectedNormalOutcome,
        score: confidence,
        exactMatches: Math.max(Math.floor(totalDimensions * 0.45), 2),
      },
      rankingOutcomes: createRankingOutcomes(pack, selectedNormalOutcome, randomFn, confidence, { secondaryCode: selectedNormal.code }),
      dimensions,
      specialState: {
        active: true,
        reason: 'fallback',
        primaryCode: heroOutcome.code,
        normalPrimaryCode: selectedNormal.code,
        similarity: confidence,
        exactMatches: Math.max(Math.floor(totalDimensions * 0.45), 2),
      },
      meta: {
        confidence,
        kicker: '系统稳健兜底',
      },
      raw: {
        source: 'examples',
        scenario,
      },
    })
  }

  const heroCode = scenario?.startsWith('normal:')
    ? scenario.split(':')[1]
    : selectedNormal.code
  const heroPattern = normalPatterns.find((item) => item.code === heroCode) || selectedNormal
  const heroOutcome = pack.outcomes.find((item) => item.code === heroPattern.code)
  const confidence = 82 + Math.floor(randomFn() * 17)
  const dimensions = buildDimensionItems(pack, heroPattern.dimensions, randomFn)

  return createStandardResultViewModel({
    pack,
    heroOutcome: {
      ...heroOutcome,
      score: confidence,
      exactMatches: totalDimensions - Math.floor(randomFn() * 3),
      kicker: '你的主结果',
      sub: heroOutcome?.brief || '这张样张展示常规结果的分享图表现。',
    },
    rankingOutcomes: createRankingOutcomes(pack, heroOutcome, randomFn, confidence),
    dimensions,
    specialState: {
      active: false,
      reason: 'normal',
      primaryCode: heroOutcome.code,
      normalPrimaryCode: heroOutcome.code,
      similarity: confidence,
      exactMatches: totalDimensions - Math.floor(randomFn() * 3),
    },
    meta: {
      confidence,
      kicker: '你的主结果',
    },
    raw: {
      source: 'examples',
      scenario,
    },
  })
}

function getPackScenarios(pack) {
  const normalCodes = (pack.display?.spotlightCodes || []).filter((code) => {
    return (pack.patterns?.normalTypes || []).some((item) => item.code === code)
  })

  const scenarios = []

  if (normalCodes.length > 0) {
    scenarios.push(...normalCodes.slice(0, 2).map((code) => `normal:${code}`))
  } else {
    scenarios.push('normal')
  }

  if (pack.specialLogic?.hiddenTypeCode) {
    scenarios.push('hidden')
  }

  if (pack.specialLogic?.fallbackTypeCode) {
    scenarios.push('fallback')
  }

  while (scenarios.length < EXAMPLES_PER_PACK) {
    scenarios.push('normal')
  }

  return scenarios.slice(0, EXAMPLES_PER_PACK)
}

function getSelectedPackId() {
  const explicitPackId = root?.dataset?.packId?.trim().toLowerCase()
  if (explicitPackId) return explicitPackId

  const pathname = window.location.pathname.replace(/\/+$/, '')
  const matchedPack = EXAMPLE_PACKS.find(({ id }) => pathname.endsWith(`/examples/${id}`))
  return matchedPack?.id || ''
}

function createHero(selectedPackId = '') {
  const generatedAt = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())
  const selectedPack = selectedPackId ? EXAMPLE_PACKS.find(({ id }) => id === selectedPackId) : null
  const title = selectedPack ? `${selectedPack.id.toUpperCase()} 结果图样张` : '多测试结果图样张画廊'
  const subtitle = selectedPack
    ? `这里直接复用真实的分享图生成器，只渲染 ${selectedPack.id.toUpperCase()} 的结果样张。每次重生成都会带一点随机抖动，二维码和分享链接统一指向 https://personalityhub.dpdns.org/，方便我们直接挑图发小红书。`
    : '这里直接复用真实的分享图生成器，按 pack 批量渲染样张。每张图都会带一点随机抖动，二维码和分享链接统一指向 https://personalityhub.dpdns.org/，方便我们更快挑出适合发小红书的版本。'
  const navigation = selectedPack
    ? `<a class="examples-btn examples-btn-secondary" href="/examples/">查看全部测试</a>
       <a class="examples-btn examples-btn-secondary" href="/">返回主测试</a>`
    : `<a class="examples-btn examples-btn-secondary" href="/">返回主测试</a>`
  const chips = selectedPack
    ? `
      <span class="examples-chip">当前测试：${selectedPack.id.toUpperCase()}</span>
      <span class="examples-chip">渲染对象：真实分享图 PNG</span>
      <span class="examples-chip">分享落地页：https://personalityhub.dpdns.org/</span>
      <span class="examples-chip" id="generated-at">最近生成：${generatedAt}</span>
    `
    : `
      <span class="examples-chip">启动模式：Vite dev / examples</span>
      <span class="examples-chip">渲染对象：真实分享图 PNG</span>
      <span class="examples-chip">分享落地页：https://personalityhub.dpdns.org/</span>
      <span class="examples-chip" id="generated-at">最近生成：${generatedAt}</span>
    `

  return `
    <div class="examples-shell">
      <section class="examples-hero">
        <div class="examples-hero-top">
          <div>
            <div class="examples-eyebrow">Dev Examples</div>
            <h1 class="examples-title">${title}</h1>
            <p class="examples-subtitle">${subtitle}</p>
          </div>
          <div class="examples-actions">
            <button class="examples-btn examples-btn-primary" id="reroll-all">重新生成全部</button>
            ${navigation}
          </div>
        </div>
        <div class="examples-meta">
          ${chips}
        </div>
      </section>
      <div id="examples-groups"></div>
    </div>
  `
}

function updateGeneratedAt() {
  const target = document.getElementById('generated-at')
  if (!target) return

  const text = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())
  target.textContent = `最近生成：${text}`
}

function buildExampleFileName(pack, result, scenario) {
  const normalizedScenario = String(scenario || 'normal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${pack.id}-${result.hero.code}-${normalizedScenario || 'normal'}-example.png`
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

function createPackSection(pack) {
  const host = document.createElement('section')
  host.className = 'examples-pack'
  host.innerHTML = `
    <div class="examples-pack-head">
      <div>
        <h2 class="examples-pack-title">${pack.meta?.browserTitle || pack.id}</h2>
        <p class="examples-pack-copy">${pack.meta?.description || pack.display?.subtitle || ''}</p>
      </div>
      <div class="examples-pack-badges">
        <span class="examples-pack-badge">${pack.questions.length} 题</span>
        <span class="examples-pack-badge">${pack.outcomes.length} 结果</span>
        <span class="examples-pack-badge">${pack.dimensions?.order?.length || 0} 维度</span>
      </div>
    </div>
    <div class="examples-grid"></div>
  `

  return host
}

function createExampleCard(pack, scenario, seedBase, index) {
  const card = document.createElement('article')
  card.className = 'example-card'
  card.innerHTML = `
    <div class="example-card-top">
      <div>
        <h3 class="example-card-title">${pack.id.toUpperCase()} · ${scenario}</h3>
        <p class="example-card-subtitle">真实分享图渲染，当前卡片会在每次重生成时换一版随机维度。</p>
      </div>
      <span class="example-state">ready</span>
    </div>
    <div class="example-preview">
      <div class="example-loading">正在生成样张...</div>
    </div>
    <div class="example-footer">
      <div class="example-meta"></div>
      <div class="example-actions">
        <button class="examples-btn examples-btn-secondary" type="button" data-action="reroll">重随机这张</button>
        <button class="examples-btn examples-btn-primary" type="button" data-action="download">下载样张</button>
      </div>
    </div>
  `

  const stateEl = card.querySelector('.example-state')
  const previewEl = card.querySelector('.example-preview')
  const metaEl = card.querySelector('.example-meta')
  const rerollButton = card.querySelector('[data-action="reroll"]')
  const downloadButton = card.querySelector('[data-action="download"]')
  let latestPreview = null
  let counter = 0

  async function render() {
    counter += 1
    const seed = seedBase + counter * 97 + index * 17
    stateEl.textContent = 'rendering'
    previewEl.innerHTML = '<div class="example-loading">正在生成真实分享图，请稍等...</div>'
    rerollButton.disabled = true
    downloadButton.disabled = true

    try {
      const result = createMockResult(pack, scenario, seed)
      const { dataUrl } = await generateShareImage(result, { output: 'data-url' })
      const img = document.createElement('img')
      img.src = dataUrl
      img.alt = `${pack.id}-${scenario}-${result.hero.code}`
      previewEl.replaceChildren(img)
      latestPreview = {
        dataUrl,
        fileName: buildExampleFileName(pack, result, scenario),
      }

      const confidence = result.meta?.confidence ?? 0
      const leadLevel = result.dimensions?.[0]?.levelCode || '-'
      metaEl.innerHTML = `
        <span class="example-meta-chip">${result.hero.code}</span>
        <span class="example-meta-chip">匹配度 ${confidence}%</span>
        <span class="example-meta-chip">首维 ${leadLevel}</span>
        <span class="example-meta-chip">seed ${seed}</span>
      `
      stateEl.textContent = result.specialState?.reason || 'normal'
    } catch (error) {
      latestPreview = null
      previewEl.innerHTML = `<div class="example-loading">生成失败：${error.message}</div>`
      stateEl.textContent = 'error'
    } finally {
      rerollButton.disabled = false
      downloadButton.disabled = !latestPreview
    }
  }

  rerollButton.addEventListener('click', () => {
    void render()
  })

  downloadButton.addEventListener('click', () => {
    if (!latestPreview) return
    downloadDataUrl(latestPreview.dataUrl, latestPreview.fileName)
  })

  return { card, render }
}

async function loadPacks(selectedPackId = '') {
  const source = createLocalTestPackSource()
  const targets = selectedPackId
    ? EXAMPLE_PACKS.filter(({ id }) => id === selectedPackId)
    : EXAMPLE_PACKS
  return Promise.all(targets.map(({ manifestPath }) => source.loadPackByManifestPath(manifestPath)))
}

function updateDocumentMeta(packs, selectedPackId = '') {
  const title = selectedPackId
    ? `${selectedPackId.toUpperCase()} Examples`
    : 'Examples Gallery'
  document.title = title

  const description = selectedPackId
    ? `Examples for ${selectedPackId.toUpperCase()} result posters`
    : 'Examples for all test result posters'
  const descriptionMeta = document.querySelector('meta[name="description"]')
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', description)
  }

  const headingMeta = document.querySelector('meta[name="x-examples-pack-count"]')
  if (headingMeta) {
    headingMeta.setAttribute('content', String(packs.length))
  }
}

function renderPackLinks(selectedPackId = '') {
  if (selectedPackId) return ''
  const links = EXAMPLE_PACKS.map(({ id }) => {
    return `<a class="examples-pack-badge" href="/examples/${id}/">${id.toUpperCase()}</a>`
  }).join('')
  return `<div class="examples-pack-links">${links}</div>`
}

async function renderExamples(selectedPackId = '') {
  const groupsRoot = document.getElementById('examples-groups')
  const rerollAllButton = document.getElementById('reroll-all')
  const packs = await loadPacks(selectedPackId)
  const renderers = []
  updateDocumentMeta(packs, selectedPackId)

  groupsRoot.innerHTML = ''
  if (!selectedPackId) {
    groupsRoot.insertAdjacentHTML('beforebegin', renderPackLinks(selectedPackId))
  }

  packs.forEach((pack, packIndex) => {
    const section = createPackSection(pack)
    const grid = section.querySelector('.examples-grid')
    const scenarios = getPackScenarios(pack)

    scenarios.forEach((scenario, scenarioIndex) => {
      const seedBase = Date.now() + hashText(`${pack.id}:${scenario}:${packIndex}:${scenarioIndex}`)
      const entry = createExampleCard(pack, scenario, seedBase, scenarioIndex)
      grid.appendChild(entry.card)
      renderers.push(entry)
    })

    groupsRoot.appendChild(section)
  })

  rerollAllButton.onclick = async () => {
    rerollAllButton.disabled = true
    updateGeneratedAt()
    for (const renderer of renderers) {
      // Serial rendering keeps the page responsive and avoids spiking canvas/image work.
      await renderer.render()
    }
    rerollAllButton.disabled = false
  }

  updateGeneratedAt()
  await rerollAllButton.onclick()
}

async function init() {
  if (!root) return
  const selectedPackId = getSelectedPackId()
  root.innerHTML = createHero(selectedPackId)

  try {
    await renderExamples(selectedPackId)
  } catch (error) {
    root.innerHTML = `
      <div class="examples-shell">
        <section class="examples-hero">
          <div class="examples-eyebrow">Dev Examples</div>
          <h1 class="examples-title">样张页加载失败</h1>
          <p class="examples-subtitle">${error.message}</p>
        </section>
      </div>
    `
    throw error
  }
}

void init()
