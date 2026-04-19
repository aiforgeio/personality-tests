import { getCachedImage, preloadImage } from './image-cache.js'
import {
  getComparisonHero,
  getHighlightTags,
  getShareCardStats,
} from './result-highlights.js'
import { formatCode, stripEndingPunctuation } from './utils.js'

const DEFAULT_ACTION_COPY = {
  promptTitle: '这个结果很适合发给朋友对照一下',
  promptBody: '生成结果海报发给朋友，看看你们分别更像哪一种类型。',
  primaryActionLabel: '保存结果海报',
  secondaryActionLabel: '分享链接',
  floatingLabel: '保存结果海报',
}

const DEFAULT_INLINE_SHARE_COPY = {
  title: '这个结果很适合发给朋友对照一下',
  body: '生成结果海报发给朋友，看看你们分别更像哪一种类型。',
  primaryActionLabel: '生成结果海报',
  nudgeLabel: '生成海报，发给朋友',
}

const DEFAULT_DISCLOSURE_LABEL = '展开更多分析'
const DETAIL_PRIORITY_COUNT = 2

const LEVEL_DISPLAY_LABELS = {
  L: '低',
  M: '中',
  H: '高',
}

function renderTextList(container, values) {
  const list = document.createElement('ul')
  list.className = 'bullet-list'

  values.forEach((value) => {
    const row = document.createElement('li')
    row.textContent = stripEndingPunctuation(value.text)
    list.appendChild(row)
  })

  container.appendChild(list)
}

function renderTags(container, values) {
  container.innerHTML = ''
  values.forEach((value) => {
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = stripEndingPunctuation(value)
    container.appendChild(tag)
  })
}

function getHeroPalette(hero) {
  return {
    accent: hero.art?.accent ?? '#4CAF50',
    surface: hero.art?.shirt ?? 'rgba(76, 175, 80, 0.2)',
    shadow: hero.art?.pants ?? '#4f6252',
    ink: hero.art?.hair ?? '#111111',
    skin: hero.art?.skin ?? '#ecd1b2',
  }
}

/* ---- 英雄艺术卡片（无图片时的占位） ---- */

function createHeroArtCard(hero) {
  const palette = getHeroPalette(hero)
  const card = document.createElement('div')
  card.className = 'hero-art-card'
  card.style.setProperty('--hero-accent', palette.accent)
  card.style.setProperty('--hero-surface', palette.surface)
  card.style.setProperty('--hero-shadow', palette.shadow)
  card.style.setProperty('--hero-ink', palette.ink)
  card.style.setProperty('--hero-skin', palette.skin)

  const symbol = hero.art?.symbol
    ? String(hero.art.symbol).replace(/_/g, ' ').toUpperCase()
    : formatCode(hero.code)

  card.innerHTML = `
    <div class="hero-art-glow"></div>
    <div class="hero-art-orbit hero-art-orbit-a"></div>
    <div class="hero-art-orbit hero-art-orbit-b"></div>
    <div class="hero-art-avatar">
      <div class="hero-art-head"></div>
      <div class="hero-art-body"></div>
    </div>
    <div class="hero-art-label">${symbol}</div>
    <div class="hero-art-code">${formatCode(hero.code)}</div>
  `

  return card
}

function createHeroImageFrame(hero, priority = 'high') {
  const frame = document.createElement('div')
  frame.className = 'hero-media-frame is-loading'

  const skeleton = document.createElement('div')
  skeleton.className = 'hero-image-skeleton'
  frame.appendChild(skeleton)

  const image = document.createElement('img')
  image.className = 'hero-image'
  image.alt = hero.title || hero.code
  image.loading = 'eager'
  image.decoding = 'async'

  try {
    image.fetchPriority = priority
  } catch (error) {
    // fetchPriority is not supported in all browsers.
  }

  const reveal = () => {
    frame.classList.remove('is-loading')
    image.classList.add('is-ready')
  }

  image.addEventListener('load', reveal, { once: true })
  image.addEventListener('error', () => {
    frame.replaceChildren(createHeroArtCard(hero))
  }, { once: true })

  const cachedImage = getCachedImage(hero.image)
  image.src = cachedImage?.currentSrc || cachedImage?.src || hero.image
  frame.appendChild(image)

  if (image.complete && image.naturalWidth > 0) {
    reveal()
  } else {
    void preloadImage(hero.image, {
      fetchPriority: priority,
      decoding: 'async',
    }).catch(() => {
      frame.replaceChildren(createHeroArtCard(hero))
    })
  }

  return frame
}

/* ---- 渲染英雄图片区域 ---- */

function renderHeroMedia(container, hero, { priority = 'high' } = {}) {
  container.innerHTML = ''

  if (hero.image) {
    container.appendChild(createHeroImageFrame(hero, priority))
    return
  }

  container.appendChild(createHeroArtCard(hero))
}

/* ---- 渲染英雄摘要（分享卡片内） ---- */

function renderHeroSummaryInCard(container, result) {
  const hero = result.hero || {}
  const comparison = result.secondaryHero ? getComparisonHero(result) : null

  container.innerHTML = ''
  const hasNaturalHeroTitle = Boolean(hero?.data?.alias || hero?.data?.name || hero?.data?.title)
  const displayHeroTitle = hasNaturalHeroTitle
    ? stripEndingPunctuation(hero.title || '')
    : (hero.title || '')

  const titleEl = document.createElement('div')
  titleEl.className = 'hero-summary-title'
  titleEl.textContent = displayHeroTitle
  container.appendChild(titleEl)

  const codeEl = document.createElement('div')
  codeEl.className = 'hero-summary-code'
  codeEl.textContent = formatCode(hero.code)
  container.appendChild(codeEl)

  if (hero.badge) {
    const leadEl = document.createElement('div')
    leadEl.className = 'hero-summary-lead'
    leadEl.textContent = stripEndingPunctuation(hero.badge)
    container.appendChild(leadEl)
  }

  if (comparison) {
    const secondary = document.createElement('div')
    secondary.className = 'secondary-hero is-compact'
    secondary.innerHTML = `
      <div class="secondary-hero-kicker">常规命中</div>
      <div class="secondary-hero-main">${comparison.title}</div>
      <div class="secondary-hero-sub">${comparison.code}</div>
    `
    container.appendChild(secondary)
  }
}

/* ---- 渲染维度列表 ---- */

function renderDimensionList(container, items) {
  container.className = 'dimension-list'
  container.innerHTML = ''

  items.forEach((item) => {
    const row = document.createElement('div')
    row.className = 'dimension-row detail'
    const descriptionText = stripEndingPunctuation(item.description || item.explanation || '')
    const displayLabel = stripEndingPunctuation(item.summaryLabel || item.shortLabel || item.label || item.id || '')
    const displayLevel = stripEndingPunctuation(
      LEVEL_DISPLAY_LABELS[item.levelLabel || item.levelCode] || item.levelLabel || item.levelCode || '',
    )
    row.innerHTML = `
      <div class="dimension-row-head">
        <div>
          <div class="dimension-label">${displayLabel}</div>
        </div>
        <div class="dimension-score">${displayLevel}</div>
      </div>
      <div class="dimension-track">
        <div class="dimension-fill" data-pct="${item.percentage}" style="width: 0%; min-width: 6px"></div>
      </div>
      <div class="dimension-desc">${descriptionText}</div>
    `

    const desc = row.querySelector('.dimension-desc')
    if (desc) desc.hidden = !desc.textContent

    container.appendChild(row)
  })

  const fills = container.querySelectorAll('.dimension-fill')
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const fill = entry.target
          const pct = fill.dataset.pct || '0'
          const idx = Array.from(fills).indexOf(fill)
          window.setTimeout(() => {
            fill.style.width = `${pct}%`
          }, idx * 50)
          observer.unobserve(fill)
        }
      })
    },
    { threshold: 0.1 },
  )

  fills.forEach((fill) => observer.observe(fill))
}

/* ---- 渲染统计数据 ---- */

function renderStatsInline(container, items, { compact = false } = {}) {
  container.className = compact ? 'stats-inline stats-inline-compact' : 'stats-inline'
  container.innerHTML = ''

  items.forEach((item) => {
    const chip = document.createElement('div')
    chip.className = `stat-chip stat-chip-${item.tone || 'default'}`
    chip.innerHTML = `
      <span class="stat-label">${stripEndingPunctuation(item.label || '')}</span>
      <span class="stat-value">${item.value || ''}</span>
      ${item.note ? `<span class="stat-note">${item.note}</span>` : ''}
    `
    container.appendChild(chip)
  })
}

/* ---- 详情区模型 ---- */

function findSection(result, id) {
  return result.sections.find((section) => section.id === id) || null
}

function mergeDetailSections(result) {
  const reasons = findSection(result, 'reasons')?.items || []
  const scenes = findSection(result, 'scenes')?.items || []
  const mantras = findSection(result, 'mantras')?.items || []
  const tips = findSection(result, 'tips')?.items || []
  const dimensions = findSection(result, 'dimensions')

  const sections = []

  const insightItems = [...reasons, ...scenes]
  if (result.hero?.description || insightItems.length > 0) {
    sections.push({
      type: 'bullet-list',
      title: '结果解读',
      lead: result.hero?.description || '',
      items: insightItems,
    })
  }

  const habitItems = [...mantras, ...tips]
  if (habitItems.length > 0) {
    sections.push({
      type: 'bullet-list',
      title: '行为特征与提醒',
      lead: result.hero?.note || '',
      items: habitItems,
    })
  }

  if (dimensions?.items?.length) {
    sections.push({
      type: 'dimension-list',
      title: dimensions.title || '十五维度分布',
      items: dimensions.items,
    })
  }

  return sections
}

export function splitDetailSectionsForDisplay(sections, { priorityCount = DETAIL_PRIORITY_COUNT } = {}) {
  const normalizedSections = Array.isArray(sections) ? sections.filter(Boolean) : []
  return {
    prioritySections: normalizedSections.slice(0, Math.max(priorityCount, 0)),
    overflowSections: normalizedSections.slice(Math.max(priorityCount, 0)),
  }
}

/* ---- 创建 Section 外壳 ---- */

function createSectionShell(section, { priority = false } = {}) {
  const wrapper = document.createElement('section')
  wrapper.className = `result-section result-section-${section.type}`
  if (priority) {
    wrapper.classList.add('is-priority')
  }

  if (section.title) {
    const title = document.createElement('h3')
    title.className = 'section-title'
    title.textContent = stripEndingPunctuation(section.title)
    wrapper.appendChild(title)
  }

  if (section.lead) {
    const lead = document.createElement('p')
    lead.className = 'section-lead'
    lead.textContent = stripEndingPunctuation(section.lead)
    wrapper.appendChild(lead)
  }

  return wrapper
}

function renderSection(section, { priority = false } = {}) {
  const shell = createSectionShell(section, { priority })
  const container = document.createElement('div')

  if (section.type === 'bullet-list' && section.items?.length) {
    renderTextList(container, section.items || [])
  }

  if (section.type === 'dimension-list') {
    renderDimensionList(container, section.items || [])
  }

  shell.appendChild(container)
  return shell
}

function renderDetailSections(container, result) {
  container.innerHTML = ''
  const sections = mergeDetailSections(result)
  const { prioritySections, overflowSections } = splitDetailSectionsForDisplay(sections)

  prioritySections.forEach((section) => {
    container.appendChild(renderSection(section, { priority: true }))
  })

  if (overflowSections.length > 0) {
    const disclosure = document.createElement('details')
    disclosure.className = 'result-sections-more'

    const summary = document.createElement('summary')
    summary.className = 'result-sections-more-summary'
    summary.textContent = DEFAULT_DISCLOSURE_LABEL
    disclosure.appendChild(summary)

    const content = document.createElement('div')
    content.className = 'result-sections-more-content'
    overflowSections.forEach((section) => {
      content.appendChild(renderSection(section))
    })

    disclosure.appendChild(content)
    container.appendChild(disclosure)
  }
}

/* ---- 渲染分享卡片 ---- */

function renderShareCard(result, els, { shareConfig = {}, displayConfig = {} } = {}) {
  if (els.badge) {
    els.badge.textContent = stripEndingPunctuation(
      result?.share?.headerBadgeText
      || shareConfig.badgeText
      || displayConfig.shareBadgeText
      || '你的结果类型是',
    )
  }

  if (els.imageWrap) {
    renderHeroMedia(els.imageWrap, result.hero, { priority: 'high' })
  }

  if (els.summary) {
    renderHeroSummaryInCard(els.summary, result)
  }

  if (els.stats) {
    renderStatsInline(els.stats, getShareCardStats(result), { compact: true })
  }

  if (els.tags) {
    els.tags.innerHTML = ''
    const tags = getHighlightTags(result, 3)
    if (tags.length > 0) {
      const tagList = document.createElement('div')
      tagList.className = 'tag-list'
      renderTags(tagList, tags)
      els.tags.appendChild(tagList)
      els.tags.hidden = false
    } else {
      els.tags.hidden = true
    }
  }

  if (els.chartSection) {
    els.chartSection.hidden = true
  }
}

function isCompactViewport() {
  return window.matchMedia('(max-width: 430px)').matches
}

function setOptionalText(element, value) {
  if (!element) return

  const text = String(value ?? '').trim()
  element.textContent = text
  element.hidden = !text
}

function resolveActionLabel(value, fallback) {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function resolveInlineShareState({
  shareConfig = {},
  actionDefaults = DEFAULT_ACTION_COPY,
  inlineDefaults = DEFAULT_INLINE_SHARE_COPY,
} = {}) {
  const title = resolveActionLabel(shareConfig.inlinePromptTitle, inlineDefaults.title)
  const body = resolveActionLabel(shareConfig.inlinePromptBody, inlineDefaults.body)
  const primaryLabel = resolveActionLabel(
    shareConfig.inlinePrimaryActionLabel,
    resolveActionLabel(shareConfig.primaryActionLabel, inlineDefaults.primaryActionLabel),
  )

  return {
    title,
    body,
    primaryLabel,
    hidden: !title && !body && !primaryLabel && !actionDefaults.primaryActionLabel,
  }
}

export function resolveResultActionState({
  isActive = false,
  isCompactViewport = false,
  displayConfig = {},
  shareConfig = {},
  actionDefaults = DEFAULT_ACTION_COPY,
} = {}) {
  const collapsed = false
  const primaryLabel = shareConfig.primaryActionLabel != null
    ? resolveActionLabel(shareConfig.primaryActionLabel, actionDefaults.primaryActionLabel)
    : displayConfig.downloadButtonLabel != null
      ? resolveActionLabel(displayConfig.downloadButtonLabel, actionDefaults.primaryActionLabel)
      : actionDefaults.primaryActionLabel
  const secondaryLabel = shareConfig.secondaryActionLabel != null
    ? resolveActionLabel(shareConfig.secondaryActionLabel, actionDefaults.secondaryActionLabel)
    : isCompactViewport
      ? actionDefaults.secondaryActionLabel
      : '分享好友'
  const restartLabel = resolveActionLabel(displayConfig.restartButtonLabel, '重新测试')

  return {
    collapsed,
    primaryIntent: 'download',
    primaryLabel,
    primaryAriaLabel: primaryLabel,
    secondaryLabel,
    restartLabel,
    nudgeActive: false,
  }
}

/* ---- 主结果视图 ---- */

export function createResultView({ onRestart, onDownload }) {
  const actionDefaults = DEFAULT_ACTION_COPY

  let currentResult = null
  let displayConfig = {}
  let shareConfig = {}
  let isActive = false

  const els = {
    actions: document.getElementById('result-actions'),
    actionsCopy: document.getElementById('result-actions-copy'),
    actionsTitle: document.getElementById('result-actions-title'),
    actionsBody: document.getElementById('result-actions-body'),
    badge: document.getElementById('share-card-badge'),
    shareCard: document.getElementById('result-share-card'),
    imageWrap: document.getElementById('result-hero-image-wrap'),
    summary: document.getElementById('result-hero-summary'),
    stats: document.getElementById('result-key-stats'),
    inlineShare: document.getElementById('result-inline-share'),
    inlineShareTitle: document.getElementById('result-inline-share-title'),
    inlineShareBody: document.getElementById('result-inline-share-body'),
    inlineDownload: document.getElementById('btn-inline-download'),
    tags: document.getElementById('result-tags-section'),
    chartSection: document.getElementById('result-chart-section'),
    detailSections: document.getElementById('result-detail-sections'),
    qrLabel: document.querySelector('.qr-label'),
    watermark: document.querySelector('.share-card-watermark'),
    download: document.getElementById('btn-download'),
    share: document.getElementById('btn-share'),
    restart: document.getElementById('btn-restart'),
  }

  function updateActionCopy() {
    setOptionalText(
      els.actionsTitle,
      shareConfig.promptTitle ?? actionDefaults.promptTitle,
    )
    setOptionalText(
      els.actionsBody,
      shareConfig.promptBody ?? actionDefaults.promptBody,
    )

    if (els.actionsCopy) {
      const titleHidden = !els.actionsTitle || els.actionsTitle.hidden
      const bodyHidden = !els.actionsBody || els.actionsBody.hidden
      els.actionsCopy.hidden = titleHidden && bodyHidden
    }
  }

  function updateInlineSharePrompt() {
    const inlineShareState = resolveInlineShareState({
      shareConfig,
      actionDefaults,
    })

    setOptionalText(els.inlineShareTitle, inlineShareState.title)
    setOptionalText(els.inlineShareBody, inlineShareState.body)

    if (els.inlineDownload) {
      const textEl = els.inlineDownload.querySelector('span:last-child')
      const label = inlineShareState.primaryLabel
      if (textEl) textEl.textContent = label
      else els.inlineDownload.textContent = label
      els.inlineDownload.setAttribute('aria-label', label)
    }

    if (els.inlineShare) {
      const titleHidden = !els.inlineShareTitle || els.inlineShareTitle.hidden
      const bodyHidden = !els.inlineShareBody || els.inlineShareBody.hidden
      els.inlineShare.hidden = inlineShareState.hidden || (titleHidden && bodyHidden)
    }

    if (els.qrLabel) {
      els.qrLabel.textContent = stripEndingPunctuation(shareConfig.qrLabel || '扫码测测你是什么型')
    }

    if (els.watermark) {
      els.watermark.textContent = stripEndingPunctuation(shareConfig.footer || shareConfig.title || '')
    }
  }

  function applyActionState() {
    const actionState = resolveResultActionState({
      isActive,
      isCompactViewport: isCompactViewport(),
      displayConfig,
      shareConfig,
      actionDefaults,
    })
    const { collapsed } = actionState

    if (els.actions) {
      els.actions.classList.toggle('is-collapsed', collapsed)
      els.actions.classList.toggle('is-expanded', !collapsed)
      els.actions.classList.toggle('is-nudged', actionState.nudgeActive)
      els.actions.dataset.state = collapsed ? 'collapsed' : 'expanded'
      els.actions.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    }

    if (els.download) {
      const textEl = els.download.querySelector('span:last-child')
      const label = actionState.primaryLabel
      if (textEl) textEl.textContent = label
      else els.download.textContent = label
      els.download.setAttribute('aria-label', actionState.primaryAriaLabel)
    }

    if (els.share) {
      const textEl = els.share.querySelector('span:last-child')
      const label = actionState.secondaryLabel
      if (textEl) textEl.textContent = label
      else els.share.textContent = label
    }

    if (els.restart) {
      const textEl = els.restart.querySelector('span:last-child')
      const label = actionState.restartLabel
      if (textEl) textEl.textContent = label
      else els.restart.textContent = label
    }
  }

  function handleViewportChange() {
    applyActionState()
  }

  function updateActionLabels() {
    updateActionCopy()
    updateInlineSharePrompt()
    applyActionState()
  }

  if (els.download) {
    els.download.addEventListener('click', () => {
      if (!currentResult) return
      onDownload(els.download)
    })
  }

  if (els.inlineDownload) {
    els.inlineDownload.addEventListener('click', () => {
      if (!currentResult) return
      onDownload(els.inlineDownload)
    })
  }

  if (els.restart) {
    els.restart.addEventListener('click', () => {
      onRestart()
    })
  }

  window.addEventListener('resize', handleViewportChange)

  function configure({ display = {}, share = {} } = {}) {
    displayConfig = display
    shareConfig = share
    updateActionLabels()
  }

  function render(result) {
    currentResult = result

    renderShareCard(result, els, { shareConfig, displayConfig })

    if (els.detailSections) {
      renderDetailSections(els.detailSections, result)
    }

    updateActionLabels()
  }

  function setActive(nextActive) {
    isActive = Boolean(nextActive)
    applyActionState()
  }

  return { configure, render, setActive }
}
