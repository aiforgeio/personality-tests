import { determineResult } from './engine.js'
import { createQuiz } from './quiz.js'
import { renderResult } from './result.js'
import { loadJSON } from './utils.js'
import './style.css'

async function init() {
  const [questions, types, config] = await Promise.all([
    loadJSON(new URL('../data/questions.json', import.meta.url).href),
    loadJSON(new URL('../data/types.json', import.meta.url).href),
    loadJSON(new URL('../data/config.json', import.meta.url).href),
  ])

  document.title = config.display.title
  document.getElementById('intro-subtitle').textContent = config.display.subtitle
  document.getElementById('intro-credit').textContent = config.display.author
  document.getElementById('intro-note').textContent = config.display.funNote

  const pages = {
    intro: document.getElementById('page-intro'),
    quiz: document.getElementById('page-quiz'),
    result: document.getElementById('page-result'),
  }

  function showPage(name) {
    Object.values(pages).forEach((page) => page.classList.remove('active'))
    pages[name].classList.add('active')
    window.scrollTo(0, 0)
  }

  function onQuizComplete(answers) {
    const result = determineResult(answers, questions, types, config.scoring)
    renderResult(result, config)
    showPage('result')
  }

  const quiz = createQuiz(questions, config, onQuizComplete)

  document.getElementById('btn-start').addEventListener('click', () => {
    quiz.start()
    showPage('quiz')
  })

  document.getElementById('btn-restart').addEventListener('click', () => {
    quiz.start()
    showPage('quiz')
  })
}

init()
