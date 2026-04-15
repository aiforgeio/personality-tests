const imagePromises = new Map()
const imageElements = new Map()

function applyImageOptions(image, options = {}) {
  image.crossOrigin = 'anonymous'
  image.loading = 'eager'

  if (options.decoding) {
    image.decoding = options.decoding
  }

  if (options.fetchPriority) {
    try {
      image.fetchPriority = options.fetchPriority
    } catch (error) {
      // Older Safari versions may not support fetchPriority.
    }
  }
}

async function decodeIfPossible(image) {
  if (typeof image.decode !== 'function') return image

  try {
    await image.decode()
  } catch (error) {
    // Some browsers reject decode() for already-decoded or cached images.
  }

  return image
}

export function getCachedImage(src) {
  if (!src) return null
  return imageElements.get(src) || null
}

export function preloadImage(src, options = {}) {
  if (!src) {
    return Promise.resolve(null)
  }

  const cachedImage = getCachedImage(src)
  if (cachedImage?.complete && cachedImage.naturalWidth > 0) {
    return Promise.resolve(cachedImage)
  }

  if (imagePromises.has(src)) {
    return imagePromises.get(src)
  }

  const promise = new Promise((resolve, reject) => {
    const image = new Image()
    applyImageOptions(image, options)

    const settle = async () => {
      imageElements.set(src, image)
      await decodeIfPossible(image)
      resolve(image)
    }

    image.onload = () => {
      void settle()
    }

    image.onerror = () => {
      imagePromises.delete(src)
      reject(new Error(`Failed to preload image: ${src}`))
    }

    image.src = src

    if (image.complete && image.naturalWidth > 0) {
      void settle()
    }
  })

  imagePromises.set(src, promise)
  return promise
}

export function preloadImages(urls, options = {}) {
  const tasks = (Array.isArray(urls) ? urls : [])
    .filter(Boolean)
    .map((url) => preloadImage(url, options).catch(() => null))

  return Promise.all(tasks)
}

export async function preloadImageWithTimeout(src, timeoutMs = 400, options = {}) {
  if (!src) return null

  const imagePromise = preloadImage(src, options)
  const timeoutPromise = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), timeoutMs)
  })

  return Promise.race([imagePromise, timeoutPromise]).catch(() => null)
}
