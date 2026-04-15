import { getCachedImage, preloadImage } from './image-cache.js'
import {
  getComparisonHero,
  getHighlightTags,
  getShareCardStats,
} from './result-highlights.js'
import { formatCode } from './utils.js'

/* ---- 工具函数 ---- */

function setText(element, value) {
  if (!element) return
  element.textContent = value || ''
  element.hidden = !value
}

function renderTextList(container, values) {
  const list = document.createElement('ul')
  list.className = 'bullet-list'

  values.forEach((value) => {
    const row = document.createElement('li')
    row.textContent = value.text
    list.appendChild(row)
  })

  container.appendChild(list)
}

function renderTags(container, values) {
  container.innerHTML = ''
  values.forEach((value) => {
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = value
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

  const titleEl = document.createElement('div')
  titleEl.className = 'hero-summary-title'
  titleEl.textContent = hero.title || ''
  container.appendChild(titleEl)

  const codeEl = document.createElement('div')
  codeEl.className = 'hero-summary-code'
  codeEl.textContent = formatCode(hero.code)
  container.appendChild(codeEl)

  if (hero.badge) {
    const leadEl = document.createElement('div')
    leadEl.className = 'hero-summary-lead'
    leadEl.textContent = hero.badge
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
    row.innerHTML = `
      <div class="dimension-row-head">
        <div>
          <div class="dimension-label">${item.label}</div>
          <div class="dimension-meta">${[item.model, item.levelLabel || item.levelCode].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="dimension-score">${item.levelCode} / ${item.score}</div>
      </div>
      <div class="dimension-track">
        <div class="dimension-fill" data-pct="${item.percentage}" style="width: 0%"></div>
      </div>
      <div class="dimension-desc">${item.description || item.explanation || ''}</div>
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
      <span class="stat-label">${item.label || ''}</span>
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
      title: '人格解读',
      lead: result.hero?.description || '',
      items: insightItems,
    })
  }

  const habitItems = [...mantras, ...tips]
  if (habitItems.length > 0) {
    sections.push({
      type: 'bullet-list',
      title: '交易习惯与提醒',
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

/* ---- 创建 Section 外壳 ---- */

function createSectionShell(section) {
  const wrapper = document.createElement('section')
  wrapper.className = `result-section result-section-${section.type}`

  if (section.title) {
    const title = document.createElement('h3')
    title.className = 'section-title'
    title.textContent = section.title
    wrapper.appendChild(title)
  }

  if (section.lead) {
    const lead = document.createElement('p')
    lead.className = 'section-lead'
    lead.textContent = section.lead
    wrapper.appendChild(lead)
  }

  return wrapper
}

function renderSection(section) {
  const shell = createSectionShell(section)
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
  sections.forEach((section) => container.appendChild(renderSection(section)))
}

/* ---- 渲染分享卡片 ---- */

function renderShareCard(result, els) {
  if (els.badge) {
    els.badge.textContent = '你的人格类型是：'
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

/* ---- 主结果视图 ---- */

export function createResultView({ onRestart, onDownload }) {
  let currentResult = null
  let displayConfig = {}

  const els = {
    badge: document.getElementById('share-card-badge'),
    imageWrap: document.getElementById('result-hero-image-wrap'),
    summary: document.getElementById('result-hero-summary'),
    stats: document.getElementById('result-key-stats'),
    tags: document.getElementById('result-tags-section'),
    chartSection: document.getElementById('result-chart-section'),
    detailSections: document.getElementById('result-detail-sections'),
    download: document.getElementById('btn-download'),
    share: document.getElementById('btn-share'),
    restart: document.getElementById('btn-restart'),
  }

  function updateActionLabels() {
    const compact = isCompactViewport()

    if (els.download) {
      const textEl = els.download.querySelector('span:last-child')
      const label = compact
        ? '保存海报'
        : (displayConfig.downloadButtonLabel || '保存结果图片')
      if (textEl) textEl.textContent = label
      else els.download.textContent = label
    }

    if (els.share) {
      const textEl = els.share.querySelector('span:last-child')
      const label = compact ? '分享链接' : '分享好友'
      if (textEl) textEl.textContent = label
      else els.share.textContent = label
    }

    if (els.restart) {
      const textEl = els.restart.querySelector('span:last-child')
      const label = compact ? '再测一次' : (displayConfig.restartButtonLabel || '再测一次')
      if (textEl) textEl.textContent = label
      else els.restart.textContent = label
    }
  }

  if (els.download) {
    els.download.addEventListener('click', () => {
      if (!currentResult) return
      onDownload(els.download)
    })
  }

  if (els.restart) {
    els.restart.addEventListener('click', () => {
      onRestart()
    })
  }

  window.addEventListener('resize', updateActionLabels)

  function configure(display = {}) {
    displayConfig = display
    updateActionLabels()
  }

  function render(result) {
    currentResult = result

    renderShareCard(result, els)

    if (els.detailSections) {
      renderDetailSections(els.detailSections, result)
    }

    updateActionLabels()
  }

  return { configure, render }
}
