// Client-side media helpers: validated, compressed uploads + category symbols.

export interface CompressedImage {
  dataUrl: string
  width: number
  height: number
  mimeType: string
  size: number
}

const MAX_BYTES = 6 * 1024 * 1024

export async function compressImageFile(file: File, maxPx = 1600, quality = 0.86, maxBytes = MAX_BYTES): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (PNG, JPG or WebP).')
  if (file.size > 20 * 1024 * 1024) throw new Error('That image is very large (over 20 MB). Please choose a smaller photo.')

  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)
  const originalWidth = img.naturalWidth || img.width
  const originalHeight = img.naturalHeight || img.height
  if (!originalWidth || !originalHeight) throw new Error('The selected image has no readable dimensions.')
  const scale = Math.min(1, maxPx / Math.max(originalWidth, originalHeight))
  let dims = { width: Math.max(1, Math.round(originalWidth * scale)), height: Math.max(1, Math.round(originalHeight * scale)) }
  let canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not prepare this image.')

  const vectorSource = file.type === 'image/svg+xml'
  const inspectAlpha = !['image/jpeg', 'image/jpg'].includes(file.type)
  let hasTransparency = vectorSource
  const draw = (width: number, height: number, mime: string) => {
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser could not prepare this image.')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)
    return ctx
  }

  const ctx2 = draw(dims.width, dims.height, 'image/png')
  if (inspectAlpha && !vectorSource) {
    try {
      const pixels = ctx2.getImageData(0, 0, dims.width, dims.height).data
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 255) { hasTransparency = true; break }
      }
    } catch {
      // Preserve alpha when pixel inspection is blocked; never flatten unknown transparency.
      hasTransparency = true
    }
  }

  // PNG photos with alpha can be much larger than their visual content needs.
  // WebP keeps transparency while compressing product cutouts much more efficiently.
  // Keep SVG rasterisations lossless, and use JPEG for opaque photographs.
  let outMime = vectorSource ? 'image/png' : hasTransparency ? 'image/webp' : 'image/jpeg'
  let q = quality
  const encode = () => {
    if (outMime === 'image/png') return canvas.toDataURL('image/png')
    const encoded = canvas.toDataURL(outMime, q)
    // Older browsers can silently fall back to PNG for an unsupported WebP encoder.
    if (outMime === 'image/webp' && !encoded.startsWith('data:image/webp')) {
      outMime = 'image/png'
      return canvas.toDataURL('image/png')
    }
    return encoded
  }
  let outUrl = encode()

  while (approxBytes(outUrl) > maxBytes && Math.max(dims.width, dims.height) > 320) {
    dims = { width: Math.max(1, Math.round(dims.width * 0.78)), height: Math.max(1, Math.round(dims.height * 0.78)) }
    draw(dims.width, dims.height, outMime)
    q = Math.max(0.38, q - 0.1)
    outUrl = encode()
  }
  if (approxBytes(outUrl) > maxBytes) {
    throw new Error(`This image is still too large after compression (${Math.round(approxBytes(outUrl) / 1024)} KB). Try a smaller photo or crop it before uploading.`)
  }
  return { dataUrl: outUrl, width: dims.width, height: dims.height, mimeType: outMime, size: approxBytes(outUrl) }
}
function approxBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4)
}

export async function compressImageDataUrl(dataUrl: string, fileName = 'image.png', maxPx = 1000, quality = 0.82, maxBytes = 300_000): Promise<CompressedImage> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const type = blob.type || (dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg')
  const file = new File([blob], fileName, { type })
  return compressImageFile(file, maxPx, quality, maxBytes)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

/** Verify that a stored/uploaded image data URL is decodable before placing it on a design. */
export async function validateImageDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  if (!/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/i.test(dataUrl)) {
    throw new Error('The photo is not a supported PNG, JPG, WebP or SVG image.')
  }
  const image = await loadImage(dataUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) throw new Error('The photo decoded without usable dimensions. Please upload it again.')
  return { width, height }
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
