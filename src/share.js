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

function drawTextLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight)
  })
}

/* ---- 浅色清新配色 ---- */

const PALETTE = {
  bgStart: '#f5f6f8',
  bgMid: '#f5f6f8',
  bgEnd: '#f5f6f8',
  primary: '#4CAF50',
  primaryLight: '#81C784',
  secondary: '#2196F3',
  secondaryLight: '#64B5F6',
  accent: '#FF9800',
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  cardBg: '#ffffff',
  cardBorder: 'rgba(0, 0, 0, 0.06)',
  tagBg: 'rgba(76, 175, 80, 0.1)',
  tagBorder: 'rgba(76, 175, 80, 0.2)',
  tagText: '#4CAF50',
  success: '#4CAF50',
  warning: '#FFC107',
}

/* ---- 绘制背景 ---- */

function drawBackground(ctx, width, height) {
  ctx.fillStyle = PALETTE.bgStart
  ctx.fillRect(0, 0, width, height)
}

/* ---- 绘制卡片背景 ---- */

function drawCardBackground(ctx, x, y, w, h, r = 28) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = PALETTE.cardBg
  ctx.fill()

  // 卡片边框
  roundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = PALETTE.cardBorder
  ctx.lineWidth = 1
  ctx.stroke()
}

/* ---- 绘制英雄图片面板 ---- */

async function drawHeroPanel(ctx, hero, x, y, width, height) {
  // 尝试加载英雄图片
  if (hero.image) {
    try {
      const image = await loadImage(hero.image)
      const scale = Math.min(width / image.width, height / image.height)
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      const drawX = x + (width - drawWidth) / 2
      const drawY = y + (height - drawHeight) / 2
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
      return
    } catch (error) {
      console.warn('Failed to draw hero image:', error)
    }
  }
}

/* ---- 绘制标签 ---- */

function drawTags(ctx, tags, x, y, maxWidth) {
  if (!tags || tags.length === 0) return y

  ctx.font = `700 14px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
  let currentX = x
  let currentY = y
  const tagHeight = 28
  const tagPadding = 12
  const tagGap = 8
  const lineGap = 10

  tags.slice(0, 6).forEach((tag) => {
    const text = typeof tag === 'string' ? tag : (tag.text || '')
    const textWidth = ctx.measureText(text).width
    const tagWidth = textWidth + tagPadding * 2

    if (currentX + tagWidth > x + maxWidth) {
      currentX = x
      currentY += tagHeight + lineGap
    }

    // 标签背景
    roundRect(ctx, currentX, currentY - tagHeight * 0.75, tagWidth, tagHeight, tagHeight / 2)
    ctx.fillStyle = PALETTE.tagBg
    ctx.fill()
    roundRect(ctx, currentX, currentY - tagHeight * 0.75, tagWidth, tagHeight, tagHeight / 2)
    ctx.strokeStyle = PALETTE.tagBorder
    ctx.lineWidth = 1
    ctx.stroke()

    // 标签文字
    ctx.fillStyle = PALETTE.primary
    ctx.textAlign = 'left'
    ctx.fillText(text, currentX + tagPadding, currentY)

    currentX += tagWidth + tagGap
  })

  return currentY + tagHeight + lineGap
}

/* ---- 绘制维度条形图 ---- */

function drawDimensionBars(ctx, dimensions, x, y, width, maxItems = 8) {
  if (!dimensions || dimensions.length === 0) return y

  const items = dimensions.slice(0, maxItems)
  const barHeight = 6
  const rowHeight = 28
  const labelWidth = 100

  items.forEach((item, index) => {
    const rowY = y + index * rowHeight

    // 标签
    ctx.fillStyle = PALETTE.textSecondary
    ctx.font = `600 12px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(item.label || item.id, x, rowY + barHeight)

    // 等级标签
    ctx.fillStyle = PALETTE.primaryLight
    ctx.font = `700 12px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(item.levelCode || '', x + width, rowY + barHeight)

    // 进度条背景
    const barX = x + labelWidth
    const barWidth = width - labelWidth - 30
    roundRect(ctx, barX, rowY, barWidth, barHeight, barHeight / 2)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.fill()

    // 进度条填充
    const fillWidth = (item.percentage / 100) * barWidth
    if (fillWidth > 0) {
      roundRect(ctx, barX, rowY, fillWidth, barHeight, barHeight / 2)
      ctx.fillStyle = PALETTE.primary
      ctx.fill()
    }
  })

  return y + items.length * rowHeight + 16
}

/* ---- 主生成函数 ---- */

export async function generateShareImage(result) {
  const { hero, share, sections } = result

  // 2倍分辨率，适合朋友圈分享
  const dpr = 2
  const width = 750   // 逻辑宽度（实际 1500px）
  const height = 1334 // 逻辑高度（实际 2668px），接近 9:16

  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  // ---- 1. 背景 ----
  drawBackground(ctx, width, height)

  // ---- 2. 主卡片 ----
  const cardX = 40
  const cardY = 40
  const cardW = width - 80
  const cardH = height - 80
  drawCardBackground(ctx, cardX, cardY, cardW, cardH, 28)

  let y = cardY + 60

  // ---- 3. 顶部标题 ----
  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.textSecondary
  ctx.font = `500 24px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillText('你的人格类型是：', width / 2, y)
  y += 60

  // ---- 4. 人格名称 ----
  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.text
  ctx.font = `900 64px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillText(hero.title || '', width / 2, y)
  y += 50

  // 代码
  ctx.fillStyle = PALETTE.primary
  ctx.font = `700 48px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillText(formatCode(hero.code), width / 2, y)
  y += 40

  // ---- 5. 英雄图片面板 ----
  const panelW = cardW - 120
  const panelH = panelW
  const panelX = cardX + 60
  await drawHeroPanel(ctx, hero, panelX, y, panelW, panelH)
  y += panelH + 40

  // ---- 6. 标语 ----
  if (hero.badge) {
    const badgeW = cardW - 80
    const badgeX = cardX + 40
    const badgeH = 80
    
    roundRect(ctx, badgeX, y, badgeW, badgeH, 12)
    ctx.fillStyle = '#f5f5f5'
    ctx.fill()

    ctx.fillStyle = PALETTE.textSecondary
    ctx.font = `500 24px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(hero.badge, badgeX + 24, y + 48)
    y += badgeH + 40
  }

  // ---- 7. 底部二维码区域 ----
  const footerY = cardY + cardH - 160
  
  // 底部分隔线
  ctx.strokeStyle = PALETTE.cardBorder
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cardX + 40, footerY)
  ctx.lineTo(cardX + cardW - 40, footerY)
  ctx.stroke()

  // 生成二维码
  try {
    const qrUrl = window.location.href.split('?')[0] // 获取当前页面URL，去掉参数
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 100,
      margin: 1,
      color: {
        dark: '#333333',
        light: '#ffffff'
      }
    })
    const qrImage = await loadImage(qrDataUrl)
    ctx.drawImage(qrImage, cardX + 40, footerY + 30, 100, 100)
  } catch (err) {
    console.error('Failed to generate QR code:', err)
  }

  // 二维码旁边的文字
  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.text
  ctx.font = `700 24px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillText('扫码测测你是什么型', cardX + 160, footerY + 70)
  
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = `500 20px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillText('GBTI · 股民人格测试', cardX + 160, footerY + 105)

  // ---- 8. 返回或下载 ----
  const dataUrl = canvas.toDataURL('image/png', 1.0)
  
  // 如果是开发环境，直接返回 dataUrl 供预览
  if (import.meta.env.DEV) {
    return dataUrl
  }

  // 生产环境触发下载
  const link = document.createElement('a')
  link.download = share.fileName || `GBTI-${hero.code}.png`
  link.href = dataUrl
  link.click()
  
  return dataUrl
}
