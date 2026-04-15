export function createQuiz(questions, config, onComplete) {
  let current = 0
  let answers = []

  const els = {
    fill: document.getElementById('progress-fill'),
    text: document.getElementById('progress-text'),
    kicker: document.getElementById('question-kicker'),
    caption: document.getElementById('question-caption'),
    qText: document.getElementById('question-text'),
    options: document.getElementById('options'),
  }

  function updateProgress() {
    const pct = (current / questions.length) * 100
    els.fill.style.width = `${pct}%`
    els.text.textContent = `${current} / ${questions.length}`
  }

  function renderQuestion() {
    const question = questions[current]
    els.kicker.textContent = `第 ${current + 1} 题`
    els.caption.textContent = question.caption || ''
    els.qText.textContent = question.prompt
    els.options.innerHTML = ''

    question.options.forEach((option, optionIndex) => {
      const btn = document.createElement('button')
      btn.className = 'btn btn-option'
      btn.innerHTML = `
        <span class="option-label">${option.label}</span>
        <span class="option-roast">${option.roast || ''}</span>
      `
      btn.addEventListener('click', () => selectOption(optionIndex))
      els.options.appendChild(btn)
    })

    updateProgress()
  }

  function selectOption(optionIndex) {
    answers[current] = optionIndex
    current += 1

    if (current >= questions.length) {
      onComplete([...answers])
      return
    }

    renderQuestion()
  }

  function start() {
    current = 0
    answers = new Array(questions.length).fill(null)
    renderQuestion()
  }

  return { start }
}
