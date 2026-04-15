import { createQuizView } from './quiz.js'
import { preloadImageWithTimeout, preloadImages } from './image-cache.js'
import { createNoopResultReporter } from './reporters/index.js'
import { createResultView } from './result.js'
import { createScorerRegistry } from './scorers/index.js'
import { createLocalTestPackSource } from './test-pack/source.js'

/* ---- 工具函数 ---- */

function setText(element, value) {
  if (!element) return
  element.textContent = value || ''
  element.hidden = !value
}

function buildStatsLine(pack) {
  return `${pack.questions.length} 道维度题 · ${pack.outcomes.length} 种人格结果 · 即测即出结果`
}

function buildDurationLabel(pack) {
  const minutes = Math.max(3, Math.round(pack.questions.length / 10))
  return `预计 ${minutes}-${minutes + 1} 分钟`
}

function resolveLinkShareCTA(pack) {
  const custom = pack?.shareConfig?.linkCopyText
  if (typeof custom === 'string' && custom.trim()) {
    return custom.trim()
  }
  return '来测测你的人格类型'
}

function buildLinkShareText(pack, url) {
  return `${resolveLinkShareCTA(pack)}：${url}`
}

function clearContainer(element) {
  if (!element) return
  element.innerHTML = ''
}

function scheduleIdle(callback, timeout = 900) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout })
    return
  }

  window.setTimeout(callback, 180)
}

/* ---- Toast 提示 ---- */

let toastTimer = null

function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast')
  if (!toast) return

  toast.textContent = message
  toast.classList.add('show')

  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.classList.remove('show')
  }, duration)
}

/* ---- Confetti 庆祝动画 ---- */

function triggerConfetti() {
  const container = document.getElementById('confetti-container')
  if (!container) return

  const colors = [
    '#8B5CF6', '#A78BFA', '#EC4899', '#F472B6',
    '#60A5FA', '#34D399', '#FBBF24', '#F87171',
  ]

  const count = 60

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div')
    piece.className = 'confetti-piece'

    const size = 4 + Math.random() * 8
    const color = colors[Math.floor(Math.random() * colors.length)]
    const left = Math.random() * 100
    const delay = Math.random() * 0.8
    const duration = 1.2 + Math.random() * 1.2
    const isCircle = Math.random() > 0.5

    piece.style.cssText = `
      left: ${left}%;
      width: ${size}px;
      height: ${isCircle ? size : size * 0.4}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      animation-delay: ${delay}s;
      animation-duration: ${duration}s;
    `

    container.appendChild(piece)

    // 动画结束后清理
    setTimeout(() => {
      piece.remove()
    }, (delay + duration + 0.2) * 1000)
  }
}

/* ---- Loading 动画控制 ---- */

const LOADING_MESSAGES = [
  '正在分析你的性格特征...',
  '正在匹配交易人格类型...',
  '正在计算维度分布...',
  '即将揭晓你的专属结果...',
]

let loadingTimer = null
let loadingMessageTimer = null

function startLoadingAnimation() {
  const progressFill = document.getElementById('loading-progress-fill')
  const messages = document.querySelectorAll('.loading-message')

  // 重置
  if (progressFill) progressFill.style.width = '0%'
  messages.forEach((msg) => msg.classList.remove('active'))

  let messageIndex = 0
  let progress = 0

  // 显示第一条消息
  if (messages[0]) messages[0].classList.add('active')

  // 进度条动画
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + 2, 95)
    if (progressFill) progressFill.style.width = `${progress}%`
  }, 50)

  // 消息轮换
  loadingMessageTimer = setInterval(() => {
    if (messages[messageIndex]) messages[messageIndex].classList.remove('active')
    messageIndex = (messageIndex + 1) % messages.length
    if (messages[messageIndex]) messages[messageIndex].classList.add('active')
  }, 700)

  return () => {
    clearInterval(progressInterval)
    clearInterval(loadingMessageTimer)
    if (progressFill) progressFill.style.width = '100%'
  }
}

function stopLoadingAnimation(stopFn) {
  if (stopFn) stopFn()
  if (loadingMessageTimer) clearInterval(loadingMessageTimer)
}

/* ---- 首页内容渲染 ---- */

function renderTrustBadges(container, values = []) {
  clearContainer(container)

  values.forEach((value) => {
    const badge = document.createElement('span')
    badge.className = 'trust-pill'
    badge.textContent = value
    container.appendChild(badge)
  })

  container.hidden = values.length === 0
}

function renderFactCards(container, pack, display = {}) {
  clearContainer(container)

  const items = [
    {
      value: `${pack.questions.length}`,
      label: '常规题目',
      note: '围绕真实场景设计，回答起来更容易进入状态。',
    },
    {
      value: `${pack.dimensions?.order?.length ?? 0}`,
      label: '维度模型',
      note: '从多个维度看你的倾向，结果会更立体。',
    },
    {
      value: display.estimatedDurationLabel || buildDurationLabel(pack),
      label: '出结果时间',
      note: '完成后可立即查看结果。',
    },
  ]

  items.forEach((item) => {
    const card = document.createElement('article')
    card.className = 'info-card fact-card'
    card.innerHTML = `
      <div class="fact-value">${item.value}</div>
      <div class="fact-label">${item.label}</div>
      <div class="fact-note">${item.note}</div>
    `
    container.appendChild(card)
  })

  container.hidden = items.length === 0
}

function renderBenefits(container, items = []) {
  clearContainer(container)

  items.forEach((item, index) => {
    const card = document.createElement('article')
    card.className = 'info-card benefit-card'
    card.innerHTML = `
      <div class="benefit-index">${String(index + 1).padStart(2, '0')}</div>
      <div class="benefit-title">${item.title}</div>
      <div class="benefit-text">${item.text}</div>
    `
    container.appendChild(card)
  })

  container.hidden = items.length === 0
}

function renderSpotlight(container, pack, codes = []) {
  clearContainer(container)

  const items = codes
    .map((code) => pack.outcomes.find((outcome) => outcome.code === code))
    .filter(Boolean)
    .slice(0, 3)

  items.forEach((outcome) => {
    const card = document.createElement('article')
    card.className = 'info-card spotlight-card'

    const imageHtml = outcome.image
      ? `<img class="spotlight-image" src="${outcome.image}" alt="${outcome.alias || outcome.code}" loading="lazy" decoding="async" fetchpriority="low" />`
      : `<div class="spotlight-placeholder">${outcome.code}</div>`

    card.innerHTML = `
      <div class="spotlight-image-wrap">${imageHtml}</div>
      <div class="spotlight-kicker">示例结果</div>
      <div class="spotlight-title">${outcome.alias || outcome.code}</div>
      <div class="spotlight-code">${outcome.code}</div>
      <div class="spotlight-copy">${outcome.badge || outcome.brief || ''}</div>
    `
    container.appendChild(card)
  })

  container.hidden = items.length === 0
}

/* ---- 主控制器 ---- */

export function createAppController({
  packSource = createLocalTestPackSource(),
  scorerRegistry = createScorerRegistry(),
  resultReporter = createNoopResultReporter(),
} = {}) {
  const pages = {
    intro: document.getElementById('page-intro'),
    quiz: document.getElementById('page-quiz'),
    loading: document.getElementById('page-loading'),
    result: document.getElementById('page-result'),
  }

  const els = {
    introEyebrow: document.getElementById('intro-eyebrow'),
    introTitle: document.getElementById('intro-title'),
    introSubtitle: document.getElementById('intro-subtitle'),
    introStatsLine: document.getElementById('intro-stats-line'),
    introSecondaryNote: document.getElementById('intro-secondary-note'),
    introTrust: document.getElementById('intro-trust'),
    introFacts: document.getElementById('intro-facts'),
    introBenefits: document.getElementById('intro-benefits'),
    introSpotlight: document.getElementById('intro-spotlight'),
    introSpotlightSection: document.getElementById('intro-spotlight-section'),
    introNote: document.getElementById('intro-note'),
    startButton: document.getElementById('btn-start'),
    shareButton: document.getElementById('btn-share'),
    descriptionMeta: document.querySelector('meta[name="description"]'),
    ogTitle: document.querySelector('meta[property="og:title"]'),
    ogDescription: document.querySelector('meta[property="og:description"]'),
  }

  let activeManifest = null
  let activePack = null
  let activePackPromise = null
  let latestResult = null
  let stopLoadingFn = null

  const quizView = createQuizView({
    onComplete: handleQuizComplete,
  })

  const resultView = createResultView({
    onRestart: handleRestart,
    onDownload: handleDownload,
  })

  /* ---- 页面切换 ---- */

  function showPage(name) {
    Object.values(pages).forEach((page) => {
      if (!page) return
      page.classList.remove('active')
    })

    const target = pages[name]
    if (!target) return

    target.classList.add('active')
    document.body.dataset.page = name
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* ---- 按钮状态 ---- */

  function setStartButtonState({ disabled, label }) {
    if (!els.startButton) return
    els.startButton.disabled = disabled
    if (label) {
      const textEl = els.startButton.querySelector('.btn-text')
      if (textEl) {
        textEl.textContent = label
      } else {
        els.startButton.textContent = label
      }
    }
  }

  /* ---- 首页内容 ---- */

  function renderIntroDisplay(display = {}) {
    setText(els.introEyebrow, display.introEyebrow || '')
    setText(els.introTitle, display.introTitle || activeManifest?.meta?.browserTitle || '')
    setText(els.introSubtitle, display.subtitle || '')
    setText(els.introStatsLine, display.statsLine || '')
    setText(els.introSecondaryNote, display.secondaryNote || '')
    setText(els.introNote, display.disclaimer || '')
    renderTrustBadges(els.introTrust, display.trustBadges || [])
    renderBenefits(els.introBenefits, display.benefits || [])
  }

  function applyManifest(manifest) {
    activeManifest = manifest
    const display = manifest.display || {}

    // 更新页面标题和 meta
    document.title = manifest.meta?.browserTitle || '人格测试'
    const desc = manifest.meta?.description || display.subtitle || ''
    if (els.descriptionMeta) els.descriptionMeta.setAttribute('content', desc)
    if (els.ogTitle) els.ogTitle.setAttribute('content', manifest.meta?.browserTitle || '人格测试')
    if (els.ogDescription) els.ogDescription.setAttribute('content', desc)

    renderIntroDisplay(display)

    setStartButtonState({
      disabled: false,
      label: display.startButtonLabel || '开始测试',
    })
    resultView.configure(display)
  }

  function applyPackDetails(pack) {
    const display = pack.display || {}

    setText(els.introStatsLine, display.statsLine || buildStatsLine(pack))
    setText(
      els.introSecondaryNote,
      display.secondaryNote || '打开即可开始，答完就能看到结果。',
    )
    renderFactCards(els.introFacts, pack, display)
    renderBenefits(els.introBenefits, display.benefits || [])

    const spotlightCodes = display.spotlightCodes || []
    renderSpotlight(els.introSpotlight, pack, spotlightCodes)
    if (els.introSpotlightSection) {
      els.introSpotlightSection.hidden = spotlightCodes.length === 0
    }

    const spotlightImages = spotlightCodes
      .map((code) => pack.outcomes.find((outcome) => outcome.code === code)?.image)
      .filter(Boolean)

    if (spotlightImages.length > 0) {
      scheduleIdle(() => {
        void preloadImages(spotlightImages, {
          fetchPriority: 'low',
          decoding: 'async',
        })
      })
    }
  }

  function showLoadError(error) {
    console.error(error)
    if (els.introSubtitle) {
      els.introSubtitle.textContent = '测试资源加载失败，请刷新页面后重试。'
    }
    renderFactCards(els.introFacts, { questions: [], dimensions: { order: [] } }, {})
    renderBenefits(els.introBenefits, [])
    renderSpotlight(els.introSpotlight, { outcomes: [] }, [])
    setStartButtonState({
      disabled: true,
      label: '暂时不可用',
    })
    showPage('intro')
  }

  /* ---- 数据加载 ---- */

  async function ensurePackLoaded() {
    if (!activePackPromise) {
      activePackPromise = packSource.warmActivePack().then((pack) => {
        activePack = pack
        applyPackDetails(pack)
        return pack
      })
    }

    activePack = await activePackPromise
    return activePack
  }

  /* ---- 事件处理 ---- */

  async function handleStart() {
    const idleLabel = activeManifest?.display?.startButtonLabel || '开始测试'
    let failed = false

    setStartButtonState({ disabled: true, label: '加载中...' })

    try {
      const pack = await ensurePackLoaded()
      quizView.start(pack)
      showPage('quiz')
    } catch (error) {
      failed = true
      showLoadError(error)
    } finally {
      if (!failed) {
        setStartButtonState({ disabled: false, label: idleLabel })
      }
    }
  }

  async function handleQuizComplete({ answers, flowState }) {
    // 1. 显示 loading 页面
    showPage('loading')
    stopLoadingFn = startLoadingAnimation()

    try {
      const pack = await ensurePackLoaded()
      const scorer = scorerRegistry.get(pack.scorerId)

      latestResult = scorer.score({ answers, pack, flowState })
      const heroImageReady = latestResult?.hero?.image
        ? preloadImageWithTimeout(latestResult.hero.image, 400, {
          fetchPriority: 'high',
          decoding: 'async',
        }).catch(() => null)
        : Promise.resolve(null)

      // 2. 等待 loading 动画至少播放 2.5 秒（营造期待感）
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await heroImageReady

      resultView.render(latestResult, pack)
      stopLoadingAnimation(stopLoadingFn)
      showPage('result')

      renderPageQR()

      setTimeout(triggerConfetti, 300)

      // 5. 上报结果（静默失败）
      void resultReporter.reportResult({ pack, result: latestResult }).catch((error) => {
        console.warn('Failed to report result:', error)
      })
    } catch (error) {
      console.error('Score error:', error)
      stopLoadingAnimation(stopLoadingFn)
      showLoadError(error)
    }
  }

  async function handleDownload(button) {
    if (!latestResult || !activePack) return

    const defaultLabel = activePack.display?.downloadButtonLabel || '保存结果图片'
    button.disabled = true
    const textEl = button.querySelector('span:last-child') || button
    const originalText = textEl.textContent
    textEl.textContent = '生成中...'

    try {
      const { generateShareImage } = await import('./share.js')
      const dataUrl = await generateShareImage(latestResult)
      
      // 在开发模式下，直接在页面上展示生成的截图
      if (import.meta.env.DEV) {
        let previewContainer = document.getElementById('dev-preview-container')
        if (!previewContainer) {
          previewContainer = document.createElement('div')
          previewContainer.id = 'dev-preview-container'
          previewContainer.style.cssText = `
            margin-top: 20px;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 12px;
            text-align: center;
          `
          const title = document.createElement('h3')
          title.textContent = '【Dev 模式】分享截图预览'
          title.style.marginBottom = '10px'
          title.style.color = '#333'
          previewContainer.appendChild(title)
          
          const img = document.createElement('img')
          img.id = 'dev-preview-image'
          img.style.maxWidth = '100%'
          img.style.borderRadius = '8px'
          img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
          previewContainer.appendChild(img)
          
          const resultWrapper = document.querySelector('.result-wrapper')
          if (resultWrapper) {
            resultWrapper.appendChild(previewContainer)
          }
        }
        
        const img = document.getElementById('dev-preview-image')
        if (img) {
          img.src = dataUrl
          // 滚动到底部以便查看
          setTimeout(() => {
            previewContainer.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
        showToast('截图已生成（Dev 预览模式）')
      } else {
        showToast('图片已保存到相册 🎉')
      }
    } catch (error) {
      console.error('Download error:', error)
      showToast('保存失败，请截图保存')
    } finally {
      button.disabled = false
      textEl.textContent = originalText || defaultLabel
    }
  }

  function handleRestart() {
    if (!activePack) return
    quizView.start(activePack)
    showPage('quiz')
  }

  /* ---- 页面内二维码 ---- */

  async function renderPageQR() {
    const container = document.getElementById('qr-placeholder')
    const fallbackIcon = document.getElementById('qr-icon-fallback')
    if (!container) return

    try {
      const QRCode = (await import('qrcode')).default
      const qrUrl = window.location.href.split('?')[0]
      const qrCanvas = await QRCode.toCanvas(qrUrl, {
        width: 88,
        margin: 1,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      })
      container.innerHTML = ''
      if (fallbackIcon) fallbackIcon.remove()
      container.appendChild(qrCanvas)
    } catch (err) {
      console.warn('QR render failed:', err)
    }
  }

  /* ---- 分享按钮 ---- */

  function setupShareButton() {
    if (!els.shareButton) return

    els.shareButton.addEventListener('click', () => {
      const url = window.location.href
      const title = activeManifest?.meta?.browserTitle || 'GBTI 股民人格测试'
      const shareCTA = resolveLinkShareCTA(activePack)
      const copyText = buildLinkShareText(activePack, url)

      if (navigator.share) {
        navigator.share({ title, text: shareCTA, url }).catch(() => {})
        return
      }

      if (navigator.clipboard) {
        navigator.clipboard.writeText(copyText).then(() => {
          showToast('已复制到剪贴板，快去分享吧')
        }).catch(() => {
          showToast('请手动复制链接分享')
        })
      } else {
        showToast('请手动复制链接分享')
      }
    })
  }

  /* ---- 开发模式快捷入口 ---- */

  async function checkDevMode() {
    const urlParams = new URLSearchParams(window.location.search)
    const devMode = urlParams.get('dev')

    if (!devMode) return false

    try {
      const pack = await ensurePackLoaded()
      
      if (devMode === 'quiz') {
        quizView.start(pack)
        showPage('quiz')
        return true
      }
      
      if (devMode === 'result') {
        // 模拟一个随机答题结果
        const mockAnswers = pack.questions.map(q => ({
          questionId: q.id,
          optionId: q.options[Math.floor(Math.random() * q.options.length)].id
        }))
        
        const scorer = scorerRegistry.get(pack.scorerId)
        latestResult = scorer.score({ answers: mockAnswers, pack, flowState: {} })
        
        resultView.render(latestResult, pack)
        showPage('result')
        return true
      }
    } catch (error) {
      console.error('Dev mode error:', error)
    }
    
    return false
  }

  /* ---- 初始化 ---- */

  async function init() {
    // 绑定开始按钮
    if (els.startButton) {
      els.startButton.addEventListener('click', handleStart)
    }

    setStartButtonState({ disabled: true, label: '加载中...' })

    // 设置分享按钮
    setupShareButton()

    try {
      const manifest = await packSource.loadActiveManifest()
      applyManifest(manifest)

      // 预加载测试包
      activePackPromise = packSource.warmActivePack().then((pack) => {
        activePack = pack
        applyPackDetails(pack)
        return pack
      })

      // 检查是否需要进入开发模式
      const isDevHandled = await checkDevMode()
      if (!isDevHandled) {
        // 正常显示首页
        showPage('intro')
      }
    } catch (error) {
      showLoadError(error)
    }
  }

  return { init }
}
