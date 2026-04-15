import { renderScoreBars } from './chart.js'
import { generateShareImage } from './share.js'
import { formatCode } from './utils.js'

function renderTextList(container, values, { quote = false } = {}) {
  container.innerHTML = ''
  values.forEach((value) => {
    const row = document.createElement(quote ? 'blockquote' : 'li')
    row.className = quote ? 'quote-item' : ''
    row.textContent = value
    container.appendChild(row)
  })
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

function renderTopList(container, rankings, limit) {
  container.innerHTML = ''
  rankings.slice(0, limit).forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'top-item' + (index === 0 ? ' is-primary' : '')
    row.innerHTML = `
      <span class="top-rank">#${index + 1}</span>
      <span class="top-main">${item.alias}</span>
      <span class="top-sub">${formatCode(item.code)}</span>
      <span class="top-score">${item.score}</span>
    `
    container.appendChild(row)
  })
}

export function renderResult(result, config) {
  const { primary, rankings, confidence } = result
  if (!primary) return

  document.getElementById('result-name').textContent = primary.alias
  document.getElementById('result-code').textContent = primary.code
  document.getElementById('result-english').textContent = primary.english
  document.getElementById('result-badge').textContent = `Confidence ${confidence}%`
  document.getElementById('result-intro').textContent = primary.badge
  document.getElementById('result-desc').textContent = primary.brief
  document.getElementById('result-note').textContent = primary.systemNote
  document.getElementById('disclaimer').textContent = config.display.funNote

  renderScoreBars(document.getElementById('score-bars'), rankings)
  renderTags(document.getElementById('tag-list'), primary.tags)
  renderTextList(document.getElementById('quote-list'), primary.sayings, { quote: true })
  renderTextList(document.getElementById('trait-list'), primary.traits)
  renderTextList(document.getElementById('advice-list'), primary.advice)
  renderTopList(document.getElementById('top-list'), rankings, config.scoring.topListCount)

  const download = document.getElementById('btn-download')
  download.onclick = () => generateShareImage(primary, rankings, confidence, config)
}
