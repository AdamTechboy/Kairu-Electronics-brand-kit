// Client-side media helpers: validated, compressed uploads + category symbols.

export interface CompressedImage {
  dataUrl: string
  width: number
  height: number
  mimeType: string
  size: number
}

const MAX_BYTES = 6 * 1024 * 1024

export async function compressImageFile(file: File, maxPx = 1600, quality = 0.86): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG or WebP).')
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('That image is very large (over 20 MB). Please choose a smaller photo.')
  }

  const dataUrl = await readAsDataUrl(file)

  // SVG (or any vector-ish source): rasterise through <img> for safety
  const img = await loadImage(dataUrl)
  let { width, height } = img
  const scale = Math.min(1, maxPx / Math.max(width, height))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // white matte for JPEG; keep transparency for PNG/WebP
  if (file.type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(img, 0, 0, width, height)

  const keepPng = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml'
  const outMime = keepPng ? 'image/png' : 'image/jpeg'
  let outUrl = canvas.toDataURL(outMime, quality)

  // if still huge, step down quality/size
  let q = quality
  let dims = { width, height }
  while (approxBytes(outUrl) > MAX_BYTES && Math.max(dims.width, dims.height) > 700) {
    dims = { width: Math.round(dims.width * 0.8), height: Math.round(dims.height * 0.8) }
    canvas.width = dims.width
    canvas.height = dims.height
    ctx.clearRect(0, 0, dims.width, dims.height)
    if (outMime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, dims.width, dims.height)
    }
    ctx.drawImage(img, 0, 0, dims.width, dims.height)
    q = Math.max(0.6, q - 0.12)
    outUrl = canvas.toDataURL(outMime, q)
  }

  return {
    dataUrl: outUrl,
    width: dims.width,
    height: dims.height,
    mimeType: outMime,
    size: approxBytes(outUrl),
  }
}

function approxBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file could not be read as an image'))
    img.src = src
  })
}

// Map a product category to a sensible vector symbol fallback
export function symbolCategoryFallback(category: string): string {
  const c = category.toLowerCase()
  if (c.includes('solar panel')) return 'solar-panel'
  if (c.includes('inverter')) return 'inverter'
  if (c.includes('batter')) return 'battery'
  if (c.includes('television') || c.includes('tv')) return 'tv'
  if (c.includes('fridge') || c.includes('refriger')) return 'fridge'
  if (c.includes('fan')) return 'fan'
  if (c.includes('solar')) return 'sun-half'
  return 'tv'
}

/**
 * Centre-crop an image to an exact aspect ratio (w/h) so it fills a frame
 * edge-to-edge without any hidden, unexpectedly cut-off area.
 * Returns the original data-url when the ratio already matches.
 */
export async function cropToAspect(dataUrl: string, aspect: number, maxPx = 1400): Promise<string> {
  if (!Number.isFinite(aspect) || aspect <= 0) return dataUrl
  const img = await loadImage(dataUrl)
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return dataUrl
  const cur = iw / ih
  if (Math.abs(cur - aspect) < 0.01) return dataUrl
  let sw = iw
  let sh = ih
  let sx = 0
  let sy = 0
  if (cur > aspect) {
    sw = ih * aspect
    sx = (iw - sw) / 2
  } else {
    sh = iw / aspect
    sy = (ih - sh) / 2
  }
  const scale = Math.min(1, maxPx / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  const keepPng = dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/webp') || dataUrl.startsWith('data:image/svg')
  return keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88)
}
