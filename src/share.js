import QRCode from 'qrcode'

import { getCachedImage, preloadImage } from './image-cache.js'
import {
  getHighlightDimensions,
  getHighlightTags,
  getPosterComparison,
  getPosterQuote,
} from './result-highlights.js'
import { formatCode, stripEndingPunctuation, toLines } from './utils.js'

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
  visible[maxLines - 1] = last.slice(0, Math.max(0, limit))
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
  bgStart: '#f0f4f0',
  bgEnd: '#ffffff',
  cardBg: '#ffffff',
  cardGlow: 'rgba(46, 125, 50, 0.06)',
  cardBorder: 'rgba(46, 125, 50, 0.12)',
  primary: '#2E7D32',
  primaryDark: '#1B5E20',
  primaryLight: '#66BB6A',
  primaryMid: '#43A047',
  primarySurface: 'rgba(46, 125, 50, 0.05)',
  secondarySurface: 'rgba(33, 150, 243, 0.04)',
  text: '#1a1a1a',
  textSecondary: '#3d3d3d',
  textMuted: '#888888',
  textDim: '#b0b0b0',
  divider: 'rgba(0, 0, 0, 0.07)',
  barBg: 'rgba(0, 0, 0, 0.06)',
  tagBg: 'rgba(46, 125, 50, 0.07)',
  tagBorder: 'rgba(46, 125, 50, 0.16)',
}

/* ---- 绘制背景 ---- */

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, PALETTE.bgStart)
  gradient.addColorStop(0.5, '#f5f8f5')
  gradient.addColorStop(1, PALETTE.bgEnd)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  /* 背景装饰：右上角淡绿光晕 */
  const orbGrad = ctx.createRadialGradient(width * 0.85, height * 0.08, 0, width * 0.85, height * 0.08, width * 0.5)
  orbGrad.addColorStop(0, 'rgba(76, 175, 80, 0.08)')
  orbGrad.addColorStop(1, 'rgba(76, 175, 80, 0)')
  ctx.fillStyle = orbGrad
  ctx.fillRect(0, 0, width, height)
}

function drawCardBackground(ctx, x, y, w, h, r = 30) {
  /* 卡片阴影 */
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 6
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = PALETTE.cardBg
  ctx.fill()
  ctx.restore()

  /* 卡片填充 */
  roundRect(ctx, x, y, w, h, r)
  const gradient = ctx.createLinearGradient(x, y, x, y + h)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.6, '#fdfffe')
  gradient.addColorStop(1, '#f8fbf8')
  ctx.fillStyle = gradient
  ctx.fill()

  /* 卡片边框 */
  roundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = PALETTE.cardBorder
  ctx.lineWidth = 1
  ctx.stroke()
}

/* ---- 顶部 badge 标签 ---- */

function drawTopBadge(ctx, text, centerX, y) {
  ctx.font = `600 18px ${FONT}` // 放大字体
  const textWidth = ctx.measureText(text).width
  const paddingX = 24 // 增加内边距
  const paddingY = 12
  const badgeW = textWidth + paddingX * 2 // 移除绿点占用的宽度
  const badgeH = 40 // 增加高度

  const badgeX = centerX - badgeW / 2

  /* badge 背景 */
  roundRect(ctx, badgeX, y, badgeW, badgeH, badgeH / 2)
  ctx.fillStyle = 'rgba(46, 125, 50, 0.07)'
  ctx.fill()

  /* badge 边框 */
  roundRect(ctx, badgeX, y, badgeW, badgeH, badgeH / 2)
  ctx.strokeStyle = 'rgba(46, 125, 50, 0.18)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  /* 文字 (居中，无绿点) */
  ctx.fillStyle = PALETTE.primary
  ctx.font = `600 18px ${FONT}` // 放大字体
  ctx.textAlign = 'center'
  ctx.letterSpacing = '0.12em'
  ctx.fillText(text, centerX + 1, y + paddingY + 15) // 居中对齐
  ctx.letterSpacing = '0px'

  return y + badgeH
}

/* ---- 绘制英雄图片（增强光晕 + 椭圆投影） ---- */

async function drawHeroPanel(ctx, hero, x, y, width, height) {
  /* 椭圆形底部投影（模拟地面阴影，增加立体感） */
  const shadowGrad = ctx.createRadialGradient(
    x + width / 2, y + height * 0.92, 0,
    x + width / 2, y + height * 0.92, width * 0.42,
  )
  shadowGrad.addColorStop(0, 'rgba(46, 125, 50, 0.12)')
  shadowGrad.addColorStop(0.5, 'rgba(46, 125, 50, 0.05)')
  shadowGrad.addColorStop(1, 'rgba(46, 125, 50, 0)')
  ctx.fillStyle = shadowGrad
  ctx.fillRect(x, y + height * 0.6, width, height * 0.4)

  /* 增强的径向光晕托底 */
  const glow = ctx.createRadialGradient(
    x + width / 2, y + height * 0.5, 10,
    x + width / 2, y + height * 0.5, width * 0.58,
  )
  glow.addColorStop(0, 'rgba(46, 125, 50, 0.14)')
  glow.addColorStop(0.45, 'rgba(46, 125, 50, 0.06)')
  glow.addColorStop(1, 'rgba(46, 125, 50, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(x, y, width, height)

  if (hero.image) {
    try {
      const image = await resolveImage(hero.image)
      if (image) {
        clipRoundRect(ctx, x, y, width, height, 24)
        try {
          const scale = Math.min((width * 0.92) / image.width, (height * 0.92) / image.height)
          const drawWidth = image.width * scale
          const drawHeight = image.height * scale
          const drawX = x + (width - drawWidth) / 2
          const drawY = y + (height - drawHeight) / 2
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
  ctx.font = `800 28px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(formatCode(hero.code), x + width / 2, y + height / 2 + 8)
  return false
}

/* ---- 文本区块 ---- */

function drawQuoteCard(ctx, text, centerX, y, maxWidth) {
  const lines = clampLines(stripEndingPunctuation(text), 22, 3)
  const lineHeight = 36 // 增加行高
  const height = lines.length * lineHeight

  /* 引用文字 - 居中、无边框、斜体 */
  ctx.fillStyle = PALETTE.textSecondary
  ctx.font = `italic 500 24px ${FONT}` // 放大字体
  ctx.textAlign = 'center'

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, y + 24 + index * lineHeight)
  })

  return y + height + 24
}

function drawTags(ctx, tags, centerX, y, maxWidth) {
  const visibleTags = tags.map((tag) => stripEndingPunctuation(tag)).filter(Boolean).slice(0, 4)
  if (!visibleTags.length) return y

  ctx.font = `600 18px ${FONT}` // 放大字体
  const tagHeight = 38 // 增加高度
  const gap = 12 // 增加间距
  const paddingX = 20 // 增加内边距

  const rows = []
  let row = []
  let rowWidth = 0

  // 强制两排显示：如果超过2个标签，就在第2个之后换行
  visibleTags.forEach((text, index) => {
    const safeText = text.length > 8 ? text.slice(0, 8) : text
    const width = ctx.measureText(safeText).width + paddingX * 2

    if (index === 2 || (row.length > 0 && rowWidth + width + gap > maxWidth)) {
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
      ctx.lineWidth = 0.8
      ctx.stroke()

      ctx.fillStyle = PALETTE.primary
      ctx.textAlign = 'center'
      ctx.fillText(item.text, currentX + item.width / 2, currentY + 25) // 调整文字垂直位置
      currentX += item.width + gap
    })

    currentY += tagHeight + 12 // 增加行间距
  })

  return currentY
}

function drawComparisonPill(ctx, comparison, centerX, y, maxWidth) {
  if (!comparison) return y

  const rawTitle = comparison.title || comparison.code || ''
  if (!rawTitle) return y

  const title = rawTitle.length > 10 ? rawTitle.slice(0, 10) : rawTitle
  const text = `常规命中 ${title}`

  ctx.font = `600 15px ${FONT}`
  const desiredWidth = ctx.measureText(text).width + 32
  const width = Math.min(maxWidth, desiredWidth)
  const pillX = centerX - width / 2

  roundRect(ctx, pillX, y, width, 30, 15)
  ctx.fillStyle = 'rgba(46, 125, 50, 0.04)'
  ctx.fill()
  roundRect(ctx, pillX, y, width, 30, 15)
  ctx.strokeStyle = 'rgba(46, 125, 50, 0.12)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  ctx.fillStyle = PALETTE.textMuted
  ctx.textAlign = 'center'
  ctx.fillText(text, centerX, y + 20)
  return y + 30
}

/* ---- 维度图表（极简列表风，保留绿色系） ---- */

function drawDimensionList(ctx, dimensions, x, y, width) {
  const visibleItems = dimensions.slice(0, 4)
  if (!visibleItems.length) return y

  // 标题
  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `600 14px ${FONT}`
  ctx.letterSpacing = '0.1em'
  ctx.fillText('核心维度分析', x, y)
  ctx.letterSpacing = '0px'
  y += 48 // 增加标题与列表的间距

  const rowHeight = 64 // 增加行高，拉大间距
  const labelWidth = 140
  const valueWidth = 60
  const barX = x + labelWidth
  const barWidth = width - labelWidth - valueWidth - 20 // 20px padding

  visibleItems.forEach((item) => {
    // Label
    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.text
    ctx.font = `500 20px ${FONT}`
    const label = item.label.length > 7 ? item.label.slice(0, 7) : item.label
    ctx.fillText(label, x, y + 6)

    // Bar Background
    const barY = y - 3
    const barH = 8
    roundRect(ctx, barX, barY, barWidth, barH, barH / 2)
    ctx.fillStyle = PALETTE.barBg
    ctx.fill()

    // Bar Fill
    const pct = Number(item.percentage ?? 0)
    if (pct > 0) {
      const fillWidth = Math.max(barH, (pct / 100) * barWidth)
      const fillGradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY)
      fillGradient.addColorStop(0, PALETTE.primaryLight)
      fillGradient.addColorStop(1, PALETTE.primary)
      roundRect(ctx, barX, barY, fillWidth, barH, barH / 2)
      ctx.fillStyle = fillGradient
      ctx.fill()
    } else {
      // 0% 状态：极简虚线
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(46, 125, 50, 0.25)' // 恢复绿色虚线
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(barX + 2, barY + barH / 2)
      ctx.lineTo(barX + barWidth - 2, barY + barH / 2)
      ctx.stroke()
      ctx.restore()
    }

    // Value
    ctx.textAlign = 'right'
    ctx.fillStyle = pct > 0 ? PALETTE.primary : PALETTE.textMuted // 恢复绿色数值
    ctx.font = `600 20px ${FONT}`
    ctx.fillText(pct > 0 ? `${Math.round(pct)}%` : '—', x + width, y + 6)

    y += rowHeight
  })

  return y - rowHeight + 32 // Adjust bottom margin
}

/* ---- 主生成函数 ---- */

export async function generateShareImage(result) {
  const { hero, share } = result
  const tags = getHighlightTags(result, 4)
  const dimensions = getHighlightDimensions(result, 4)
  const comparison = getPosterComparison(result)
  const quote = stripEndingPunctuation(getPosterQuote(result))

  const dpr = 2
  const width = 720
  const height = 1280 // 恢复固定高度 9:16

  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  drawBackground(ctx, width, height)

  const cardX = 28
  const cardY = 28
  const cardW = width - 56
  const cardH = height - 56
  const centerX = width / 2
  drawCardBackground(ctx, cardX, cardY, cardW, cardH, 32)

  let y = cardY + 48 // 恢复顶部留白

  /* 顶部 badge 标签 */
  y = drawTopBadge(ctx, '你的人格类型是', centerX, y)
  y += 32 // 压缩间距

  /* 英雄图片 */
  const heroSize = 260 // 稍微缩小图片以适应 1280 高度
  await drawHeroPanel(ctx, hero, centerX - heroSize / 2, y, heroSize, heroSize)
  y += heroSize + 32 // 压缩间距

  /* 中文主标题 */
  const hasNaturalHeroTitle = Boolean(hero?.data?.alias || hero?.data?.name || hero?.data?.title)
  const title = hasNaturalHeroTitle
    ? (stripEndingPunctuation(hero.title || '') || formatCode(hero.code))
    : (hero.title || formatCode(hero.code))
  const titleSize = fitTextSize(ctx, title, cardW - 80, 68, 42, 900)
  y += titleSize
  ctx.fillStyle = '#1a4d1e'  // 深绿色
  ctx.font = `900 ${titleSize}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(title, centerX, y)
  y += 16 // 压缩间距

  /* 英文代号 */
  const code = formatCode(hero.code)
  const codeSize = fitTextSize(ctx, code, cardW - 140, 22, 16, 700)
  y += codeSize
  ctx.fillStyle = '#5a8a5e'  // 带绿调的中灰
  ctx.font = `700 ${codeSize}px ${FONT}`
  ctx.letterSpacing = '0.22em'
  ctx.fillText(code, centerX, y)
  ctx.letterSpacing = '0px'
  y += 32 // 压缩间距

  /* 常规命中对比 */
  if (comparison) {
    y = drawComparisonPill(ctx, comparison, centerX, y, cardW - 120)
    y += 24 // 压缩间距
  }

  /* 引用语 */
  if (quote) {
    y = drawQuoteCard(ctx, quote, centerX, y, cardW - 80)
    y += 24 // 压缩间距
  }

  /* 标签 */
  if (tags && tags.length > 0) {
    y = drawTags(ctx, tags, centerX, y, cardW - 80)
    y += 50 // 增加标签与下方维度的间距，使维度分析整体下移
  }

  /* 维度图表 (极简列表风，保留绿色系) */
  if (dimensions && dimensions.length > 0) {
    y = drawDimensionList(ctx, dimensions, cardX + 48, y, cardW - 96)
  }

  /* 底部区域 (固定在卡片底部) */
  const footerHeight = 120
  const footerY = cardY + cardH - footerHeight - 16

  /* 分隔线 */
  ctx.strokeStyle = PALETTE.divider
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(cardX + 32, footerY)
  ctx.lineTo(cardX + cardW - 32, footerY)
  ctx.stroke()

  /* QR 码 */
  try {
    const qrUrl = window.location.href.split('?')[0]
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
    const qrImage = await resolveImage(qrDataUrl)
    if (qrImage) {
      /* QR 码圆角背景 */
      roundRect(ctx, cardX + 32, footerY + 24, 80, 80, 8)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      roundRect(ctx, cardX + 32, footerY + 24, 80, 80, 8)
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.drawImage(qrImage, cardX + 34, footerY + 26, 76, 76)
    }
  } catch (err) {
    console.error('Failed to generate QR code:', err)
  }

  /* footer 文字 */
  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.text
  ctx.font = `700 22px ${FONT}`
  ctx.fillText('扫码测测你是什么型', cardX + 132, footerY + 60)

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `400 16px ${FONT}`
  ctx.fillText(stripEndingPunctuation(share?.title || 'GBTI 股民人格测试'), cardX + 132, footerY + 88)

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
