import { describe, expect, test } from 'bun:test'
import { removeConnectedBorderColor } from '../src/lib/background-removal'
import { DEFAULT_BRAND } from '../src/lib/brand'
import { buildBusinessDocument, calculateBusinessDocumentTotals } from '../src/lib/design/business-documents'
import { composeFlyerDoc } from '../src/lib/design/flyer-layout'
import { CANVAS_PRESETS } from '../src/lib/design/types'
import { docToSvg } from '../src/lib/design/svg'

describe('background removal fallback', () => {
  test('removes an edge-connected solid white background but keeps the enclosed red subject', () => {
    const width = 12
    const height = 12
    const pixels = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const subject = x >= 4 && x <= 7 && y >= 3 && y <= 8
        pixels[i] = subject ? 220 : 255
        pixels[i + 1] = subject ? 20 : 255
        pixels[i + 2] = subject ? 30 : 255
        pixels[i + 3] = 255
      }
    }
    const result = removeConnectedBorderColor(pixels, width, height, 45)
    const corner = 0
    const subject = (5 * width + 5) * 4
    expect(result.data[corner + 3]).toBe(0)
    expect(result.data[subject + 3]).toBe(255)
    expect(result.removedPixels).toBeGreaterThan(80)
    expect(result.backgroundColor).toEqual({ r: 255, g: 255, b: 255 })
  })

  test('rejects a pixel buffer with dimensions that do not match', () => {
    expect(() => removeConnectedBorderColor(new Uint8Array(8), 2, 2)).toThrow('Pixel buffer size')
  })
})

describe('business document totals and pagination', () => {
  test('calculates quantity, discount, delivery and outstanding balance', () => {
    const result = calculateBusinessDocumentTotals({
      items: [
        { description: 'Inverter', quantity: '2', unitPrice: '150000' },
        { description: 'Cable', quantity: '3', unitPrice: '5000' },
      ],
      discount: '10000',
      tax: '0',
      deliveryFee: '5000',
      amountPaid: '200000',
    })
    expect(result.subtotal).toBe(315000)
    expect(result.total).toBe(310000)
    expect(result.amountPaid).toBe(200000)
    expect(result.balance).toBe(110000)
  })

  test('splits a long item list into editable A4 pages and keeps customer and shipping data', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      description: `Product ${i + 1}`, quantity: '1', unitPrice: String((i + 1) * 1000),
    }))
    const doc = buildBusinessDocument({
      kind: 'receipt', documentNumber: 'RCT-TEST-01', issueDate: '2026-10-29', dueDate: '',
      customerName: 'Amina Customer', customerPhone: '08000000000', customerEmail: '', customerAddress: 'No 4 Market Road',
      destinationCityState: 'Kano, Kano State', subject: '', body: '', items, discount: '', tax: '', deliveryFee: '2500',
      amountPaid: '12000', paymentMethod: 'Bank transfer', deliveryMethod: 'Waybill', shippingReference: 'WB123',
      notes: 'Handle with care', signerName: 'Sales Desk', footerNote: '',
    }, DEFAULT_BRAND, null)
    expect(doc.width).toBe(CANVAS_PRESETS['a4-portrait'].width)
    expect(doc.pages.length).toBe(3)
    expect(doc.meta?.type).toBe('document')
    const names = doc.pages.flatMap((page) => page.elements.map((element) => element.name ?? ''))
    expect(names).toContain('Customer name')
    expect(names).toContain('Delivery and payment info')
    expect(names).toContain('Balance due')
  })
})

describe('flyer image layout and SVG image references', () => {
  test('gallery photos have no separate opaque photo-frame background', () => {
    const result = composeFlyerDoc({
      headline: 'Product showcase', products: [], extraImages: ['data:image/png;base64,AA=='],
      style: 'catalogue', showLogo: false, showAddress: false, showDescription: false,
    }, { width: 794, height: 1123, presetId: 'a4-portrait' }, DEFAULT_BRAND)
    const images = result.doc.pages[0].elements.filter((element) => element.name === 'Photo 1')
    const frame = result.doc.pages[0].elements.find((element) => element.name === 'Photo frame 1')
    expect(images.length).toBe(1)
    expect(images[0].radius).toBe(0)
    expect(frame).toBeUndefined()
  })

  test('XML-escapes href values in rendered images', () => {
    const doc = {
      version: 1, width: 100, height: 100, background: null,
      pages: [{ id: 'page', name: 'page', background: null, elements: [{
        id: 'image', type: 'image', x: 0, y: 0, w: 80, h: 80, src: 'https://example.test/image.png?x=1&y=2',
      }] }],
    }
    const svg = docToSvg(doc, { palette: DEFAULT_BRAND.palette })
    expect(svg).toContain('x=1&amp;y=2')
    expect(svg).not.toContain('x=1&y=2')
  })
})

describe('custom printable documents and selective official-logo replacement', () => {
  test('builds a multi-page custom document with the owner-provided title, text and signature', () => {
    const body = Array.from({ length: 90 }, (_, i) => `Custom paragraph line ${i + 1} with printable business information.`).join('\\n')
    const doc = buildBusinessDocument({
      kind: 'custom', documentNumber: 'DOC-20261029-001', issueDate: '2026-10-29', dueDate: '',
      customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', destinationCityState: '',
      subject: 'Important business notice', body, items: [], discount: '', tax: '', deliveryFee: '', amountPaid: '',
      paymentMethod: '', deliveryMethod: '', shippingReference: '', notes: '', signerName: 'Owner', footerNote: 'Official notice',
    }, DEFAULT_BRAND, null)
    expect(doc.pages.length).toBeGreaterThan(1)
    const names = doc.pages.flatMap((page) => page.elements.map((element) => element.name || ''))
    expect(names).toContain('Document title')
    expect(names).toContain('Document signature')
    expect(doc.meta.notes).toContain('Custom Document')
  })

  test('updates only explicit logo placeholders and leaves other artwork unchanged', async () => {
    const { fillLogoPlaceholders } = await import('../src/lib/design/logo-resolver')
    const original = {
      version: 1, width: 100, height: 100, background: null,
      pages: [{ id: 'p', name: 'p', background: null, elements: [
        { id: 'marked', type: 'image', name: 'Logo placeholder', meta: { placeholder: 'logo' }, src: 'data:image/png;base64,b2xk', x: 0, y: 0, w: 20, h: 20 },
        { id: 'photo', type: 'image', name: 'Product photo', src: 'data:image/png;base64,cGhvdG8=', x: 20, y: 0, w: 20, h: 20 },
      ] }],
    }
    const replaced = fillLogoPlaceholders(original, 'data:image/png;base64,bmV3', true)
    expect(replaced.pages[0].elements[0].src).toBe('data:image/png;base64,bmV3')
    expect(replaced.pages[0].elements[1].src).toBe('data:image/png;base64,cGhvdG8=')
    expect(fillLogoPlaceholders(original, 'data:image/png;base64,bmV3', false)).toBe(original)
  })
})


  test('transparent product images do not sit on an opaque photo-card background', () => {
    const result = composeFlyerDoc({
      headline: 'Solar offer',
      products: [{ name: 'Solar Panel', imageDataUrl: 'data:image/png;base64,AA==', price: '45000', availability: 'In Stock' }],
      extraImages: [], style: 'catalogue', showLogo: false, showAddress: false, showDescription: false,
    }, { width: 794, height: 1123, presetId: 'a4-portrait' }, DEFAULT_BRAND)
    const page = result.doc.pages[0]
    const photo = page.elements.find((element) => element.name === 'Solar Panel image')
    const info = page.elements.find((element) => element.name === 'Product info panel')
    expect(photo).toBeDefined()
    expect(info).toBeDefined()
    expect(info.y).toBeGreaterThan(photo.y)
    expect(page.elements.some((element) => element.name === 'Product card')).toBe(false)
  })
