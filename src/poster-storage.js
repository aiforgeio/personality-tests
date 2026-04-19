const POSTER_SESSION_PREFIX = 'poster-save:'

function createPosterToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `poster-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getPosterSessionKey(token) {
  return `${POSTER_SESSION_PREFIX}${String(token || '')}`
}

function getSessionStorage() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    throw new Error('Poster session storage is unavailable')
  }

  return window.sessionStorage
}

export function cleanupPosterSessions({ keepTokens = [] } = {}) {
  if (typeof window === 'undefined' || !window.sessionStorage) return

  const storage = window.sessionStorage
  const keepKeys = new Set(
    keepTokens
      .filter(Boolean)
      .map((token) => getPosterSessionKey(token)),
  )

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (!key || !key.startsWith(POSTER_SESSION_PREFIX) || keepKeys.has(key)) continue
    storage.removeItem(key)
  }
}

export function createPosterSession(payload = {}) {
  const storage = getSessionStorage()
  cleanupPosterSessions()

  const token = createPosterToken()
  const record = JSON.stringify({
    ...payload,
    createdAt: Date.now(),
  })

  storage.setItem(getPosterSessionKey(token), record)
  return token
}

export function readPosterSession(token) {
  if (!token || typeof window === 'undefined' || !window.sessionStorage) return null

  const storage = window.sessionStorage
  const key = getPosterSessionKey(token)
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch (error) {
    storage.removeItem(key)
    return null
  }
}

export function removePosterSession(token) {
  if (!token || typeof window === 'undefined' || !window.sessionStorage) return
  window.sessionStorage.removeItem(getPosterSessionKey(token))
}

export function resolvePosterPageUrl(token) {
  if (typeof window === 'undefined') {
    return `/poster/?token=${encodeURIComponent(String(token || ''))}`
  }

  const url = new URL('../poster/', window.location.href)
  url.searchParams.set('token', String(token || ''))
  return url.toString()
}

export function resolvePosterHomeUrl() {
  if (typeof window === 'undefined') return '/'
  return new URL('../', window.location.href).toString()
}

export function isWeChatBrowser(userAgent = '') {
  const source = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /MicroMessenger/i.test(source)
}
