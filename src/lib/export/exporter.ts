// Export engine: turns the editable design into real downloadable files.
// - SVG: genuine vector source of the design
// - PNG / JPG: high-resolution raster via canvas (true transparency for PNG)
// - PDF: vector via svg2pdf.js (real text + shapes), automatic raster fallback
// - Print: browser print dialog at correct physical size
// - ZIP: complete brand kit archive

import type { DesignDocument, DesignElement } from '@/lib/design/types'
import { docPagesToSvg, docToSvg, generateQrDataUrl, pageToSvg } from '@/lib/design/svg'
import type { RenderPalette } from '@/lib/design/svg'
import { pxToMm } from '@/lib/design/types'
import type { BrandSettings } from '@/lib/brand'
import { slugifyFileName } from '@/lib/brand'
import { exportApi } from '@/lib/api-client'

// ---------- QR ----------

export async function ensureQrSources(doc: DesignDocument): Promise<DesignDocument> {
  const next: DesignDocument = JSON.parse(JSON.stringify(doc))
  for (const page of next.pages) {
    for (const e of page.elements) {
      if (e.type === 'qr' && !e.src) {
        e.src = await generateQrDataUrl(e.qrData || ' ', '#000000', '#ffffff')
      }
    }
  }
  return next
}

// ---------- SVG ----------

export function buildSvg(doc: DesignDocument, palette: RenderPalette, pageIndex = 0, transparent = false): string {
  return docToSvg(doc, { palette, pageIndex, includeBackground: !transparent })
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function defaultFileName(brand: BrandSettings, project: { name: string; type: string }, ext: string): string {
  return `${slugifyFileName(brand.businessName)}-${slugifyFileName(project.name)}.${ext}`
}

export async function downloadSvg(
  doc: DesignDocument,
  palette: RenderPalette,
  fileName: string,
  meta: { projectId?: string | null; projectName: string; projectType: string; brand: BrandSettings }
): Promise<void> {
  const withQr = await ensureQrSources(doc)
  const svg = buildSvg(withQr, palette, 0, true)
  triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName)
  await record(meta, 'svg', fileName, doc.width, doc.height)
}

// ---------- raster (PNG / JPG) ----------

export function svgToCanvas(svgString: string, width: number, height: number, scale: number, background?: string | null): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')!
      if (background) {
        ctx.fillStyle = background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not render the design to an image. Please try again.'))
    }
    img.src = url
  })
}

export async function downloadRaster(
  doc: DesignDocument,
  palette: RenderPalette,
  opts: {
    format: 'png' | 'jpg'
    scale: number
    transparent: boolean
    background?: string | null
    fileName: string
    projectId?: string | null
    projectName: string
    projectType: string
    brand: BrandSettings
    pageIndex?: number
  }
): Promise<void> {
  const withQr = await ensureQrSources(doc)
  const svg = buildSvg(withQr, palette, opts.pageIndex ?? 0, opts.transparent)
  const bg = opts.transparent ? undefined : opts.background ?? (opts.format === 'jpg' ? '#ffffff' : undefined)
  const canvas = await svgToCanvas(svg, doc.width, doc.height, opts.scale, bg)
  const mime = opts.format === 'png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92))
  if (!blob) throw new Error('Image export failed. Your saved design has not been lost.')
  triggerDownload(blob, opts.fileName)
  await record(opts, opts.format, opts.fileName, canvas.width, canvas.height, String(opts.scale))
}

// thumbnail helper (small JPEG data-url for project lists)
export async function makeThumbnail(doc: DesignDocument, palette: RenderPalette, maxPx = 480): Promise<string> {
  try {
    const withQr = await ensureQrSources(doc)
    const svg = buildSvg(withQr, palette, 0, false)
    const scale = Math.min(maxPx / doc.width, maxPx / doc.height, 1.5)
    const canvas = await svgToCanvas(svg, doc.width, doc.height, scale, '#f4f2ec')
    return canvas.toDataURL('image/jpeg', 0.78)
  } catch {
    return ''
  }
}

// ---------- PDF ----------

const FONT_MAP: Record<string, string> = {
  Arial: 'Helvetica',
  Helvetica: 'Helvetica',
  Verdana: 'Helvetica',
  'Trebuchet MS': 'Helvetica',
  'Times New Roman': 'Times',
  Georgia: 'Times',
  'Courier New': 'Courier',
}

async function convertToPdfSafeImage(src: string): Promise<string> {
  if (src.startsWith('data:image/png') || src.startsWith('data:image/jpeg')) return src
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth || 800
      c.height = img.naturalHeight || 800
      c.getContext('2d')!.drawImage(img, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

async function pdfSafeDoc(doc: DesignDocument): Promise<DesignDocument> {
  const next: DesignDocument = JSON.parse(JSON.stringify(doc))
  for (const page of next.pages) {
    for (const e of page.elements) {
      if (e.type === 'image' && e.src) e.src = await convertToPdfSafeImage(e.src)
      if (e.type === 'qr' && !e.src) e.src = await generateQrDataUrl(e.qrData || ' ')
      if (e.fontFamily && FONT_MAP[e.fontFamily]) e.fontFamily = FONT_MAP[e.fontFamily]
    }
  }
  return next
}

export interface PdfOptions {
  mode: 'vector' | 'image'
  dpi: number // for image mode
  transparent: boolean
  fileName: string
  paperSize?: string // preset id for exact physical size
  cropMarks: boolean
  projectId?: string | null
  projectName: string
  projectType: string
  brand: BrandSettings
}

export async function downloadPdf(
  doc: DesignDocument,
  palette: RenderPalette,
  opts: PdfOptions
): Promise<{ usedFallback: boolean }> {
  const { jsPDF } = await import('jspdf')
  await import('svg2pdf.js')
  const mm = pxToMm(doc)
  const safe = opts.mode === 'vector' ? await pdfSafeDoc(await ensureQrSources(doc)) : await ensureQrSources(doc)
  const pdfDoc = new jsPDF({ unit: 'mm', format: [mm.w, mm.h], orientation: mm.w > mm.h ? 'landscape' : 'portrait', compress: true })
  let usedFallback = false

  for (let i = 0; i < safe.pages.length; i++) {
    if (i > 0) pdfDoc.addPage([mm.w, mm.h], mm.w > mm.h ? 'landscape' : 'portrait')
    const page = safe.pages[i]
    const pageBg = opts.transparent ? null : page.background ?? safe.background
    if (opts.mode === 'vector') {
      try {
        const svg = pageToSvg(safe, page, { palette, includeBackground: true, idPrefix: `pdf${i}` }, pageBg)
        const container = document.createElement('div')
        container.style.position = 'fixed'
        container.style.left = '-10000px'
        container.innerHTML = svg
        document.body.appendChild(container)
        const svgEl = container.querySelector('svg')
        if (!svgEl) throw new Error('svg missing')
        await (pdfDoc as unknown as { svg: (el: SVGElement, o: object) => Promise<void> }).svg(svgEl, {
          x: 0,
          y: 0,
          width: mm.w,
          height: mm.h,
        })
        container.remove()
      } catch (err) {
        console.warn('[export] vector PDF failed, falling back to image mode', err)
        usedFallback = true
        await renderPageAsImage(pdfDoc, safe, page, palette, mm, opts.dpi, pageBg, i)
      }
    } else {
      await renderPageAsImage(pdfDoc, safe, page, palette, mm, opts.dpi, pageBg, i)
    }
    if (opts.cropMarks) drawCropMarks(pdfDoc, mm)
  }

  pdfDoc.save(opts.fileName)
  await record(opts, 'pdf', opts.fileName, doc.width, doc.height, opts.mode === 'image' ? `${opts.dpi}dpi` : 'vector', mm)
  return { usedFallback }
}

async function renderPageAsImage(
  pdfDoc: import('jspdf').jsPDF,
  doc: DesignDocument,
  page: DesignDocument['pages'][number],
  palette: RenderPalette,
  mm: { w: number; h: number },
  dpi: number,
  pageBg: string | null,
  index: number
): Promise<void> {
  const svg = pageToSvg(doc, page, { palette, includeBackground: true, idPrefix: `pdfimg${index}` }, pageBg)
  const scale = dpi / 96
  const canvas = await svgToCanvas(svg, doc.width, doc.height, scale, pageBg ?? '#ffffff')
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  pdfDoc.addImage(imgData, 'JPEG', 0, 0, mm.w, mm.h)
}

function drawCropMarks(pdfDoc: import('jspdf').jsPDF, mm: { w: number; h: number }): void {
  const off = 4
  const len = 3
  pdfDoc.setDrawColor(120)
  pdfDoc.setLineWidth(0.1)
  const corners: [number, number, number, number][] = [
    [0, 0, -1, -1],
    [mm.w, 0, 1, -1],
    [0, mm.h, -1, 1],
    [mm.w, mm.h, 1, 1],
  ]
  for (const [x, y, dx, dy] of corners) {
    pdfDoc.line(x + dx * off, y, x + dx * (off - len), y)
    pdfDoc.line(x, y + dy * off, x, y + dy * (off - len))
  }
}

// ---------- print ----------

export async function printDoc(doc: DesignDocument, palette: RenderPalette, brand: BrandSettings, dpi = 200, pageIndex = 0): Promise<void> {
  const withQr = await ensureQrSources(doc)
  const page = withQr.pages[pageIndex] ?? withQr.pages[0]
  const svg = pageToSvg(withQr, page, { palette, includeBackground: true, idPrefix: `print${pageIndex}` })
  const canvas = await svgToCanvas(svg, doc.width, doc.height, dpi / 96, doc.background ?? '#ffffff')
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
  const mm = pxToMm(doc)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const idoc = iframe.contentDocument!
  idoc.open()
  idoc.write(`<!DOCTYPE html><html><head><title>${brand.businessName} — Print</title>
    <style>
      @page { size: ${mm.w}mm ${mm.h}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      img { width: ${mm.w}mm; height: ${mm.h}mm; display: block; }
    </style></head><body><img src="${dataUrl}" /></body></html>`)
  idoc.close()
  await new Promise((r) => setTimeout(r, 400))
  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  setTimeout(() => iframe.remove(), 60_000)
  await record({ projectName: doc.meta?.type ?? 'design', projectType: doc.meta?.type ?? 'design', brand, projectId: null }, 'print', 'print-dialog', doc.width, doc.height, `${dpi}dpi`)
}

// ---------- brand kit ZIP ----------

export async function downloadBrandKitZip(brand: BrandSettings, palette: RenderPalette): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const variants: { id: string; label: string }[] = [
    { id: 'primary', label: 'primary-full' },
    { id: 'symbol', label: 'symbol-only' },
    { id: 'horizontal', label: 'horizontal' },
    { id: 'stacked', label: 'stacked' },
    { id: 'mono', label: 'monochrome' },
  ]
  const { buildLogoDoc } = await import('@/lib/design/templates')
  const folder = zip.folder('logo-variants')!
  for (const v of variants) {
    const doc = buildLogoDoc(v.id as 'primary', brand)
    const withQr = await ensureQrSources(doc)
    const svg = buildSvg(withQr, palette, 0, v.id !== 'light')
    folder.file(`${slugifyFileName(brand.businessName)}-logo-${v.label}.svg`, svg)
    const canvas = await svgToCanvas(svg, doc.width, doc.height, 2, v.id === 'mono' ? undefined : '#ffffff')
    const pngBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (pngBlob) folder.file(`${slugifyFileName(brand.businessName)}-logo-${v.label}@2x.png`, pngBlob)
  }
  zip.file(
    'brand-info.json',
    JSON.stringify(
      {
        business: {
          name: brand.businessName,
          category: brand.businessCategory,
          address: brand.address,
          phones: brand.phones,
          email: brand.email,
          website: brand.website,
          tagline: brand.tagline,
        },
        palette,
        typography: brand.typography,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  )
  zip.file(
    'README.txt',
    [
      `${brand.businessName} — Brand Kit`,
      '',
      'logo-variants/  : SVG (vector) + PNG @2x for each approved logo variant',
      'brand-info.json : colours, typography and contact details',
      '',
      'Generated by the Brand Kit & Design Studio.',
    ].join('\n')
  )
  const blob = await zip.generateAsync({ type: 'blob' })
  const fileName = `${slugifyFileName(brand.businessName)}-brand-kit.zip`
  triggerDownload(blob, fileName)
  await record({ projectName: 'Brand Kit', projectType: 'brand-kit', brand, projectId: null }, 'zip', fileName, 0, 0)
  return fileName
}

// ---------- history ----------

async function record(
  meta: { projectId?: string | null; projectName: string; projectType: string; brand: BrandSettings },
  format: 'pdf' | 'png' | 'jpg' | 'svg' | 'zip' | 'print',
  fileName: string,
  width?: number,
  height?: number,
  scale?: string,
  mm?: { w: number; h: number }
): Promise<void> {
  try {
    await exportApi.record({
      projectId: meta.projectId ?? null,
      projectName: meta.projectName,
      projectType: meta.projectType,
      format,
      fileName,
      width: width ?? 0,
      height: height ?? 0,
      scale: scale ?? '1',
      paperSize: mm ? `${Math.round(mm.w)}×${Math.round(mm.h)}mm` : '',
    })
  } catch (err) {
    console.warn('[export] could not record export history', err)
  }
}
