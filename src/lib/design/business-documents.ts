import { formatNaira, type BrandSettings } from '@/lib/brand'
import { el, newPage, type DesignDocument, type DesignElement } from '@/lib/design/types'

export type BusinessDocumentKind = 'letter' | 'custom' | 'invoice' | 'receipt' | 'quotation' | 'delivery-note'

export interface BusinessDocumentItem {
  description: string
  quantity: string
  unitPrice: string
}

export interface BusinessDocumentInput {
  kind: BusinessDocumentKind
  documentNumber: string
  issueDate: string
  dueDate: string
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  destinationCityState: string
  subject: string
  body: string
  items: BusinessDocumentItem[]
  discount: string
  tax: string
  deliveryFee: string
  amountPaid: string
  paymentMethod: string
  deliveryMethod: string
  shippingReference: string
  notes: string
  signerName: string
  footerNote: string
}

export const BUSINESS_DOCUMENT_LABELS: Record<BusinessDocumentKind, string> = {
  letter: 'Letter',
  custom: 'Custom Document',
  invoice: 'Invoice',
  receipt: 'Receipt',
  quotation: 'Quotation',
  'delivery-note': 'Delivery Note',
}

export function parseMoney(value: string | number | undefined): number {
  const raw = String(value ?? '').replace(/[^\d.\-]/g, '')
  const amount = Number(raw)
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

export function calculateBusinessDocumentTotals(input: Pick<BusinessDocumentInput, 'items' | 'discount' | 'tax' | 'deliveryFee' | 'amountPaid'>) {
  const subtotal = input.items.reduce((sum, item) => sum + parseMoney(item.quantity) * parseMoney(item.unitPrice), 0)
  const discount = Math.min(subtotal, parseMoney(input.discount))
  const tax = parseMoney(input.tax)
  const deliveryFee = parseMoney(input.deliveryFee)
  const total = Math.max(0, subtotal - discount + tax + deliveryFee)
  const amountPaid = Math.min(total, parseMoney(input.amountPaid))
  return { subtotal, discount, tax, deliveryFee, total, amountPaid, balance: Math.max(0, total - amountPaid) }
}

function wrapLines(text: string, maxChars: number): string[] {
  const output: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) {
      output.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!line) line = word
      else if (`${line} ${word}`.length <= maxChars) line += ` ${word}`
      else { output.push(line); line = word }
    }
    if (line) output.push(line)
  }
  return output.length ? output : ['']
}

function text(name: string, value: string, x: number, y: number, w: number, h: number, size = 12, color = '#202630', weight = 400, align: 'left' | 'center' | 'right' = 'left'): DesignElement {
  return el('text', { name, x, y, w, h, text: value, fontFamily: 'Arial', fontSize: size, fontWeight: weight, lineHeight: 1.32, fill: color, align, vAlign: 'middle' })
}

function rect(name: string, x: number, y: number, w: number, h: number, fill: string, stroke?: string): DesignElement {
  return el('rect', { name, x, y, w, h, fill, stroke: stroke ?? undefined, strokeWidth: stroke ? 1 : undefined, radius: 4 })
}

function addHeader(elements: DesignElement[], brand: BrandSettings, logoDataUrl: string | null, title: string, input: BusinessDocumentInput) {
  const navy = brand.palette.primary || '#1F2A44'
  const amber = brand.palette.secondary || '#F5A623'
  if (logoDataUrl) elements.push(el('image', { name: 'Official business logo', meta: { placeholder: 'logo' }, src: logoDataUrl, x: 48, y: 28, w: 66, h: 66, fit: 'contain', radius: 0 }))
  elements.push(text('Business name', brand.businessName, logoDataUrl ? 128 : 50, 30, logoDataUrl ? 395 : 470, 29, 20, navy, 700))
  if (brand.tagline) elements.push(text('Business tagline', brand.tagline, logoDataUrl ? 128 : 50, 59, logoDataUrl ? 395 : 470, 20, 10, '#525966', 400))
  const contact = [brand.phones.filter(Boolean).join(' • '), brand.email, brand.website].filter(Boolean).join('   |   ')
  if (contact) elements.push(text('Business contact', contact, 50, 94, 695, 17, 9, '#424A56'))
  elements.push(el('line', { name: 'Header divider', x: 48, y: 121, w: 698, h: 1, stroke: amber, strokeWidth: 2 }))
  elements.push(text('Document title', title.toUpperCase(), 49, 137, 430, 42, 25, navy, 800))
  elements.push(text('Document number', `No: ${input.documentNumber || '—'}`, 490, 142, 254, 18, 10, '#333B47', 700, 'right'))
  elements.push(text('Issue date', `Date: ${input.issueDate || '—'}`, 490, 161, 254, 18, 10, '#333B47', 400, 'right'))
  if (input.dueDate && ['invoice', 'quotation'].includes(input.kind)) {
    elements.push(text('Due date', `Due: ${input.dueDate}`, 490, 180, 254, 18, 10, '#333B47', 400, 'right'))
  }
}

function addCustomerBlock(elements: DesignElement[], input: BusinessDocumentInput, top = 205) {
  elements.push(rect('Customer details panel', 48, top, 698, 80, '#F7F5F0', '#E1DED6'))
  elements.push(text('Customer details heading', 'CUSTOMER / RECIPIENT', 60, top + 7, 250, 17, 9, '#737987', 700))
  elements.push(text('Customer name', input.customerName || 'Customer name not provided', 60, top + 27, 360, 21, 13, '#202630', 700))
  const contact = [input.customerPhone, input.customerEmail].filter(Boolean).join(' • ')
  if (contact) elements.push(text('Customer contact', contact, 60, top + 48, 430, 18, 9, '#454D59'))
  const address = [input.customerAddress, input.destinationCityState].filter(Boolean).join(', ')
  if (address) elements.push(text('Customer address / destination', address, 430, top + 25, 300, 42, 9, '#454D59'))
}

function addTable(elements: DesignElement[], items: BusinessDocumentItem[], top: number, showPrice: boolean) {
  const navy = '#1F2A44'
  const left = 48
  const tableW = 698
  const rowH = 27
  const cols = showPrice
    ? [{ x: left + 10, w: 340, title: 'ITEM / DESCRIPTION', align: 'left' as const }, { x: left + 358, w: 64, title: 'QTY', align: 'right' as const }, { x: left + 432, w: 124, title: 'UNIT PRICE', align: 'right' as const }, { x: left + 566, w: 122, title: 'AMOUNT', align: 'right' as const }]
    : [{ x: left + 10, w: 500, title: 'ITEM / DESCRIPTION', align: 'left' as const }, { x: left + 560, w: 128, title: 'QTY', align: 'right' as const }]
  elements.push(rect('Item table header', left, top, tableW, 29, navy))
  cols.forEach((col) => elements.push(text(`Table header ${col.title}`, col.title, col.x, top + 2, col.w, 23, 9, '#FFFFFF', 700, col.align)))
  const rows = items.length ? items : [{ description: 'No items entered', quantity: '', unitPrice: '' }]
  rows.forEach((item, index) => {
    const y = top + 29 + index * rowH
    elements.push(el('line', { name: `Item row rule ${index + 1}`, x: left, y: y + rowH, w: tableW, h: 1, stroke: '#E2E5E9', strokeWidth: 1 }))
    elements.push(text(`Item ${index + 1}`, item.description || '—', left + 10, y + 1, showPrice ? 340 : 500, rowH - 2, 10, '#272E39'))
    elements.push(text(`Quantity ${index + 1}`, item.quantity || '—', showPrice ? left + 358 : left + 560, y + 1, showPrice ? 64 : 128, rowH - 2, 10, '#272E39', 400, 'right'))
    if (showPrice) {
      elements.push(text(`Unit price ${index + 1}`, formatNaira(parseMoney(item.unitPrice)), left + 432, y + 1, 124, rowH - 2, 9.5, '#272E39', 400, 'right'))
      elements.push(text(`Line total ${index + 1}`, formatNaira(parseMoney(item.quantity) * parseMoney(item.unitPrice)), left + 566, y + 1, 122, rowH - 2, 9.5, '#272E39', 500, 'right'))
    }
  })
  return top + 29 + rows.length * rowH
}

function addTotals(elements: DesignElement[], input: BusinessDocumentInput, top: number) {
  const totals = calculateBusinessDocumentTotals(input)
  const x = 430
  const wLabel = 160
  const wValue = 140
  const rows: [string, number][] = [
    ['Subtotal', totals.subtotal],
    ['Discount', -totals.discount],
    ['Tax / other charge', totals.tax],
    ['Delivery / shipping', totals.deliveryFee],
  ]
  let y = top
  for (const [label, amount] of rows) {
    if (amount === 0) continue
    elements.push(text(label, label, x, y, wLabel, 20, 10, '#414854'))
    elements.push(text(`${label} amount`, formatNaira(Math.abs(amount)), x + wLabel, y, wValue, 20, 10, '#202630', 500, 'right'))
    y += 21
  }
  elements.push(el('line', { name: 'Total divider', x, y: y + 1, w: wLabel + wValue, h: 1, stroke: '#AEB5BF', strokeWidth: 1 }))
  y += 5
  elements.push(text('Total label', 'TOTAL', x, y, wLabel, 25, 12, '#1F2A44', 800))
  elements.push(text('Total amount', formatNaira(totals.total), x + wLabel, y, wValue, 25, 13, '#1F2A44', 800, 'right'))
  y += 27
  elements.push(text('Amount paid label', 'AMOUNT PAID', x, y, wLabel, 19, 9, '#4A515C', 600))
  elements.push(text('Amount paid', formatNaira(totals.amountPaid), x + wLabel, y, wValue, 19, 9, '#202630', 600, 'right'))
  y += 20
  elements.push(text('Balance due label', 'BALANCE DUE', x, y, wLabel, 22, 10, '#1F2A44', 800))
  elements.push(text('Balance due', formatNaira(totals.balance), x + wLabel, y, wValue, 22, 11, '#1F2A44', 800, 'right'))
  return y + 25
}

export function buildBusinessDocument(input: BusinessDocumentInput, brand: BrandSettings, logoDataUrl: string | null = null): DesignDocument {
  const title = BUSINESS_DOCUMENT_LABELS[input.kind]
  const docNum = input.documentNumber || `${input.kind.slice(0, 3).toUpperCase()}-${(input.issueDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '')}`
  const normalized = { ...input, documentNumber: docNum }
  const pages: ReturnType<typeof newPage>[] = []
  const addFooter = (elements: DesignElement[]) => {
    elements.push(el('line', { name: 'Footer divider', x: 48, y: 1045, w: 698, h: 1, stroke: '#E1DED6', strokeWidth: 1 }))
    const note = input.footerNote || `${brand.businessName} • Thank you for your business`
    elements.push(text('Footer note', note, 48, 1051, 698, 24, 8.5, '#777E89', 400, 'center'))
  }

  if (input.kind === 'letter' || input.kind === 'custom') {
    const lines = wrapLines(input.body || 'Write the body of your letter here.', 98)
    const firstCapacity = 32
    const otherCapacity = 38
    const chunks: string[][] = []
    chunks.push(lines.slice(0, firstCapacity))
    let offset = firstCapacity
    while (offset < lines.length) { chunks.push(lines.slice(offset, offset + otherCapacity)); offset += otherCapacity }
    if (!chunks.length) chunks.push([''])
    chunks.forEach((chunk, index) => {
      const page = newPage(index ? `Letter — page ${index + 1}` : 'Letter', '#ffffff')
      addHeader(page.elements, brand, logoDataUrl, title, normalized)
      if (index === 0) {
        page.elements.push(text('Recipient', `To: ${input.customerName || ''}`, 50, 200, 694, 24, 12, '#252C36', 600))
        if (input.customerAddress || input.destinationCityState || input.customerEmail) {
          page.elements.push(text('Recipient contact', [input.customerAddress, input.destinationCityState, input.customerEmail].filter(Boolean).join(' • '), 50, 225, 694, 32, 9.5, '#4D5562'))
        }
        if (input.subject) page.elements.push(text('Subject', `Subject: ${input.subject}`, 50, 273, 694, 31, 12, '#1F2A44', 700))
      }
      const startY = index === 0 ? (input.subject ? 326 : 302) : 193
      const bodyText = chunk.join('\n')
      page.elements.push(el('text', { name: index ? `Letter body page ${index + 1}` : 'Letter body', x: 50, y: startY, w: 694, h: Math.max(30, chunk.length * 18.5), text: bodyText, fontFamily: brand.typography.bodyFont || 'Arial', fontSize: 12, lineHeight: 1.5, fill: '#202630', align: 'left' }))
      if (index === chunks.length - 1) {
        const closingY = Math.min(955, startY + chunk.length * 18.5 + 26)
        if (input.kind === 'letter') page.elements.push(text('Letter closing', 'Yours faithfully,', 50, closingY, 300, 20, 11, '#252C36'))
        if (input.signerName) page.elements.push(text(input.kind === 'letter' ? 'Letter signature' : 'Document signature', input.signerName, 50, closingY + (input.kind === 'letter' ? 42 : 8), 320, 22, 12, '#1F2A44', 700))
      }
      addFooter(page.elements)
      pages.push(page)
    })
  } else {
    const usableItems = input.items.filter((item) => item.description.trim() || item.quantity.trim() || item.unitPrice.trim())
    const rows = usableItems.length ? usableItems : [{ description: '', quantity: '', unitPrice: '' }]
    const perPage = 12
    const chunks: BusinessDocumentItem[][] = []
    for (let i = 0; i < rows.length; i += perPage) chunks.push(rows.slice(i, i + perPage))
    if (!chunks.length) chunks.push([{ description: '', quantity: '', unitPrice: '' }])
    chunks.forEach((chunk, index) => {
      const page = newPage(index ? `${title} — page ${index + 1}` : title, '#ffffff')
      addHeader(page.elements, brand, logoDataUrl, title, normalized)
      addCustomerBlock(page.elements, normalized, 205)
      if (index === 0 && (input.deliveryMethod || input.shippingReference || input.paymentMethod)) {
        const info = [
          input.deliveryMethod ? `Delivery: ${input.deliveryMethod}` : '',
          input.shippingReference ? `Reference: ${input.shippingReference}` : '',
          input.paymentMethod ? `Payment: ${input.paymentMethod}` : '',
        ].filter(Boolean).join('   •   ')
        page.elements.push(text('Delivery and payment info', info, 50, 292, 690, 19, 9.5, '#464D59'))
      }
      const isDeliveryNote = input.kind === 'delivery-note'
      const tableBottom = addTable(page.elements, chunk, index === 0 ? 326 : 220, !isDeliveryNote)
      if (index === chunks.length - 1) {
        let after = tableBottom + 18
        if (!isDeliveryNote) {
          after = addTotals(page.elements, { ...normalized, items: usableItems }, after)
        }
        if (input.notes) {
          page.elements.push(text('Additional notes heading', 'NOTES', 50, Math.min(after + 8, 935), 250, 18, 9, '#6A7180', 700))
          const lines = wrapLines(input.notes, 92).slice(0, 4)
          page.elements.push(el('text', { name: 'Additional notes', x: 50, y: Math.min(after + 25, 953), w: 345, h: lines.length * 14, text: lines.join('\n'), fontFamily: brand.typography.bodyFont || 'Arial', fontSize: 9.5, lineHeight: 1.35, fill: '#414854' }))
        }
        if (input.signerName) page.elements.push(text('Prepared by', `Prepared by: ${input.signerName}`, 50, 995, 320, 22, 9.5, '#414854', 600))
        if (input.kind === 'receipt') page.elements.push(text('Receipt confirmation', 'PAYMENT RECEIVED — thank you.', 50, 1017, 698, 20, 11, '#2E7D32', 700))
      }
      addFooter(page.elements)
      pages.push(page)
    })
  }

  return {
    version: 1,
    width: 794,
    height: 1123,
    background: '#ffffff',
    pages,
    meta: { type: 'document', templateId: 'a4-portrait', notes: `${title}; document ${normalized.documentNumber}` },
  }
}
