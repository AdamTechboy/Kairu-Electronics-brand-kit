export interface BackgroundRemovalResult {
  data: Uint8Array
  removedPixels: number
  backgroundColor: { r: number; g: number; b: number }
}

/**
 * Removes a flat background connected to the image edge. Used as a fallback
 * when an image-edit model returns an opaque image instead of alpha.
 *
 * This is deliberately conservative: it will not remove similarly coloured
 * pixels inside an enclosed subject, and the UI warns users to use a clear,
 * high-contrast source image for best results.
 */
export function removeConnectedBorderColor(
  input: Uint8Array,
  width: number,
  height: number,
  tolerance = 52
): BackgroundRemovalResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Invalid image dimensions.')
  if (input.length !== width * height * 4) throw new Error('Pixel buffer size does not match the image dimensions.')
  const total = width * height
  const stride = Math.max(1, Math.floor(Math.max(width, height) / 160))
  const border: number[][] = []
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4
    if (input[i + 3] > 0) border.push([input[i], input[i + 1], input[i + 2]])
  }
  for (let x = 0; x < width; x += stride) { sample(x, 0); if (height > 1) sample(x, height - 1) }
  for (let y = stride; y < height - 1; y += stride) { sample(0, y); if (width > 1) sample(width - 1, y) }
  if (!border.length) return { data: input.slice(), removedPixels: 0, backgroundColor: { r: 255, g: 255, b: 255 } }

  const median = (channel: number) => {
    const sorted = border.map((p) => p[channel]).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  const bg = { r: median(0), g: median(1), b: median(2) }
  const nearBg = new Uint8Array(total)
  for (let p = 0; p < total; p += 1) {
    const i = p * 4
    if (input[i + 3] === 0) { nearBg[p] = 1; continue }
    const dr = input[i] - bg.r
    const dg = input[i + 1] - bg.g
    const db = input[i + 2] - bg.b
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance) nearBg[p] = 1
  }

  const removed = new Uint8Array(total)
  const queue = new Int32Array(total)
  let start = 0
  let end = 0
  const seed = (p: number) => {
    if (nearBg[p] && !removed[p]) { removed[p] = 1; queue[end++] = p }
  }
  for (let x = 0; x < width; x += 1) { seed(x); seed((height - 1) * width + x) }
  for (let y = 0; y < height; y += 1) { seed(y * width); seed(y * width + width - 1) }

  while (start < end) {
    const p = queue[start++]
    const x = p % width
    const y = Math.floor(p / width)
    if (x > 0) seed(p - 1)
    if (x + 1 < width) seed(p + 1)
    if (y > 0) seed(p - width)
    if (y + 1 < height) seed(p + width)
  }

  const output = input.slice()
  let removedPixels = 0
  for (let p = 0; p < total; p += 1) {
    const i = p * 4
    if (removed[p]) {
      output[i + 3] = 0
      removedPixels += 1
      continue
    }
    // Feather edge pixels whose antialias colour is still close to the matte.
    const x = p % width
    const y = Math.floor(p / width)
    const edge = (x > 0 && removed[p - 1]) || (x + 1 < width && removed[p + 1]) ||
      (y > 0 && removed[p - width]) || (y + 1 < height && removed[p + width])
    if (!edge || output[i + 3] === 0) continue
    const dr = output[i] - bg.r
    const dg = output[i + 1] - bg.g
    const db = output[i + 2] - bg.b
    const distance = Math.sqrt(dr * dr + dg * dg + db * db)
    if (distance < tolerance * 1.8) {
      const opacity = Math.max(0.16, Math.min(1, (distance - tolerance * 0.45) / (tolerance * 1.35)))
      output[i + 3] = Math.round(output[i + 3] * opacity)
    }
  }
  return { data: output, removedPixels, backgroundColor: bg }
}
