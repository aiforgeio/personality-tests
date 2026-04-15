import QRCode from 'qrcode'

import { getCachedImage, preloadImage } from './image-cache.js'
import {
  getHighlightDimensions,
  getHighlightTags,
  getPosterComparison,
  getPosterQuote,
} from './result-highlights.js'
import { formatCode, toLines } from './utils.js'

/* ---- Canvas 工具函数 ---- */

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

function clipRoundRect(ctx, x, y, w, h, r) {
  roundRect(ctx, x, y, w, h, r)
  ctx.save()
  ctx.clip()
}

async function resolveImage(src) {
  if (!src) return null

  const cached = getCachedImage(src)
  if (cached?.complete && cached.naturalWidth > 0) {
    return cached
  }

  return preloadImage(src, {
    fetchPriority: 'high',
    decoding: 'async',
  })
}

function clampLines(text, limit, maxLines) {
  const lines = toLines(text, limit)
  if (lines.length <= maxLines) return lines

  const visible = lines.slice(0, maxLines)
  const last = visible[maxLines - 1] || ''
  visible[maxLines - 1] = `${last.slice(0, Math.max(0, limit - 2))}...`
  return visible
}

function fitTextSize(ctx, text, maxWidth, maxSize, minSize, weight = 700) {
  if (!text) return minSize

  let size = maxSize
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${FONT}`
    if (ctx.measureText(text).width <= maxWidth) {
      break
    }
    size -= 2
  }
  return Math.max(size, minSize)
}

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif'

const PALETTE = {
  bgStart: '#eef5ef',
  bgEnd: '#f7faf7',
  cardBg: '#ffffff',
  cardGlow: 'rgba(76, 175, 80, 0.10)',
  cardBorder: 'rgba(76, 175, 80, 0.15)',
  primary: '#4CAF50',
  primaryDark: '#2f7d32',
  primaryLight: '#80ce84',
  primarySurface: 'rgba(76, 175, 80, 0.08)',
  secondarySurface: 'rgba(33, 150, 243, 0.08)',
  text: '#171717',
  textSecondary: '#4c4c4c',
  textMuted: '#757575',
  divider: 'rgba(0, 0, 0, 0.08)',
  barBg: 'rgba(0, 0, 0, 0.06)',
  tagBg: 'rgba(76, 175, 80, 0.08)',
  tagBorder: 'rgba(76, 175, 80, 0.18)',
}

/* ---- 绘制背景 ---- */

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, PALETTE.bgStart)
  gradient.addColorStop(1, PALETTE.bgEnd)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const orbA = ctx.createRadialGradient(110, 100, 0, 110, 100, 190)
  orbA.addColorStop(0, 'rgba(76, 175, 80, 0.13)')
  orbA.addColorStop(1, 'rgba(76, 175, 80, 0)')
  ctx.fillStyle = orbA
  ctx.fillRect(0, 0, width, height)

  const orbB = ctx.createRadialGradient(width - 70, 170, 0, width - 70, 170, 190)
  orbB.addColorStop(0, 'rgba(33, 150, 243, 0.08)')
  orbB.addColorStop(1, 'rgba(33, 150, 243, 0)')
  ctx.fillStyle = orbB
  ctx.fillRect(0, 0, width, height)
}

function drawCardBackground(ctx, x, y, w, h, r = 30) {
  roundRect(ctx, x, y, w, h, r)
  const gradient = ctx.createLinearGradient(x, y, x, y + h)
  gradient.addColorStop(0, PALETTE.cardBg)
  gradient.addColorStop(1, '#f4faf4')
  ctx.fillStyle = gradient
  ctx.fill()

  roundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = PALETTE.cardBorder
  ctx.lineWidth = 1.5
  ctx.stroke()

  const glow = ctx.createRadialGradient(x + w / 2, y + 110, 20, x + w / 2, y + 110, w * 0.48)
  glow.addColorStop(0, PALETTE.cardGlow)
  glow.addColorStop(1, 'rgba(76, 175, 80, 0)')
  ctx.fillStyle = glow
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
}

/* ---- 绘制英雄图片 ---- */

async function drawHeroPanel(ctx, hero, x, y, width, height) {
  roundRect(ctx, x, y, width, height, 28)
  const panelGradient = ctx.createLinearGradient(x, y, x, y + height)
  panelGradient.addColorStop(0, '#f9fcf9')
  panelGradient.addColorStop(1, '#ecf6ec')
  ctx.fillStyle = panelGradient
  ctx.fill()

  const halo = ctx.createRadialGradient(x + width / 2, y + height / 2, 24, x + width / 2, y + height / 2, width / 2)
  halo.addColorStop(0, 'rgba(76, 175, 80, 0.15)')
  halo.addColorStop(1, 'rgba(76, 175, 80, 0)')
  ctx.fillStyle = halo
  roundRect(ctx, x, y, width, height, 28)
  ctx.fill()

  roundRect(ctx, x, y, width, height, 28)
  ctx.strokeStyle = 'rgba(76, 175, 80, 0.11)'
  ctx.lineWidth = 1
  ctx.stroke()

  if (hero.image) {
    try {
      const image = await resolveImage(hero.image)
      if (image) {
        clipRoundRect(ctx, x, y, width, height, 28)
        try {
          const scale = Math.min((width * 0.88) / image.width, (height * 0.88) / image.height)
          const drawWidth = image.width * scale
          const drawHeight = image.height * scale
          const drawX = x + (width - drawWidth) / 2
          const drawY = y + (height - drawHeight) / 2 + 2
          ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
        } finally {
          ctx.restore()
        }
        return true
      }
    } catch (error) {
      console.warn('Failed to draw hero image:', error)
    }
  }

  ctx.fillStyle = PALETTE.primary
  ctx.font = `800 26px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(formatCode(hero.code), x + width / 2, y + height / 2 + 8)
  return false
}

/* ---- 文本区块 ---- */

function drawQuoteCard(ctx, text, x, y, width) {
  const lines = clampLines(text, 16, 2)
  const lineHeight = 28
  const height = Math.max(74, lines.length * lineHeight + 24)

  roundRect(ctx, x, y, width, height, 17)
  ctx.fillStyle = PALETTE.primarySurface
  ctx.fill()

  ctx.fillStyle = PALETTE.primary
  ctx.fillRect(x, y + 14, 4, height - 28)

  ctx.fillStyle = PALETTE.textSecondary
  ctx.font = `700 21px ${FONT}`
  ctx.textAlign = 'left'
  lines.forEach((line, index) => {
    ctx.fillText(line, x + 18, y + 32 + index * lineHeight)
  })

  return y + height
}

function drawTags(ctx, tags, centerX, y, maxWidth) {
  const visibleTags = tags.slice(0, 3)
  if (!visibleTags.length) return y

  ctx.font = `700 17px ${FONT}`
  const tagHeight = 32
  const gap = 9
  const paddingX = 15

  const rows = []
  let row = []
  let rowWidth = 0

  visibleTags.forEach((text) => {
    const safeText = text.length > 8 ? `${text.slice(0, 8)}...` : text
    const width = ctx.measureText(safeText).width + paddingX * 2

    if (row.length > 0 && rowWidth + width + gap > maxWidth) {
      rows.push(row)
      row = [{ text: safeText, width }]
      rowWidth = width
      return
    }

    row.push({ text: safeText, width })
    rowWidth += (row.length > 1 ? gap : 0) + width
  })

  if (row.length > 0) rows.push(row)

  let currentY = y
  rows.slice(0, 2).forEach((items) => {
    const totalWidth = items.reduce((sum, item, index) => sum + item.width + (index > 0 ? gap : 0), 0)
    let currentX = centerX - totalWidth / 2

    items.forEach((item) => {
      roundRect(ctx, currentX, currentY, item.width, tagHeight, tagHeight / 2)
      ctx.fillStyle = PALETTE.tagBg
      ctx.fill()

      roundRect(ctx, currentX, currentY, item.width, tagHeight, tagHeight / 2)
      ctx.strokeStyle = PALETTE.tagBorder
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = PALETTE.primaryDark
      ctx.textAlign = 'center'
      ctx.fillText(item.text, currentX + item.width / 2, currentY + 21)
      currentX += item.width + gap
    })

    currentY += tagHeight + 8
  })

  return currentY
}

function drawComparisonPill(ctx, comparison, centerX, y, maxWidth) {
  if (!comparison) return y

  const rawTitle = comparison.title || comparison.code || ''
  if (!rawTitle) return y

  const title = rawTitle.length > 10 ? `${rawTitle.slice(0, 10)}...` : rawTitle
  const text = `常规命中 ${title}`

  ctx.font = `700 16px ${FONT}`
  const desiredWidth = ctx.measureText(text).width + 34
  const width = Math.min(maxWidth, desiredWidth)
  const pillX = centerX - width / 2

  roundRect(ctx, pillX, y, width, 32, 16)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.fill()
  roundRect(ctx, pillX, y, width, 32, 16)
  ctx.strokeStyle = 'rgba(76, 175, 80, 0.16)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = PALETTE.textSecondary
  ctx.textAlign = 'center'
  ctx.fillText(text, centerX, y + 21)
  return y + 40
}

function drawDimensionGrid(ctx, dimensions, x, y, width) {
  const visibleItems = dimensions.slice(0, 4)
  if (!visibleItems.length) return y

  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `700 15px ${FONT}`
  ctx.fillText('关键维度', x, y + 14)
  y += 24

  const gap = 10
  const columns = 2
  const cardWidth = (width - gap) / columns
  const cardHeight = 68

  visibleItems.forEach((item, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const cardX = x + column * (cardWidth + gap)
    const cardY = y + row * (cardHeight + gap)

    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.76)'
    ctx.fill()
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15)
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.12)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.textSecondary
    ctx.font = `600 15px ${FONT}`
    const label = item.label.length > 8 ? `${item.label.slice(0, 8)}...` : item.label
    ctx.fillText(label, cardX + 12, cardY + 22)

    ctx.textAlign = 'right'
    ctx.fillStyle = PALETTE.primary
    ctx.font = `800 15px ${FONT}`
    ctx.fillText(item.levelCode || '', cardX + cardWidth - 12, cardY + 22)

    const barX = cardX + 12
    const barY = cardY + 35
    const barWidth = cardWidth - 24
    roundRect(ctx, barX, barY, barWidth, 7, 3.5)
    ctx.fillStyle = PALETTE.barBg
    ctx.fill()

    const fillWidth = Math.max(8, (Number(item.percentage ?? 0) / 100) * barWidth)
    const fillGradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY)
    fillGradient.addColorStop(0, PALETTE.primaryLight)
    fillGradient.addColorStop(1, PALETTE.primary)
    roundRect(ctx, barX, barY, fillWidth, 7, 3.5)
    ctx.fillStyle = fillGradient
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.textMuted
    ctx.font = `600 12px ${FONT}`
    ctx.fillText(`${Math.round(Number(item.percentage ?? 0))}%`, barX, cardY + 56)
  })

  const rows = Math.ceil(visibleItems.length / columns)
  return y + rows * (cardHeight + gap) - gap
}

/* ---- 主生成函数 ---- */

export async function generateShareImage(result) {
  const { hero, share } = result
  const tags = getHighlightTags(result, 3)
  const dimensions = getHighlightDimensions(result, 4)
  const comparison = getPosterComparison(result)
  const quote = getPosterQuote(result)

  const dpr = 2
  const width = 720
  const height = 900

  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  drawBackground(ctx, width, height)

  const cardX = 24
  const cardY = 24
  const cardW = width - 48
  const cardH = height - 48
  const centerX = width / 2
  drawCardBackground(ctx, cardX, cardY, cardW, cardH, 30)

  let y = cardY + 36

  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `600 17px ${FONT}`
  ctx.fillText('你的人格类型是', centerX, y)
  y += 20

  const heroW = 292
  const heroH = 232
  await drawHeroPanel(ctx, hero, centerX - heroW / 2, y, heroW, heroH)
  y += heroH + 20

  const title = hero.title || formatCode(hero.code)
  const titleSize = fitTextSize(ctx, title, cardW - 84, 82, 52, 900)
  ctx.fillStyle = PALETTE.text
  ctx.font = `900 ${titleSize}px ${FONT}`
  ctx.fillText(title, centerX, y)
  y += titleSize * 0.9 + 8

  const code = formatCode(hero.code)
  const codeSize = fitTextSize(ctx, code, cardW - 132, 40, 30, 800)
  ctx.fillStyle = PALETTE.primary
  ctx.font = `800 ${codeSize}px ${FONT}`
  ctx.fillText(code, centerX, y)
  y += codeSize * 0.88 + 8

  y = drawComparisonPill(ctx, comparison, centerX, y, cardW - 140)

  if (quote) {
    y += 6
    y = drawQuoteCard(ctx, quote, cardX + 44, y, cardW - 88)
    y += 12
  }

  y = drawTags(ctx, tags, centerX, y, cardW - 96)
  y += 10
  y = drawDimensionGrid(ctx, dimensions, cardX + 38, y, cardW - 76)

  const footerHeight = 96
  const anchoredFooterY = cardY + cardH - footerHeight - 16
  const minFooterY = y + 12
  const footerY = Math.min(
    Math.max(minFooterY, anchoredFooterY),
    cardY + cardH - footerHeight - 8,
  )

  ctx.strokeStyle = PALETTE.divider
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cardX + 28, footerY)
  ctx.lineTo(cardX + cardW - 28, footerY)
  ctx.stroke()

  try {
    const qrUrl = window.location.href.split('?')[0]
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 108,
      margin: 1,
      color: { dark: '#151515', light: '#ffffff' },
    })
    const qrImage = await resolveImage(qrDataUrl)
    if (qrImage) {
      ctx.drawImage(qrImage, cardX + 36, footerY + 16, 68, 68)
    }
  } catch (err) {
    console.error('Failed to generate QR code:', err)
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.text
  ctx.font = `700 23px ${FONT}`
  ctx.fillText('扫码测测你是什么型', cardX + 118, footerY + 44)

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `600 17px ${FONT}`
  ctx.fillText(share?.title || '人格测试', cardX + 118, footerY + 71)

  const dataUrl = canvas.toDataURL('image/png', 1.0)

  if (import.meta.env.DEV) {
    return dataUrl
  }

  const link = document.createElement('a')
  link.download = share.fileName || `GBTI-${hero.code}.png`
  link.href = dataUrl
  link.click()

  return dataUrl
}
