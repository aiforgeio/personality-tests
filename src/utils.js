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
