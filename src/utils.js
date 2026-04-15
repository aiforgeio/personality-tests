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

export function formatCode(code) {
  return String(code || '').replace(/_/g, ' ')
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
