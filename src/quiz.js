import { createFlowController } from './flows/index.js'
import { stripEndingPunctuation } from './utils.js'

/* ---- 工具函数 ---- */

function getQuestionMeta(pack, question) {
  if (question.special) {
    return stripEndingPunctuation(question.caption || '补充题')
  }

  if (question.caption) {
    return stripEndingPunctuation(question.caption)
  }

  const dimensionMeta = pack.dimensions?.meta?.[question.dim]
  if (!dimensionMeta) return ''

  const label = dimensionMeta.label ?? dimensionMeta.title ?? question.dim ?? ''
  const model = dimensionMeta.model ?? ''
  return stripEndingPunctuation([label, model].filter(Boolean).join(' · '))
}

/* ---- 题目切换动画 ---- */

function animateQuestionTransition(card, direction, callback) {
  // direction: 'next' = 向左滑出，'prev' = 向右滑出
  const outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right'
  const inClass = direction === 'next' ? 'slide-in-right' : 'slide-in-left'

  card.classList.add(outClass)

  const onAnimEnd = () => {
    card.removeEventListener('animationend', onAnimEnd)
    card.classList.remove(outClass)
    callback()
    card.classList.add(inClass)

    const onInEnd = () => {
      card.removeEventListener('animationend', onInEnd)
      card.classList.remove(inClass)
    }
    card.addEventListener('animationend', onInEnd, { once: true })
  }

  card.addEventListener('animationend', onAnimEnd, { once: true })
}

/* ---- 触觉反馈 ---- */

function vibrate(pattern = 50) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

/* ---- 答题视图 ---- */

export function createQuizView({ onComplete }) {
  let pack = null
  let flow = null
  let isTransitioning = false // 防止动画期间重复操作
  let autoNextTimer = null    // 自动跳转计时器
  let swipeHintShown = false  // 手势提示是否已显示

  const els = {
    fill: document.getElementById('progress-fill'),
    percent: document.getElementById('progress-percent'),
    text: document.getElementById('progress-text'),
    kicker: document.getElementById('question-kicker'),
    caption: document.getElementById('question-caption'),
    qText: document.getElementById('question-text'),
    description: document.getElementById('question-description'),
    options: document.getElementById('options'),
    modeNote: document.getElementById('question-mode-note'),
    prev: document.getElementById('btn-prev-question'),
    quizCard: document.getElementById('quiz-card'),
    swipeHint: document.getElementById('swipe-hint'),
  }

  /* ---- 进度更新 ---- */

  function updateProgress(snapshot) {
    const pct = Math.round(snapshot.progress.percentage)
    if (els.fill) els.fill.style.width = `${pct}%`
    if (els.text) els.text.textContent = `${snapshot.progress.answered} / ${snapshot.totalQuestions}`
    if (els.percent) els.percent.textContent = `${pct}%`
  }

  /* ---- 渲染选项 ---- */

  function renderOptions(question, snapshot) {
    const currentAnswer = snapshot.currentQuestion
      ? snapshot.answers[String(snapshot.currentQuestion.id)]
      : null

    if (!els.options) return
    els.options.innerHTML = ''

    question.options.forEach((option, optionIndex) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      const isSelected = currentAnswer?.optionIndex === optionIndex
      btn.className = `btn btn-option${isSelected ? ' is-selected' : ''}`

      // 选中图标
      const checkIcon = `<span class="option-check">${isSelected ? '✓' : ''}</span>`

      btn.innerHTML = `
        ${checkIcon}
        <span class="option-label">${stripEndingPunctuation(option.label)}</span>
        ${option.hint ? `<span class="option-hint">${stripEndingPunctuation(option.hint)}</span>` : ''}
      `

      btn.addEventListener('click', () => {
        if (isTransitioning) return
        handleSelect(optionIndex)
      })

      // 交错入场动画
      btn.style.animationDelay = `${optionIndex * 0.06}s`
      btn.style.animation = `pageEnter 0.3s ease both`

      els.options.appendChild(btn)
    })
  }

  /* ---- 更新底部导航 ---- */

  function updateFooter(snapshot) {
    if (els.prev) {
      els.prev.disabled = !snapshot.canGoBack
    }

    if (els.modeNote) {
      if (snapshot.hasCurrentAnswer) {
        els.modeNote.textContent = '已选择，可右滑返回上一题修改'
      } else {
        els.modeNote.textContent = '选择一个选项，自动进入下一题'
      }
    }
  }

  /* ---- 渲染题目 ---- */

  function renderQuestion() {
    const snapshot = flow.getSnapshot()
    const question = snapshot.currentQuestion
    if (!question) return

    if (els.kicker) {
      els.kicker.textContent = `第 ${snapshot.progress.current} / ${snapshot.totalQuestions} 题`
    }

    if (els.caption) {
      const meta = getQuestionMeta(pack, question)
      els.caption.textContent = meta
      els.caption.hidden = !meta
    }

    if (els.qText) els.qText.textContent = stripEndingPunctuation(question.prompt)

    if (els.description) {
      const questionDescription = stripEndingPunctuation(question.description || '')
      els.description.textContent = questionDescription
      els.description.hidden = !questionDescription
    }

    renderOptions(question, snapshot)
    updateProgress(snapshot)
    updateFooter(snapshot)
  }

  /* ---- 完成答题 ---- */

  function completeQuiz() {
    vibrate([50, 30, 80])
    onComplete(flow.exportResult())
  }

  /* ---- 选择选项（核心：选中即跳转） ---- */

  function handleSelect(optionIndex) {
    if (isTransitioning) return

    // 清除之前的自动跳转计时器
    if (autoNextTimer) {
      clearTimeout(autoNextTimer)
      autoNextTimer = null
    }

    const answer = flow.selectOption(optionIndex)
    if (!answer) return

    // 触觉反馈
    vibrate(40)

    // 更新选中状态（不触发完整重渲染，只更新选项样式）
    const optionBtns = els.options?.querySelectorAll('.btn-option')
    if (optionBtns) {
      optionBtns.forEach((btn, idx) => {
        btn.classList.toggle('is-selected', idx === optionIndex)
        const check = btn.querySelector('.option-check')
        if (check) check.textContent = idx === optionIndex ? '✓' : ''
      })
    }

    // 更新进度
    const snapshot = flow.getSnapshot()
    updateProgress(snapshot)
    updateFooter(snapshot)

    // 0.5s 后自动跳转
    autoNextTimer = setTimeout(() => {
      autoNextTimer = null

      if (snapshot.currentIndex >= snapshot.totalQuestions - 1) {
        // 最后一题 → 完成
        completeQuiz()
      } else {
        // 跳转下一题
        goToNext()
      }
    }, 500)
  }

  /* ---- 跳转下一题（带动画） ---- */

  function goToNext() {
    if (isTransitioning || !els.quizCard) return

    isTransitioning = true

    animateQuestionTransition(els.quizCard, 'next', () => {
      flow.goNext()
      renderQuestion()
    })

    setTimeout(() => {
      isTransitioning = false
    }, 600)
  }

  /* ---- 跳转上一题（带动画） ---- */

  function handlePrevious() {
    if (isTransitioning) return

    // 取消待执行的自动跳转
    if (autoNextTimer) {
      clearTimeout(autoNextTimer)
      autoNextTimer = null
    }

    if (!flow.goPrevious()) return

    isTransitioning = true
    vibrate(30)

    if (els.quizCard) {
      animateQuestionTransition(els.quizCard, 'prev', () => {
        renderQuestion()
      })
    } else {
      renderQuestion()
    }

    setTimeout(() => {
      isTransitioning = false
    }, 600)
  }

  /* ---- 手势支持（左右滑动） ---- */

  function setupGestures() {
    if (!els.quizCard) return

    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0

    els.quizCard.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
      touchStartTime = Date.now()
    }, { passive: true })

    els.quizCard.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX
      const deltaY = e.changedTouches[0].clientY - touchStartY
      const deltaTime = Date.now() - touchStartTime

      // 快速滑动（< 300ms）且水平位移 > 60px，且水平位移 > 垂直位移
      const isHorizontalSwipe =
        Math.abs(deltaX) > 60 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.5 &&
        deltaTime < 300

      if (!isHorizontalSwipe) return

      if (deltaX > 0) {
        // 右滑 → 返回上一题
        handlePrevious()

        // 首次显示手势提示
        if (!swipeHintShown && els.swipeHint) {
          swipeHintShown = true
          els.swipeHint.style.display = 'none'
        }
      }
      // 左滑暂不处理（选中后自动跳转）
    }, { passive: true })
  }

  /* ---- 显示手势提示 ---- */

  function showSwipeHint() {
    if (!els.swipeHint || swipeHintShown) return

    // 第 3 题后显示手势提示
    const snapshot = flow.getSnapshot()
    if (snapshot.progress.current >= 3) {
      els.swipeHint.style.display = 'block'
      swipeHintShown = true

      // 3 秒后自动隐藏
      setTimeout(() => {
        if (els.swipeHint) els.swipeHint.style.display = 'none'
      }, 3000)
    }
  }

  /* ---- 启动 ---- */

  function start(nextPack) {
    pack = nextPack
    flow = createFlowController(pack)
    isTransitioning = false
    swipeHintShown = false

    if (autoNextTimer) {
      clearTimeout(autoNextTimer)
      autoNextTimer = null
    }

    renderQuestion()
    setupGestures()
  }

  /* ---- 事件绑定 ---- */

  if (els.prev) {
    els.prev.addEventListener('click', handlePrevious)
  }

  return { start }
}
