import { formatCode, toLines } from './utils.js'
import QRCode from 'qrcode'

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

const FONT = 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'

const PALETTE = {
  bgStart: '#f3f4f6',
  cardBg: '#ffffff',
  cardGradientEnd: '#f0f7f0',
  cardBorder: 'rgba(76, 175, 80, 0.12)',
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  primaryLight: '#81C784',
  primarySurface: 'rgba(76, 175, 80, 0.06)',
  secondary: '#2196F3',
  accent: '#FF9800',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textMuted: '#8c8c8c',
  textDim: '#bfbfbf',
  tagBg: 'rgba(76, 175, 80, 0.08)',
  tagBorder: 'rgba(76, 175, 80, 0.18)',
  tagText: '#388E3C',
  surface: 'rgba(0, 0, 0, 0.025)',
  divider: 'rgba(0, 0, 0, 0.06)',
}

/* ---- 绘制背景 ---- */

function drawBackground(ctx, width, height) {
  ctx.fillStyle = PALETTE.bgStart
  ctx.fillRect(0, 0, width, height)
}

/* ---- 绘制卡片背景（带微妙渐变） ---- */

function drawCardBackground(ctx, x, y, w, h, r = 24) {
  roundRect(ctx, x, y, w, h, r)
  const gradient = ctx.createLinearGradient(x, y, x, y + h)
  gradient.addColorStop(0, PALETTE.cardBg)
  gradient.addColorStop(0.5, '#f8faf8')
  gradient.addColorStop(1, PALETTE.cardGradientEnd)
  ctx.fillStyle = gradient
  ctx.fill()

  roundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = PALETTE.cardBorder
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/* ---- 绘制英雄图片 ---- */

async function drawHeroPanel(ctx, hero, x, y, width, height) {
  if (hero.image) {
    try {
      const image = await loadImage(hero.image)
      const scale = Math.min(width / image.width, height / image.height)
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      const drawX = x + (width - drawWidth) / 2
      const drawY = y + (height - drawHeight) / 2
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
      return true
    } catch (error) {
      console.warn('Failed to draw hero image:', error)
    }
  }
  return false
}

/* ---- 绘制标签 ---- */

function drawTags(ctx, tags, centerX, y, maxWidth) {
  if (!tags || tags.length === 0) return y

  ctx.font = `700 22px ${FONT}`
  const tagHeight = 40
  const tagPadding = 18
  const tagGap = 10

  const items = tags.slice(0, 6).map((tag) => {
    const text = typeof tag === 'string' ? tag : (tag.text || '')
    const textWidth = ctx.measureText(text).width
    return { text, width: textWidth + tagPadding * 2 }
  })

  const rows = []
  let currentRow = []
  let currentRowWidth = 0

  items.forEach((item) => {
    if (currentRow.length > 0 && currentRowWidth + item.width + tagGap > maxWidth) {
      rows.push(currentRow)
      currentRow = [item]
      currentRowWidth = item.width
    } else {
      currentRow.push(item)
      currentRowWidth += (currentRow.length > 1 ? tagGap : 0) + item.width
    }
  })
  if (currentRow.length > 0) rows.push(currentRow)

  let currentY = y

  rows.forEach((row) => {
    const rowWidth = row.reduce((sum, item, i) => sum + item.width + (i > 0 ? tagGap : 0), 0)
    let startX = centerX - rowWidth / 2

    row.forEach((item) => {
      roundRect(ctx, startX, currentY, item.width, tagHeight, tagHeight / 2)
      ctx.fillStyle = PALETTE.tagBg
      ctx.fill()
      roundRect(ctx, startX, currentY, item.width, tagHeight, tagHeight / 2)
      ctx.strokeStyle = PALETTE.tagBorder
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = PALETTE.tagText
      ctx.textAlign = 'center'
      ctx.fillText(item.text, startX + item.width / 2, currentY + tagHeight / 2 + 8)

      startX += item.width + tagGap
    })

    currentY += tagHeight + 12
  })

  return currentY
}

/* ---- 绘制维度条形图 ---- */

function drawDimensionBars(ctx, dimensions, x, y, width, maxItems = 6) {
  if (!dimensions || dimensions.length === 0) return y

  const items = dimensions.slice(0, maxItems)
  const barHeight = 8
  const rowHeight = 44
  const barMarginTop = 6

  ctx.textAlign = 'left'

  items.forEach((item, index) => {
    const rowY = y + index * rowHeight

    ctx.fillStyle = PALETTE.textSecondary
    ctx.font = `600 20px ${FONT}`
    ctx.fillText(item.label || item.id, x, rowY + 16)

    ctx.fillStyle = PALETTE.primaryLight
    ctx.font = `700 20px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(item.levelCode || '', x + width, rowY + 16)
    ctx.textAlign = 'left'

    const barY = rowY + 16 + barMarginTop
    roundRect(ctx, x, barY, width, barHeight, barHeight / 2)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.fill()

    const fillWidth = Math.max(barHeight, (item.percentage / 100) * width)
    const barGrad = ctx.createLinearGradient(x, barY, x + fillWidth, barY)
    barGrad.addColorStop(0, PALETTE.primaryLight)
    barGrad.addColorStop(1, PALETTE.primary)
    roundRect(ctx, x, barY, fillWidth, barHeight, barHeight / 2)
    ctx.fillStyle = barGrad
    ctx.fill()
  })

  return y + items.length * rowHeight + 12
}

/* ---- 主生成函数 ---- */

export async function generateShareImage(result) {
  const { hero, share, sections } = result

  const dpr = 2
  const width = 750
  const height = 1334

  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  drawBackground(ctx, width, height)

  const cardX = 32
  const cardY = 32
  const cardW = width - 64
  const cardH = height - 64
  drawCardBackground(ctx, cardX, cardY, cardW, cardH, 24)

  let y = cardY + 50

  // Header text
  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `500 26px ${FONT}`
  ctx.fillText('你的人格类型是：', width / 2, y)
  y += 50

  // Hero image
  const panelW = cardW * 0.48
  const panelH = panelW * (4 / 3)
  const panelX = (width - panelW) / 2
  const hasImage = await drawHeroPanel(ctx, hero, panelX, y, panelW, panelH)
  if (hasImage) {
    y += panelH + 36
  } else {
    y += 20
  }

  // Title
  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.text
  ctx.font = `900 72px ${FONT}`
  ctx.fillText(hero.title || '', width / 2, y)
  y += 48

  // Code
  ctx.fillStyle = PALETTE.primary
  ctx.font = `800 44px ${FONT}`
  ctx.fillText(formatCode(hero.code), width / 2, y)
  y += 40

  // Tags
  const tagListSection = sections.find((s) => s.type === 'tag-list')
  if (tagListSection && tagListSection.items?.length > 0) {
    y += 8
    const tagTexts = tagListSection.items.slice(0, 6)
    y = drawTags(ctx, tagTexts, width / 2, y, cardW - 80)
    y += 4
  }

  // Badge / quote
  if (hero.badge) {
    const badgeX = cardX + 48
    const badgeW = cardW - 96
    const lines = toLines(hero.badge, 26)
    const lineH = 34
    const badgeH = Math.max(60, lines.length * lineH + 28)

    roundRect(ctx, badgeX, y, badgeW, badgeH, 12)
    ctx.fillStyle = PALETTE.primarySurface
    ctx.fill()

    ctx.fillStyle = PALETTE.primary
    ctx.fillRect(badgeX, y + 14, 3, badgeH - 28)

    ctx.fillStyle = PALETTE.textSecondary
    ctx.font = `500 24px ${FONT}`
    ctx.textAlign = 'left'
    lines.forEach((line, i) => {
      ctx.fillText(line, badgeX + 20, y + 32 + i * lineH)
    })

    y += badgeH + 24
  }

  // Top dimensions (condensed)
  const dimListSection = sections.find((s) => s.type === 'dimension-list')
  if (dimListSection && dimListSection.items?.length > 0) {
    const remainingSpace = (cardY + cardH - 160) - y
    if (remainingSpace > 220) {
      const maxItems = remainingSpace > 360 ? 6 : 4
      y = drawDimensionBars(ctx, dimListSection.items, cardX + 48, y, cardW - 96, maxItems)
    }
  }

  // Footer
  const footerY = cardY + cardH - 130

  ctx.strokeStyle = PALETTE.divider
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cardX + 40, footerY)
  ctx.lineTo(cardX + cardW - 40, footerY)
  ctx.stroke()

  try {
    const qrUrl = window.location.href.split('?')[0]
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
    const qrImage = await loadImage(qrDataUrl)
    ctx.drawImage(qrImage, cardX + 44, footerY + 24, 88, 88)
  } catch (err) {
    console.error('Failed to generate QR code:', err)
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.text
  ctx.font = `700 24px ${FONT}`
  ctx.fillText('扫码测测你是什么型', cardX + 152, footerY + 58)

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `500 20px ${FONT}`
  ctx.fillText('GBTI · 股民人格测试', cardX + 152, footerY + 90)

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
