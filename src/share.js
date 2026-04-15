import { formatCode, toLines } from './utils.js'

export async function generateShareImage(primary, rankings, confidence, config) {
  const dpr = 2
  const width = 720
  const height = 1280
  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#f5f7f3'
  ctx.fillRect(0, 0, width, height)

  roundRect(ctx, 28, 28, width - 56, height - 56, 22)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  let y = 80
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6b7b6e'
  ctx.font = '600 22px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(config.display.shareTitle, width / 2, y)
  y += 52

  ctx.fillStyle = '#243128'
  ctx.font = '800 52px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(primary.alias, width / 2, y)
  y += 44

  ctx.fillStyle = '#56705d'
  ctx.font = '600 22px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(formatCode(primary.code), width / 2, y)
  y += 34

  const badge = `Confidence ${confidence}%`
  ctx.font = '600 18px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  const badgeWidth = ctx.measureText(badge).width + 30
  roundRect(ctx, (width - badgeWidth) / 2, y - 20, badgeWidth, 36, 18)
  ctx.fillStyle = '#e7efe9'
  ctx.fill()
  ctx.fillStyle = '#4c6752'
  ctx.fillText(badge, width / 2, y + 4)
  y += 56

  ctx.fillStyle = '#2f4035'
  ctx.font = 'italic 600 22px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  toLines(primary.badge, 24).slice(0, 2).forEach((line) => {
    ctx.fillText(line, width / 2, y)
    y += 30
  })
  y += 10

  ctx.textAlign = 'left'
  ctx.fillStyle = '#5d6d62'
  ctx.font = '500 17px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  const briefLines = toLines(primary.brief, 28).slice(0, 5)
  briefLines.forEach((line) => {
    ctx.fillText(line, 64, y)
    y += 28
  })
  y += 26

  ctx.fillStyle = '#2f4035'
  ctx.font = '700 20px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('Top 5 匹配结果', 64, y)
  y += 28

  const topFive = rankings.slice(0, 5)
  const maxScore = Math.max(...topFive.map((item) => item.score), 1)

  topFive.forEach((item, index) => {
    const rowY = y + index * 78
    ctx.fillStyle = '#2f4035'
    ctx.font = '700 18px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(`${index + 1}. ${item.alias}`, 64, rowY)
    ctx.fillStyle = '#6b7b6e'
    ctx.font = '500 15px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(formatCode(item.code), 64, rowY + 22)

    roundRect(ctx, 64, rowY + 34, 520, 12, 6)
    ctx.fillStyle = '#ebf1ed'
    ctx.fill()

    roundRect(ctx, 64, rowY + 34, (item.score / maxScore) * 520, 12, 6)
    ctx.fillStyle = index === 0 ? '#4c6752' : '#8ea191'
    ctx.fill()

    ctx.fillStyle = '#2f4035'
    ctx.textAlign = 'right'
    ctx.font = '700 16px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(String(item.score), 640, rowY + 22)
    ctx.textAlign = 'left'
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = '#9aa89f'
  ctx.font = '500 17px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(config.display.shareFooter, width / 2, height - 60)

  const link = document.createElement('a')
  link.download = `GBTI-${primary.code}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
