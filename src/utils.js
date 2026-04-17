export async function loadJSON(path) {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`)
  }
  return res.json()
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function toKey(value) {
  return String(value ?? '')
}

export function formatCode(code) {
  return String(code || '').replace(/_/g, ' ')
}

export function stripEndingPunctuation(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  return text
    .replace(/[。！？?!…，,；;：:]+(?:[”’"'）)\]】》」』]+)?$/u, '')
    .trim()
}

export function compactCardText(value, maxChars = 26) {
  const cleaned = stripEndingPunctuation(value)
  if (!cleaned) return ''

  const chars = Array.from(cleaned)
  if (chars.length <= maxChars) return cleaned

  return stripEndingPunctuation(chars.slice(0, maxChars).join('').trim())
}

export function truncateWithEllipsis(value, maxChars = 26) {
  const cleaned = stripEndingPunctuation(value)
  if (!cleaned) return ''
  if (maxChars <= 0) return ''
  if (maxChars === 1) return '…'

  const chars = Array.from(cleaned)
  if (chars.length <= maxChars) return cleaned

  return `${chars.slice(0, maxChars - 1).join('').trim()}…`
}

export function toLines(text, limit = 22) {
  if (!text) return []
  const chars = Array.from(text)
  const lines = []
  let current = ''

  for (const char of chars) {
    const next = current + char
    if (next.length > limit && current) {
      lines.push(current)
      current = char
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines
}

export function toSmartLines(text, maxLineChars = 22) {
  if (!text) return []
  const chars = Array.from(text)
  
  // 如果文本长度小于等于单行限制，直接返回单行
  if (chars.length <= maxLineChars) {
    return [text]
  }

  // 寻找中间附近的标点断点
  const midpoint = Math.floor(chars.length / 2)
  const punctuation = new Set(['，', '。', '、', '！', '？', '；', '：', '—', '…', ',', '.', '!', '?', ';', ':'])
  
  let bestBreak = -1
  
  // 从中间向两边搜索最近的标点
  for (let offset = 0; offset <= midpoint; offset++) {
    // 向右找
    if (midpoint + offset < chars.length && punctuation.has(chars[midpoint + offset])) {
      bestBreak = midpoint + offset + 1
      break
    }
    // 向左找
    if (midpoint - offset >= 0 && punctuation.has(chars[midpoint - offset])) {
      bestBreak = midpoint - offset + 1
      break
    }
  }
  
  // 如果没找到标点，在中间位置硬切
  if (bestBreak === -1) {
    bestBreak = midpoint
  }
  
  const line1 = chars.slice(0, bestBreak).join('').trim()
  const line2 = chars.slice(bestBreak).join('').trim()
  
  return [line1, line2].filter(Boolean)
}

export function getByPath(source, path, fallback = undefined) {
  if (!path) return fallback

  const value = path.split('.').reduce((current, segment) => {
    if (current == null) return undefined
    return current[segment]
  }, source)

  return value === undefined ? fallback : value
}

export function groupAdjacentBy(list, getKey) {
  const groups = []

  list.forEach((item) => {
    const key = getKey(item)
    const last = groups[groups.length - 1]

    if (last && last.key === key) {
      last.items.push(item)
      return
    }

    groups.push({ key, items: [item] })
  })

  return groups
}

function normalizeBaseUrl(baseUrl = '') {
  const rawBase = String(
    baseUrl
    || (typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL : '')
    || '/',
  ).trim()

  if (!rawBase || rawBase === '/') {
    return '/'
  }

  const withLeadingSlash = rawBase.startsWith('/') ? rawBase : `/${rawBase}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function trimPathSegment(value) {
  return String(value ?? '').replace(/^\/+|\/+$/g, '')
}

export function resolveCanonicalTestPath(test, { baseUrl = '' } = {}) {
  const testId = trimPathSegment(typeof test === 'string' ? test : test?.id)
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const baseSegment = trimPathSegment(normalizedBaseUrl)
  const joined = [baseSegment, testId].filter(Boolean).join('/')

  return joined ? `/${joined}/` : '/'
}

export function resolveCanonicalTestUrl(test, { baseUrl = '', origin = '' } = {}) {
  const path = resolveCanonicalTestPath(test, { baseUrl })
  const resolvedOrigin = String(
    origin
    || (typeof window !== 'undefined' ? window.location?.origin : '')
    || '',
  ).trim()

  if (!resolvedOrigin) {
    return path
  }

  return new URL(path, `${resolvedOrigin}/`).toString()
}
