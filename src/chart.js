import { clamp, formatCode } from './utils.js'

export function renderScoreBars(container, rankings) {
  const maxScore = Math.max(...rankings.map((item) => item.score), 1)
  container.innerHTML = ''

  rankings.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'score-row' + (index === 0 ? ' is-primary' : '')

    const width = clamp((item.score / maxScore) * 100, 0, 100)
    row.innerHTML = `
      <div class="score-row-head">
        <div class="score-row-title">
          <span class="score-alias">${item.alias}</span>
          <span class="score-code">${formatCode(item.code)}</span>
        </div>
        <span class="score-value">${item.score}</span>
      </div>
      <div class="score-track">
        <div class="score-fill" style="width:${width}%"></div>
      </div>
    `
    container.appendChild(row)
  })
}
