import { formatCode, groupAdjacentBy } from './utils.js'

/* ---- 工具函数 ---- */

function setText(element, value) {
  if (!element) return
  element.textContent = value || ''
  element.hidden = !value
}

function renderTextList(container, values) {
  container.innerHTML = ''
  values.forEach((value) => {
    const row = document.createElement('li')
    row.textContent = value.text
    container.appendChild(row)
  })
}

function renderTags(container, values) {
  container.innerHTML = ''
  values.forEach((value) => {
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = value.text
    container.appendChild(tag)
  })
}

function getHeroPalette(hero) {
  return {
    accent: hero.art?.accent ?? '#8B5CF6',
    surface: hero.art?.shirt ?? 'rgba(139, 92, 246, 0.2)',
    shadow: hero.art?.pants ?? '#7C3AED',
    ink: hero.art?.hair ?? '#F8FAFC',
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

/* ---- 渲染英雄图片区域 ---- */

function renderHeroMedia(container, hero) {
  container.innerHTML = ''

  if (hero.image) {
    const image = document.createElement('img')
    image.className = 'hero-image'
    image.src = hero.image
    image.alt = hero.title || hero.code
    image.loading = 'eager'
    container.appendChild(image)
    return
  }

  container.appendChild(createHeroArtCard(hero))
}

/* ---- 渲染英雄摘要（分享卡片内） ---- */

function renderHeroSummaryInCard(container, content) {
  const hero = content.hero || {}
  const secondaryHero = content.secondaryHero
  const badges = [content.shareBadgeText, hero.rarity].filter(Boolean)

  container.innerHTML = ''

  const titleEl = document.createElement('div')
  titleEl.className = 'hero-summary-title'
  titleEl.textContent = hero.title || ''
  container.appendChild(titleEl)

  const codeEl = document.createElement('div')
  codeEl.className = 'hero-summary-code'
  codeEl.textContent = formatCode(hero.code)
  container.appendChild(codeEl)

  if (hero.sub || hero.subtitle) {
    const subEl = document.createElement('div')
    subEl.className = 'hero-summary-sub'
    subEl.textContent = hero.sub || hero.subtitle
    container.appendChild(subEl)
  }

  if (badges.length > 0) {
    const badgesEl = document.createElement('div')
    badgesEl.className = 'hero-summary-badges'
    badges.forEach((text) => {
      const chip = document.createElement('span')
      chip.className = 'hero-chip'
      chip.textContent = text
      badgesEl.appendChild(chip)
    })

    if (content.specialState?.active && content.specialState.reason !== 'normal') {
      const chip = document.createElement('span')
      chip.className = 'hero-chip is-special'
      chip.textContent = content.specialState.reason === 'fallback' ? '特殊兜底结果' : '隐藏人格结果'
      badgesEl.appendChild(chip)
    }

    container.appendChild(badgesEl)
  }

  if (hero.badge) {
    const leadEl = document.createElement('div')
    leadEl.className = 'hero-summary-lead'
    leadEl.textContent = hero.badge
    container.appendChild(leadEl)
  }

  if (hero.description) {
    const descEl = document.createElement('div')
    descEl.className = 'hero-summary-desc'
    descEl.textContent = hero.description
    container.appendChild(descEl)
  }

  if (secondaryHero) {
    const secondary = document.createElement('div')
    secondary.className = 'secondary-hero'
    secondary.innerHTML = `
      <div class="secondary-hero-kicker">常规命中类型</div>
      <div class="secondary-hero-main">${secondaryHero.title}</div>
      <div class="secondary-hero-sub">${formatCode(secondaryHero.code)}</div>
    `
    container.appendChild(secondary)
  }
}

/* ---- 渲染维度图表（带动画） ---- */

function renderDimensionChart(container, items) {
  container.innerHTML = ''

  items.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'dimension-row'

    row.innerHTML = `
      <div class="dimension-row-head">
        <div class="dimension-label">${item.label}</div>
        <div class="dimension-score">${item.levelCode}</div>
      </div>
      <div class="dimension-track">
        <div class="dimension-fill" data-pct="${item.percentage}" style="width: 0%"></div>
      </div>
    `

    container.appendChild(row)
  })

  // 使用 IntersectionObserver 触发动画（进入视口时）
  const fills = container.querySelectorAll('.dimension-fill')
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const fill = entry.target
          const pct = fill.dataset.pct || '0'
          // 交错动画
          const index = Array.from(fills).indexOf(fill)
          setTimeout(() => {
            fill.style.width = `${pct}%`
          }, index * 40)
          observer.unobserve(fill)
        }
      })
    },
    { threshold: 0.1 },
  )

  fills.forEach((fill) => observer.observe(fill))
}

/* ---- 渲染详细维度列表 ---- */

function renderDimensionList(container, items) {
  container.className = 'dimension-list'
  container.innerHTML = ''

  items.forEach((item, index) => {
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

  // 动画
  const fills = container.querySelectorAll('.dimension-fill')
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const fill = entry.target
          const pct = fill.dataset.pct || '0'
          const idx = Array.from(fills).indexOf(fill)
          setTimeout(() => {
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

function renderStatsInline(container, items) {
  container.className = 'stats-inline'
  container.innerHTML = ''

  items.forEach((item) => {
    const chip = document.createElement('div')
    chip.className = `stat-chip stat-chip-${item.tone || 'default'}`
    chip.innerHTML = `
      <span class="stat-label">${item.label || ''}</span>
      <span class="stat-value">${item.value || ''}</span>
    `
    container.appendChild(chip)
  })
}

/* ---- Section 渲染器映射 ---- */

const SECTION_RENDERERS = {
  'tag-list': (container, section) => {
    container.className = 'tag-list'
    renderTags(container, section.items || [])
  },
  'bullet-list': (container, section) => {
    container.className = 'bullet-list'
    renderTextList(container, section.items || [])
  },
  'hero-summary': (container, section) => {
    renderHeroSummaryInCard(container, section.content || {})
  },
  'image-panel': (container, section) => {
    container.className = 'image-panel'
    renderHeroMedia(container, (section.content || {}).hero || {})
  },
  'stats-inline': (container, section) => {
    renderStatsInline(container, section.items || [])
  },
  'dimension-list': (container, section) => {
    renderDimensionList(container, section.items || [])
  },
}

/* ---- 创建 Section 外壳 ---- */

function createSectionShell(section) {
  const wrapper = document.createElement('section')
  wrapper.className = `result-section result-section-${section.type}${section.card ? ' info-card' : ''}`

  if (section.title) {
    const title = document.createElement('h3')
    title.className = 'section-title'
    title.textContent = section.title
    wrapper.appendChild(title)
  }

  return wrapper
}

function renderSection(section) {
  const shell = createSectionShell(section)
  const container = document.createElement('div')
  const renderer = SECTION_RENDERERS[section.type]

  if (renderer) {
    renderer(container, section)
  }

  shell.appendChild(container)
  return shell
}

function renderDetailSections(container, sections) {
  container.innerHTML = ''

  const groups = groupAdjacentBy(sections, (section) => section.group || `__${section.id}`)

  groups.forEach((group) => {
    if (group.key.startsWith('__') || group.items.length === 1) {
      group.items.forEach((section) => container.appendChild(renderSection(section)))
      return
    }

    const grid = document.createElement('div')
    grid.className = 'result-grid'
    group.items.forEach((section) => {
      grid.appendChild(renderSection(section))
    })
    container.appendChild(grid)
  })
}

/* ---- 渲染分享卡片（精美卡片区域） ---- */

function renderShareCard(result) {
  const { hero, sections } = result

  const badge = document.getElementById('share-card-badge')
  if (badge) {
    badge.textContent = '你的人格类型是：'
  }

  const imageWrap = document.getElementById('result-hero-image-wrap')
  if (imageWrap) {
    renderHeroMedia(imageWrap, hero)
  }

  const summaryEl = document.getElementById('result-hero-summary')
  if (summaryEl) {
    const heroSummarySection = sections.find((s) => s.type === 'hero-summary')
    if (heroSummarySection) {
      renderHeroSummaryInCard(summaryEl, heroSummarySection.content || {})
    }
  }

  const tagsSection = document.getElementById('result-tags-section')
  if (tagsSection) {
    tagsSection.innerHTML = ''
    const tagListSection = sections.find((s) => s.type === 'tag-list')
    if (tagListSection && tagListSection.items?.length > 0) {
      const tagList = document.createElement('div')
      tagList.className = 'tag-list'
      renderTags(tagList, tagListSection.items)
      tagsSection.appendChild(tagList)
      tagsSection.hidden = false
    } else {
      tagsSection.hidden = true
    }
  }

  const chartSection = document.getElementById('result-chart-section')
  if (chartSection) {
    chartSection.hidden = true
  }
}

/* ---- 主结果视图 ---- */

export function createResultView({ onRestart, onDownload }) {
  let currentResult = null
  let displayConfig = {}

  const els = {
    shareCard: document.getElementById('result-share-card'),
    detailSections: document.getElementById('result-detail-sections'),
    disclaimer: document.getElementById('disclaimer'),
    download: document.getElementById('btn-download'),
    restart: document.getElementById('btn-restart'),
  }

  // 绑定按钮事件
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

  function configure(display = {}) {
    displayConfig = display

    if (els.download) {
      const textEl = els.download.querySelector('span:last-child')
      const label = display.downloadButtonLabel || '保存结果图片'
      if (textEl) textEl.textContent = label
      else els.download.textContent = label
    }

    if (els.restart) {
      const textEl = els.restart.querySelector('span:last-child')
      const label = display.restartButtonLabel || '再测一次'
      if (textEl) textEl.textContent = label
      else els.restart.textContent = label
    }
  }

  function render(result) {
    currentResult = result

    // 渲染精美分享卡片
    renderShareCard(result)

    // 渲染详细内容区域（卡片下方）
    if (els.detailSections) {
      // 在浅色主题下，展示除 hero-summary 和 image-panel 外的所有 section
      const detailSections = result.sections.filter((s) =>
        !['hero-summary', 'image-panel'].includes(s.type),
      )
      renderDetailSections(els.detailSections, detailSections)
    }

    // 免责声明
    if (els.disclaimer) {
      setText(els.disclaimer, result.disclaimer)
    }

    // Entry animation is handled by CSS (resultCardEnter keyframes)
  }

  return { configure, render }
}
