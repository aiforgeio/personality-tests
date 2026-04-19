import QRCode from 'qrcode'

import { getCachedImage, preloadImage } from './image-cache.js'
import {
  getHighlightDimensions,
  getHighlightTags,
  getPosterComparison,
  getPosterQuote,
} from './result-highlights.js'
import { formatCode, stripEndingPunctuation, toLines, toSmartLines, truncateWithEllipsis } from './utils.js'

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
  const lastVisible = visible[maxLines - 1] || ''
  const lastVisibleChars = Array.from(lastVisible)
  visible[maxLines - 1] = lastVisibleChars.length >= limit
    ? truncateWithEllipsis(lastVisible, limit)
    : `${lastVisible}…`
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

const HERO_SIZE = 260
const FOOTER_HEIGHT = 120
const FOOTER_BOTTOM_MARGIN = 16
const CONTENT_BOTTOM_GAP = 36
const QUOTE_LINE_LIMIT = 22
const QUOTE_LINE_HEIGHT = 36
const TAG_CHAR_LIMIT = 8
const TAG_HEIGHT = 38
const TAG_GAP = 12
const TAG_ROW_GAP = 12
const TAG_PADDING_X = 20
const DIMENSION_TITLE_GAP = 48
const DIMENSION_ROW_HEIGHT = 64
const DIMENSION_BOTTOM_PADDING = 32

const DEFAULT_POSTER_SPACING = {
  afterBadge: 32,
  afterHero: 32,
  afterTitle: 16,
  afterCode: 32,
  afterComparison: 24,
  afterQuote: 2,
  afterTags: 28,
}

const TIGHT_POSTER_SPACING = {
  afterBadge: 24,
  afterHero: 24,
  afterTitle: 12,
  afterCode: 24,
  afterComparison: 18,
  afterQuote: 2,
  afterTags: 20,
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

function drawTopBadge(ctx, text, centerX, y, maxWidth = 480) {
  const paddingX = 24
  const paddingY = 12
  const badgeH = 40
  let fontSize = 18
  let displayText = stripEndingPunctuation(text || '你的结果类型是')

  while (fontSize > 14) {
    ctx.font = `600 ${fontSize}px ${FONT}`
    if (ctx.measureText(displayText).width + paddingX * 2 <= maxWidth) {
      break
    }
    fontSize -= 1
  }

  if (ctx.measureText(displayText).width + paddingX * 2 > maxWidth) {
    const approxMaxChars = Math.max(8, Math.floor((maxWidth - paddingX * 2) / Math.max(fontSize, 1)))
    displayText = truncateWithEllipsis(displayText, approxMaxChars)
    ctx.font = `600 ${fontSize}px ${FONT}`
  }

  const textWidth = ctx.measureText(displayText).width
  const badgeW = Math.min(textWidth + paddingX * 2, maxWidth)

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
  ctx.font = `600 ${fontSize}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.letterSpacing = '0.12em'
  ctx.fillText(displayText, centerX + 1, y + paddingY + 15)
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

function drawQuoteCard(ctx, lines, centerX, y) {
  if (!lines.length) return y

  const height = lines.length * QUOTE_LINE_HEIGHT
  const quoteBottomPadding = 10

  /* 引用文字 - 居中、无边框、斜体 */
  ctx.fillStyle = PALETTE.textSecondary
  ctx.font = `italic 500 24px ${FONT}` // 放大字体
  ctx.textAlign = 'center'

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, y + 24 + index * QUOTE_LINE_HEIGHT)
  })

  return y + height + quoteBottomPadding
}

function buildTagRows(ctx, tags, maxWidth, { limit = 4 } = {}) {
  const visibleTags = tags
    .map((tag) => stripEndingPunctuation(tag))
    .filter(Boolean)
    .slice(0, limit)

  if (!visibleTags.length) return []

  ctx.font = `600 18px ${FONT}`

  const rows = []
  let row = []
  let rowWidth = 0

  visibleTags.forEach((text, index) => {
    const safeText = truncateWithEllipsis(text, TAG_CHAR_LIMIT)
    const width = ctx.measureText(safeText).width + TAG_PADDING_X * 2

    if (index === 2 || (row.length > 0 && rowWidth + width + TAG_GAP > maxWidth)) {
      rows.push(row)
      row = [{ text: safeText, width }]
      rowWidth = width
      return
    }

    row.push({ text: safeText, width })
    rowWidth += (row.length > 1 ? TAG_GAP : 0) + width
  })

  if (row.length > 0) rows.push(row)
  return rows.slice(0, 2)
}

function getTagRowsHeight(rows) {
  if (!rows.length) return 0
  return rows.length * TAG_HEIGHT + Math.max(rows.length - 1, 0) * TAG_ROW_GAP
}

function drawTags(ctx, rows, centerX, y) {
  if (!rows.length) return y

  let currentY = y
  rows.forEach((items) => {
    const totalWidth = items.reduce((sum, item, index) => sum + item.width + (index > 0 ? TAG_GAP : 0), 0)
    let currentX = centerX - totalWidth / 2

    items.forEach((item) => {
      roundRect(ctx, currentX, currentY, item.width, TAG_HEIGHT, TAG_HEIGHT / 2)
      ctx.fillStyle = PALETTE.tagBg
      ctx.fill()

      roundRect(ctx, currentX, currentY, item.width, TAG_HEIGHT, TAG_HEIGHT / 2)
      ctx.strokeStyle = PALETTE.tagBorder
      ctx.lineWidth = 0.8
      ctx.stroke()

      ctx.fillStyle = PALETTE.primary
      ctx.textAlign = 'center'
      ctx.fillText(item.text, currentX + item.width / 2, currentY + 25) // 调整文字垂直位置
      currentX += item.width + TAG_GAP
    })

    currentY += TAG_HEIGHT + TAG_ROW_GAP
  })

  return currentY - TAG_ROW_GAP
}

function drawComparisonPill(ctx, comparison, centerX, y, maxWidth) {
  if (!comparison) return y

  const rawTitle = comparison.title || comparison.code || ''
  if (!rawTitle) return y

  const title = truncateWithEllipsis(rawTitle, 10)
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
  if (!dimensions.length) return y

  // 标题
  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `600 18px ${FONT}`
  ctx.letterSpacing = '0.1em'
  ctx.fillText('核心维度分析', x, y)
  ctx.letterSpacing = '0px'
  y += DIMENSION_TITLE_GAP

  // 根据标签实际宽度动态计算 labelWidth，避免截断
  ctx.font = `500 20px ${FONT}`
  const labelGap = 16
  const measuredLabelWidth = dimensions.reduce((max, item) => {
    const w = ctx.measureText(item.label).width
    return w > max ? w : max
  }, 0)
  const labelWidth = Math.max(Math.ceil(measuredLabelWidth) + labelGap, 80)
  const valueWidth = 60
  const barX = x + labelWidth
  const barWidth = Math.max(width - labelWidth - valueWidth - 20, 40) // 20px padding, 最小40px

  dimensions.forEach((item) => {
    // Label
    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.text
    ctx.font = `500 20px ${FONT}`
    // Remove letters and numbers from the label
    const cleanLabel = item.label.replace(/[a-zA-Z0-9]/g, '').trim()
    ctx.fillText(cleanLabel, x, y + 6)

    // Bar Background
    const barY = y - 3
    const barH = 8
    roundRect(ctx, barX, barY, barWidth, barH, barH / 2)
    ctx.fillStyle = PALETTE.barBg
    ctx.fill()

    // Bar Fill — 始终显示进度条，最小宽度为 barH（圆角直径）
    const pct = Number(item.percentage ?? 0)
    const fillWidth = Math.max(barH, (pct / 100) * barWidth)
    const fillGradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY)
    fillGradient.addColorStop(0, PALETTE.primaryLight)
    fillGradient.addColorStop(1, PALETTE.primary)
    roundRect(ctx, barX, barY, fillWidth, barH, barH / 2)
    ctx.fillStyle = fillGradient
    ctx.fill()

    // Value — 始终显示百分比，不再用"—"代替
    ctx.textAlign = 'right'
    ctx.fillStyle = PALETTE.primary
    ctx.font = `600 20px ${FONT}`
    ctx.fillText(`${Math.round(pct)}%`, x + width, y + 6)

    y += DIMENSION_ROW_HEIGHT
  })

  return y - DIMENSION_ROW_HEIGHT + DIMENSION_BOTTOM_PADDING
}

function prepareDimensionItems(dimensions, { limit = 4 } = {}) {
  return dimensions.slice(0, limit).map((item) => ({
    ...item,
  }))
}

function getDimensionSectionHeight(items) {
  if (!items.length) return 0
  return DIMENSION_TITLE_GAP + DIMENSION_BOTTOM_PADDING + Math.max(items.length - 1, 0) * DIMENSION_ROW_HEIGHT
}

function measurePosterContent(ctx, {
  quote,
  tags,
  dimensions,
  comparison,
  title,
  code,
  cardY,
  cardW,
  spacing,
  quoteMaxLines,
  tagLimit,
  dimensionLimit,
}) {
  const quoteLines = quote ? toSmartLines(quote, QUOTE_LINE_LIMIT) : []
  const tagRows = buildTagRows(ctx, tags, cardW - 80, { limit: tagLimit })
  const dimensionItems = prepareDimensionItems(dimensions, { limit: dimensionLimit })
  const titleSize = fitTextSize(ctx, title, cardW - 80, 68, 42, 900)
  const codeSize = fitTextSize(ctx, code, cardW - 140, 22, 16, 700)

  let contentBottom = cardY + 48
  contentBottom += 40 + spacing.afterBadge
  contentBottom += HERO_SIZE + spacing.afterHero
  contentBottom += titleSize + spacing.afterTitle
  contentBottom += codeSize + spacing.afterCode

  if (comparison) {
    contentBottom += 30 + spacing.afterComparison
  }

  if (quoteLines.length) {
    contentBottom += quoteLines.length * QUOTE_LINE_HEIGHT + 24 + spacing.afterQuote
  }

  if (tagRows.length) {
    contentBottom += getTagRowsHeight(tagRows) + spacing.afterTags
  }

  if (dimensionItems.length) {
    contentBottom += getDimensionSectionHeight(dimensionItems)
  }

  return {
    quoteLines,
    tagRows,
    dimensionItems,
    titleSize,
    codeSize,
    contentBottom,
  }
}

function resolvePosterLayout(ctx, {
  quote,
  tags,
  dimensions,
  comparison,
  title,
  code,
  cardY,
  cardW,
  footerY,
}) {
  const layout = {
    quoteMaxLines: quote ? 3 : 0,
    tagLimit: Math.min(tags.length, 4),
    dimensionLimit: Math.min(dimensions.length, 6),
    spacing: DEFAULT_POSTER_SPACING,
  }

  const maxContentBottom = footerY - CONTENT_BOTTOM_GAP

  const measure = () => measurePosterContent(ctx, {
    quote,
    tags,
    dimensions,
    comparison,
    title,
    code,
    cardY,
    cardW,
    spacing: layout.spacing,
    quoteMaxLines: layout.quoteMaxLines,
    tagLimit: layout.tagLimit,
    dimensionLimit: layout.dimensionLimit,
  })

  let measured = measure()


  if (measured.contentBottom > maxContentBottom && layout.quoteMaxLines > 2) {
    layout.quoteMaxLines = 2
    measured = measure()
  }

  if (measured.contentBottom > maxContentBottom && layout.tagLimit > 3) {
    layout.tagLimit = 3
    measured = measure()
  }

  if (measured.contentBottom > maxContentBottom && layout.tagLimit > 2) {
    layout.tagLimit = 2
    measured = measure()
  }

  if (measured.contentBottom > maxContentBottom && layout.dimensionLimit > 6) {
    layout.dimensionLimit = 6
    measured = measure()
  }

  if (measured.contentBottom > maxContentBottom) {
    layout.spacing = TIGHT_POSTER_SPACING
    measured = measure()
  }

  return {
    ...layout,
    ...measured,
  }
}

function canvasToBlob(canvas, type = 'image/png', quality = 1.0) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      reject(new Error('Failed to create poster blob'))
    }, type, quality)
  })
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = fileName
  link.href = objectUrl
  link.click()
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 1000)
}

/* ---- 主生成函数 ---- */

export async function generateShareImage(result, {
  output = 'download',
  forceDataUrl = false,
  fileName = '',
} = {}) {
  const { hero, share } = result
  const outputMode = forceDataUrl ? 'data-url' : output

  const tags = getHighlightTags(result, 4)
  const dimensions = getHighlightDimensions(result, 6)
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
  const footerY = cardY + cardH - FOOTER_HEIGHT - FOOTER_BOTTOM_MARGIN
  drawCardBackground(ctx, cardX, cardY, cardW, cardH, 32)

  const headerBadgeText = stripEndingPunctuation(share?.headerBadgeText || '你的结果类型是')
  const canonicalUrl = share?.url || (typeof window !== 'undefined' ? window.location.href.split('?')[0] : '')
  const footerQrLabel = truncateWithEllipsis(share?.qrLabel || '扫码测测你是什么型', 16)
  const footerTitle = truncateWithEllipsis(share?.title || '人格测试', 22)

  const hasNaturalHeroTitle = Boolean(hero?.data?.alias || hero?.data?.name || hero?.data?.title)
  const title = hasNaturalHeroTitle
    ? (stripEndingPunctuation(hero.title || '') || formatCode(hero.code))
    : (hero.title || formatCode(hero.code))
  const code = formatCode(hero.code)
  const posterLayout = resolvePosterLayout(ctx, {
    quote,
    tags,
    dimensions,
    comparison,
    title,
    code,
    cardY,
    cardW,
    footerY,
  })

  let y = cardY + 48 // 恢复顶部留白

  /* 顶部 badge 标签 */
  y = drawTopBadge(ctx, headerBadgeText, centerX, y, cardW - 80)
  y += posterLayout.spacing.afterBadge

  /* 英雄图片 */
  await drawHeroPanel(ctx, hero, centerX - HERO_SIZE / 2, y, HERO_SIZE, HERO_SIZE)
  y += HERO_SIZE + posterLayout.spacing.afterHero

  /* 中文主标题 */
  y += posterLayout.titleSize
  ctx.fillStyle = '#1a4d1e'  // 深绿色
  ctx.font = `900 ${posterLayout.titleSize}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(title, centerX, y)
  y += posterLayout.spacing.afterTitle

  /* 英文代号 */
  y += posterLayout.codeSize
  ctx.fillStyle = '#5a8a5e'  // 带绿调的中灰
  ctx.font = `700 ${posterLayout.codeSize}px ${FONT}`
  ctx.letterSpacing = '0.22em'
  ctx.fillText(code, centerX, y)
  ctx.letterSpacing = '0px'
  y += posterLayout.spacing.afterCode

  /* 常规命中对比 */
  if (comparison) {
    y = drawComparisonPill(ctx, comparison, centerX, y, cardW - 120)
    y += posterLayout.spacing.afterComparison
  }

  /* 引用语 */
  if (posterLayout.quoteLines.length) {
    y = drawQuoteCard(ctx, posterLayout.quoteLines, centerX, y)
    y += posterLayout.spacing.afterQuote
  }

  /* 标签 */
  if (posterLayout.tagRows.length) {
    y = drawTags(ctx, posterLayout.tagRows, centerX, y)
    y += posterLayout.spacing.afterTags
  }

  /* 维度图表 (极简列表风，保留绿色系) */
  if (posterLayout.dimensionItems.length) {
    y = drawDimensionList(ctx, posterLayout.dimensionItems, cardX + 48, y, cardW - 96)
  }

  /* 分隔线 */
  ctx.strokeStyle = PALETTE.divider
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(cardX + 32, footerY)
  ctx.lineTo(cardX + cardW - 32, footerY)
  ctx.stroke()

  /* QR 码 */
  try {
    const qrDataUrl = await QRCode.toDataURL(canonicalUrl, {
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
  ctx.fillText(footerQrLabel, cardX + 132, footerY + 60)

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `400 16px ${FONT}`
  ctx.fillText(footerTitle, cardX + 132, footerY + 88)

  const resolvedFileName = fileName || share.fileName || `test-result-${hero.code}.png`

  if (outputMode === 'data-url') {
    return {
      dataUrl: canvas.toDataURL('image/png', 1.0),
      fileName: resolvedFileName,
    }
  }

  const blob = await canvasToBlob(canvas)

  if (outputMode === 'blob') {
    return {
      blob,
      fileName: resolvedFileName,
    }
  }

  if (outputMode === 'download') {
    downloadBlob(blob, resolvedFileName)
    return {
      blob,
      fileName: resolvedFileName,
    }
  }

  throw new Error(`Unsupported share image output mode: ${outputMode}`)
}
