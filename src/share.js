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
  const tail = visible[maxLines - 1]
  visible[maxLines - 1] = `${tail.slice(0, Math.max(0, limit - 3))}...`
  return visible
}

const FONT = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'

const PALETTE = {
  bgStart: '#edf4ee',
  bgEnd: '#f7faf7',
  cardBg: '#ffffff',
  cardGlow: 'rgba(76, 175, 80, 0.10)',
  cardBorder: 'rgba(76, 175, 80, 0.16)',
  primary: '#4CAF50',
  primaryDark: '#2f7d32',
  primaryLight: '#7bc67f',
  primarySurface: 'rgba(76, 175, 80, 0.08)',
  secondarySurface: 'rgba(33, 150, 243, 0.08)',
  text: '#161616',
  textSecondary: '#4f4f4f',
  textMuted: '#7c7c7c',
  textDim: '#a3a3a3',
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

  const orbA = ctx.createRadialGradient(120, 120, 0, 120, 120, 180)
  orbA.addColorStop(0, 'rgba(76, 175, 80, 0.14)')
  orbA.addColorStop(1, 'rgba(76, 175, 80, 0)')
  ctx.fillStyle = orbA
  ctx.fillRect(0, 0, width, height)

  const orbB = ctx.createRadialGradient(width - 60, 180, 0, width - 60, 180, 180)
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

  const glow = ctx.createRadialGradient(x + w / 2, y + 90, 20, x + w / 2, y + 90, w * 0.45)
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
  panelGradient.addColorStop(0, '#f8fcf8')
  panelGradient.addColorStop(1, '#eef7ee')
  ctx.fillStyle = panelGradient
  ctx.fill()

  const halo = ctx.createRadialGradient(x + width / 2, y + height / 2, 24, x + width / 2, y + height / 2, width / 2)
  halo.addColorStop(0, 'rgba(76, 175, 80, 0.16)')
  halo.addColorStop(1, 'rgba(76, 175, 80, 0)')
  ctx.fillStyle = halo
  roundRect(ctx, x, y, width, height, 28)
  ctx.fill()

  roundRect(ctx, x, y, width, height, 28)
  ctx.strokeStyle = 'rgba(76, 175, 80, 0.10)'
  ctx.lineWidth = 1
  ctx.stroke()

  if (hero.image) {
    try {
      const image = await resolveImage(hero.image)
      if (image) {
        clipRoundRect(ctx, x, y, width, height, 28)
        try {
          const scale = Math.min((width * 0.82) / image.width, (height * 0.82) / image.height)
          const drawWidth = image.width * scale
          const drawHeight = image.height * scale
          const drawX = x + (width - drawWidth) / 2
          const drawY = y + (height - drawHeight) / 2 + 4
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
  const lines = clampLines(text, 15, 2)
  const lineHeight = 30
  const height = Math.max(80, lines.length * lineHeight + 30)

  roundRect(ctx, x, y, width, height, 18)
  ctx.fillStyle = PALETTE.primarySurface
  ctx.fill()

  ctx.fillStyle = PALETTE.primary
  ctx.fillRect(x, y + 16, 4, height - 32)

  ctx.fillStyle = PALETTE.textSecondary
  ctx.font = `600 24px ${FONT}`
  ctx.textAlign = 'left'
  lines.forEach((line, index) => {
    ctx.fillText(line, x + 22, y + 34 + index * lineHeight)
  })

  return y + height
}

function drawTags(ctx, tags, centerX, y, maxWidth) {
  if (!tags.length) return y

  ctx.font = `700 18px ${FONT}`
  const tagHeight = 34
  const gap = 10
  const paddingX = 16

  const rows = []
  let row = []
  let rowWidth = 0

  tags.forEach((text) => {
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
      ctx.fillText(item.text, currentX + item.width / 2, currentY + 22)
      currentX += item.width + gap
    })

    currentY += tagHeight + 10
  })

  return currentY
}

function drawComparisonPill(ctx, comparison, centerX, y) {
  if (!comparison) return y

  const title = comparison.title.length > 10 ? `${comparison.title.slice(0, 10)}...` : comparison.title
  const text = `常规命中 ${title}`

  ctx.font = `700 17px ${FONT}`
  const width = ctx.measureText(text).width + 40
  const pillX = centerX - width / 2

  roundRect(ctx, pillX, y, width, 34, 17)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.fill()
  roundRect(ctx, pillX, y, width, 34, 17)
  ctx.strokeStyle = 'rgba(76, 175, 80, 0.16)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = PALETTE.textSecondary
  ctx.textAlign = 'center'
  ctx.fillText(text, centerX, y + 22)
  return y + 46
}

function drawDimensionGrid(ctx, dimensions, x, y, width) {
  if (!dimensions.length) return y

  const gap = 12
  const columns = 2
  const cardWidth = (width - gap) / columns
  const cardHeight = 74

  dimensions.forEach((item, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const cardX = x + column * (cardWidth + gap)
    const cardY = y + row * (cardHeight + gap)

    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 18)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.fill()
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 18)
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.12)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.textSecondary
    ctx.font = `600 16px ${FONT}`
    const label = item.label.length > 8 ? `${item.label.slice(0, 8)}...` : item.label
    ctx.fillText(label, cardX + 14, cardY + 24)

    ctx.textAlign = 'right'
    ctx.fillStyle = PALETTE.primary
    ctx.font = `800 16px ${FONT}`
    ctx.fillText(item.levelCode || '', cardX + cardWidth - 14, cardY + 24)

    const barX = cardX + 14
    const barY = cardY + 42
    const barWidth = cardWidth - 28
    roundRect(ctx, barX, barY, barWidth, 8, 4)
    ctx.fillStyle = PALETTE.barBg
    ctx.fill()

    const fillWidth = Math.max(10, (Number(item.percentage ?? 0) / 100) * barWidth)
    const fillGradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY)
    fillGradient.addColorStop(0, PALETTE.primaryLight)
    fillGradient.addColorStop(1, PALETTE.primary)
    roundRect(ctx, barX, barY, fillWidth, 8, 4)
    ctx.fillStyle = fillGradient
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.textMuted
    ctx.font = `500 13px ${FONT}`
    ctx.fillText(`${Math.round(Number(item.percentage ?? 0))}%`, barX, cardY + 64)
  })

  return y + Math.ceil(dimensions.length / columns) * (cardHeight + gap) - gap
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

  const cardX = 26
  const cardY = 26
  const cardW = width - 52
  const cardH = height - 52
  drawCardBackground(ctx, cardX, cardY, cardW, cardH, 30)

  let y = cardY + 42

  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `600 18px ${FONT}`
  ctx.fillText('你的人格类型是', width / 2, y)
  y += 24

  await drawHeroPanel(ctx, hero, width / 2 - 130, y, 260, 220)
  y += 250

  ctx.fillStyle = PALETTE.text
  ctx.font = `900 74px ${FONT}`
  ctx.fillText(hero.title || '', width / 2, y)
  y += 48

  ctx.fillStyle = PALETTE.primary
  ctx.font = `800 40px ${FONT}`
  ctx.fillText(formatCode(hero.code), width / 2, y)
  y += 18

  y = drawComparisonPill(ctx, comparison, width / 2, y)

  if (quote) {
    y += 10
    y = drawQuoteCard(ctx, quote, cardX + 44, y, cardW - 88)
  }

  y += 18
  y = drawTags(ctx, tags, width / 2, y, cardW - 96)

  y += 8
  y = drawDimensionGrid(ctx, dimensions, cardX + 40, y, cardW - 80)

  const footerY = cardY + cardH - 112

  ctx.strokeStyle = PALETTE.divider
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cardX + 32, footerY)
  ctx.lineTo(cardX + cardW - 32, footerY)
  ctx.stroke()

  try {
    const qrUrl = window.location.href.split('?')[0]
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 110,
      margin: 1,
      color: { dark: '#141414', light: '#ffffff' },
    })
    const qrImage = await resolveImage(qrDataUrl)
    if (qrImage) {
      ctx.drawImage(qrImage, cardX + 38, footerY + 22, 72, 72)
    }
  } catch (err) {
    console.error('Failed to generate QR code:', err)
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.text
  ctx.font = `700 24px ${FONT}`
  ctx.fillText('扫码测测你是什么型', cardX + 128, footerY + 50)

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `600 18px ${FONT}`
  ctx.fillText('GBTI · 股民人格测试', cardX + 128, footerY + 80)

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
