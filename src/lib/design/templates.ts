// Built-in template library.
// Every template bakes in the owner's current brand settings and produces a
// fully EDITABLE DesignDocument (real text/shape elements — never flattened).

import type { DesignDocument, DesignElement, DesignPage, ProjectType } from './types'
import { el, newPage } from './types'
import type { BrandSettings } from '@/lib/brand'

type Palette = BrandSettings['palette']

function doc(width: number, height: number, background: string | null, pages: DesignPage[], type: ProjectType, templateId: string): DesignDocument {
  return { version: 1, width, height, background, pages, meta: { type, templateId } }
}

// =====================================================================
// LOGO — recreation of the owner's reference badge (sun + solar panel +
// product silhouettes + MK), fully vector and editable.
// =====================================================================

export type LogoVariant = 'primary' | 'symbol' | 'compact' | 'horizontal' | 'stacked' | 'light' | 'dark' | 'mono'

interface LogoOpts {
  navy: string
  amber: string
  black: string
  white: string
  barColor: string
  badgeFill: string
  withName: boolean
  background: string | null
}

function logoBadgeElements(o: LogoOpts, scale = 1, offX = 0, offY = 0): DesignElement[] {
  const s = (v: number) => v * scale + (v === 0 ? 0 : 0)
  const P = (x: number, y: number, w: number, h: number) => ({ x: offX + s(x), y: offY + s(y), w: s(w), h: s(h) })
  const els: DesignElement[] = []
  els.push(el('ellipse', { name: 'Badge circle', ...P(20, 20, 960, 960), fill: o.badgeFill, colorRole: 'primary' }))
  els.push(el('symbol', { name: 'Sun', symbol: 'sun-half', symbolWeight: 'bold', ...P(265, 165, 470, 470), fill: o.amber, colorRole: 'secondary' }))
  // supporting silhouettes (kept in reference arrangement)
  els.push(el('symbol', { name: 'Refrigerator', symbol: 'fridge', symbolWeight: 'bold', ...P(338, 388, 88, 132), fill: o.black }))
  els.push(el('symbol', { name: 'Electric fan', symbol: 'fan', symbolWeight: 'bold', ...P(432, 342, 108, 178), fill: o.black }))
  els.push(el('symbol', { name: 'Television', symbol: 'tv', symbolWeight: 'bold', ...P(468, 448, 92, 76), fill: o.black }))
  els.push(el('symbol', { name: 'Inverter', symbol: 'inverter', symbolWeight: 'bold', ...P(562, 352, 82, 86), fill: o.black }))
  els.push(el('symbol', { name: 'Solar panel', symbol: 'solar-panel', symbolWeight: 'bold', ...P(578, 432, 136, 92), fill: o.black }))
  els.push(el('rect', { name: 'Divider bar', ...P(310, 548, 380, 22), radius: 11, fill: o.barColor }))
  els.push(
    el('text', {
      name: 'MK initials',
      ...P(300, 585, 400, 190),
      text: 'MK',
      fontFamily: 'Arial',
      fontSize: 155 * scale,
      fontWeight: 900,
      align: 'center',
      vAlign: 'middle',
      fill: o.white,
      letterSpacing: 2,
    })
  )
  if (o.withName) {
    els.push(
      el('text', {
        name: 'Business name line 1',
        ...P(150, 790, 700, 52),
        text: 'MUHAMMAD KAIRU',
        fontFamily: 'Arial',
        fontSize: 44,
        fontWeight: 700,
        align: 'center',
        fill: o.white,
        letterSpacing: 6,
      })
    )
    els.push(
      el('text', {
        name: 'Business name line 2',
        ...P(150, 850, 700, 52),
        text: 'ELECTRONICS',
        fontFamily: 'Arial',
        fontSize: 34,
        fontWeight: 400,
        align: 'center',
        fill: o.amber,
        letterSpacing: 14,
      })
    )
  }
  return els
}

export function buildLogoDoc(variant: LogoVariant, brand: BrandSettings): DesignDocument {
  const p = brand.palette
  const base: LogoOpts = {
    navy: p.primary,
    amber: p.secondary,
    black: '#101820',
    white: '#FFFFFF',
    barColor: '#FFFFFF',
    badgeFill: p.primary,
    withName: true,
    background: null,
  }

  switch (variant) {
    case 'primary':
      return doc(
        1000,
        1000,
        base.background,
        [{ ...newPage('Logo', null), elements: logoBadgeElements(base) }],
        'logo',
        'logo-primary'
      )
    case 'symbol':
      return doc(
        1000,
        1000,
        null,
        [{ ...newPage('Symbol', null), elements: logoBadgeElements({ ...base, withName: false }) }],
        'logo',
        'logo-symbol'
      )
    case 'compact':
      return doc(
        1000,
        1000,
        null,
        [
          {
            ...newPage('Compact', null),
            elements: [
              el('ellipse', { name: 'Badge circle', x: 150, y: 150, w: 700, h: 700, fill: base.badgeFill, colorRole: 'primary' }),
              el('symbol', { name: 'Sun', symbol: 'sun-half', symbolWeight: 'bold', x: 285, y: 255, w: 430, h: 430, fill: base.amber, colorRole: 'secondary' }),
              el('symbol', { name: 'Fan', symbol: 'fan', symbolWeight: 'bold', x: 425, y: 415, w: 105, h: 120, fill: base.black }),
              el('symbol', { name: 'Solar panel', symbol: 'solar-panel', symbolWeight: 'bold', x: 540, y: 465, w: 120, h: 85, fill: base.black }),
              el('rect', { name: 'Divider bar', x: 320, y: 555, w: 360, h: 20, radius: 10, fill: base.barColor }),
              el('text', { name: 'MK initials', x: 300, y: 585, w: 400, h: 180, text: 'MK', fontFamily: 'Arial', fontSize: 150, fontWeight: 900, align: 'center', vAlign: 'middle', fill: base.white }),
            ],
          },
        ],
        'logo',
        'logo-compact'
      )
    case 'horizontal':
      return doc(
        1400,
        500,
        null,
        [
          {
            ...newPage('Horizontal', null),
            elements: [
              ...logoBadgeElements({ ...base, withName: false }, 0.42, 0, 40),
              el('text', { name: 'Business name', x: 520, y: 150, w: 830, h: 90, text: 'Muhammad Kairu', fontFamily: 'Arial', fontSize: 84, fontWeight: 900, align: 'left', fill: base.navy, colorRole: 'primary' }),
              el('text', { name: 'Category', x: 524, y: 250, w: 830, h: 60, text: 'ELECTRONICS  &  SOLAR  ENERGY', fontFamily: 'Arial', fontSize: 34, fontWeight: 400, align: 'left', fill: base.amber, colorRole: 'secondary', letterSpacing: 5 }),
              el('rect', { name: 'Accent line', x: 524, y: 330, w: 300, h: 8, radius: 4, fill: base.amber, colorRole: 'secondary' }),
            ],
          },
        ],
        'logo',
        'logo-horizontal'
      )
    case 'stacked':
      return doc(
        1000,
        1250,
        null,
        [
          {
            ...newPage('Stacked', null),
            elements: [
              ...logoBadgeElements({ ...base, withName: false }, 0.78, 110, 20),
              el('text', { name: 'Business name', x: 100, y: 950, w: 800, h: 90, text: 'Muhammad Kairu', fontFamily: 'Arial', fontSize: 78, fontWeight: 900, align: 'center', fill: base.navy, colorRole: 'primary' }),
              el('text', { name: 'Category', x: 100, y: 1050, w: 800, h: 60, text: 'ELECTRONICS & SOLAR ENERGY', fontFamily: 'Arial', fontSize: 32, fontWeight: 400, align: 'center', fill: base.amber, colorRole: 'secondary', letterSpacing: 6 }),
            ],
          },
        ],
        'logo',
        'logo-stacked'
      )
    case 'light':
      return doc(
        1000,
        1000,
        null,
        [{ ...newPage('Light background', '#FFFFFF'), elements: logoBadgeElements(base) }],
        'logo',
        'logo-light'
      )
    case 'dark':
      return doc(
        1000,
        1000,
        null,
        [
          {
            ...newPage('Dark background', '#101820'),
            elements: logoBadgeElements({ ...base, badgeFill: '#26324F', barColor: '#FFFFFF' }),
          },
        ],
        'logo',
        'logo-dark'
      )
    case 'mono':
      return doc(
        1000,
        1000,
        null,
        [
          {
            ...newPage('Monochrome', null),
            elements: logoBadgeElements({
              ...base,
              navy: '#101820',
              amber: '#101820',
              black: '#FFFFFF',
              barColor: '#101820',
              badgeFill: '#101820',
              withName: false,
            }),
          },
        ],
        'logo',
        'logo-mono'
      )
  }
}

// =====================================================================
// LETTERHEAD (A4)
// =====================================================================

export function buildLetterheadDoc(style: 'band' | 'side' | 'minimal', brand: BrandSettings): DesignDocument {
  const p = brand.palette
  const name = brand.businessName
  const contact = [brand.address, brand.phones.join('  •  '), brand.email].filter(Boolean).join('   |   ')

  if (style === 'band') {
    return doc(794, 1123, '#FFFFFF', [
      {
        ...newPage('Letterhead'),
        elements: [
          el('rect', { name: 'Top band', x: 0, y: 0, w: 794, h: 128, fill: p.primary, colorRole: 'primary' }),
          el('rect', { name: 'Accent line', x: 0, y: 128, w: 794, h: 7, fill: p.secondary, colorRole: 'secondary' }),
          el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 56, y: 22, w: 84, h: 84, fit: 'contain' }),
          el('text', { name: 'Business name', x: 160, y: 30, w: 560, h: 46, text: name, fontFamily: 'Arial', fontSize: 30, fontWeight: 700, align: 'left', fill: '#FFFFFF' }),
          el('text', { name: 'Category', x: 160, y: 78, w: 560, h: 30, text: brand.businessCategory, fontFamily: 'Arial', fontSize: 15, align: 'left', fill: p.secondary, colorRole: 'secondary', letterSpacing: 2 }),
          el('text', { name: 'Footer contact', x: 56, y: 1040, w: 682, h: 44, text: contact || 'Add your address and phone numbers in Brand Settings', fontFamily: 'Arial', fontSize: 12.5, align: 'center', vAlign: 'middle', fill: '#555555' }),
          el('rect', { name: 'Footer line', x: 56, y: 1030, w: 682, h: 3, fill: p.secondary, colorRole: 'secondary' }),
        ],
      },
    ], 'letterhead', 'letterhead-band')
  }
  if (style === 'side') {
    return doc(794, 1123, '#FFFFFF', [
      {
        ...newPage('Letterhead'),
        elements: [
          el('rect', { name: 'Side band', x: 0, y: 0, w: 16, h: 1123, fill: p.secondary, colorRole: 'secondary' }),
          el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 56, y: 40, w: 92, h: 92, fit: 'contain' }),
          el('text', { name: 'Business name', x: 168, y: 44, w: 570, h: 48, text: name, fontFamily: 'Georgia', fontSize: 30, fontWeight: 700, align: 'left', fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Tagline', x: 168, y: 94, w: 570, h: 30, text: brand.tagline || brand.businessCategory, fontFamily: 'Arial', fontSize: 14, italic: true, align: 'left', fill: '#666666' }),
          el('line', { name: 'Header rule', x: 56, y: 156, w: 682, h: 2, stroke: p.primary, strokeRole: 'primary', strokeWidth: 2, fill: p.primary, colorRole: 'primary' }),
          el('line', { name: 'Footer rule', x: 56, y: 1032, w: 682, h: 2, stroke: p.primary, strokeRole: 'primary', strokeWidth: 2, fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Footer contact', x: 56, y: 1044, w: 682, h: 42, text: contact, fontFamily: 'Arial', fontSize: 12, align: 'center', vAlign: 'middle', fill: '#555555' }),
        ],
      },
    ], 'letterhead', 'letterhead-side')
  }
  return doc(794, 1123, '#FFFFFF', [
    {
      ...newPage('Letterhead'),
      elements: [
        el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 336, y: 48, w: 122, h: 122, fit: 'contain' }),
        el('text', { name: 'Business name', x: 56, y: 182, w: 682, h: 50, text: name.toUpperCase(), fontFamily: 'Georgia', fontSize: 32, fontWeight: 700, align: 'center', fill: p.primary, colorRole: 'primary', letterSpacing: 3 }),
        el('text', { name: 'Category', x: 56, y: 234, w: 682, h: 30, text: brand.businessCategory, fontFamily: 'Arial', fontSize: 14, align: 'center', fill: '#666666', letterSpacing: 2 }),
        el('line', { name: 'Top rule', x: 56, y: 60, w: 682, h: 2, stroke: '#222222', strokeWidth: 2, fill: '#222222' }),
        el('line', { name: 'Bottom rule', x: 56, y: 1040, w: 682, h: 2, stroke: '#222222', strokeWidth: 2, fill: '#222222' }),
        el('text', { name: 'Footer contact', x: 56, y: 1054, w: 682, h: 40, text: contact, fontFamily: 'Arial', fontSize: 12, align: 'center', vAlign: 'middle', fill: '#555555' }),
      ],
    },
  ], 'letterhead', 'letterhead-minimal')
}

// =====================================================================
// BUSINESS CARD (336×192, front + back)
// =====================================================================

export function buildBusinessCardDoc(style: 'navy' | 'clean' | 'amber', brand: BrandSettings): DesignDocument {
  const p = brand.palette
  const W = 336
  const H = 192
  const name = brand.businessName
  const phones = brand.phones.join('  •  ')
  const shortAddr = brand.address.replace(/,?\s*Nigeria\.?$/i, '')

  if (style === 'navy') {
    return doc(W, H, p.primary, [
      {
        ...newPage('Front', p.primary),
        elements: [
          el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 20, y: 20, w: 64, h: 64, fit: 'contain' }),
          el('text', { name: 'Business name', x: 20, y: 96, w: 296, h: 34, text: name, fontFamily: 'Arial', fontSize: 17, fontWeight: 700, align: 'left', fill: '#FFFFFF' }),
          el('text', { name: 'Category', x: 20, y: 128, w: 296, h: 22, text: brand.businessCategory, fontFamily: 'Arial', fontSize: 9.5, align: 'left', fill: p.secondary, colorRole: 'secondary', letterSpacing: 1 }),
          el('rect', { name: 'Accent bar', x: 20, y: 158, w: 52, h: 5, radius: 2.5, fill: p.secondary, colorRole: 'secondary' }),
        ],
      },
      {
        ...newPage('Back', p.primary),
        elements: [
          el('rect', { name: 'Amber band', x: 0, y: 0, w: W, h: 10, fill: p.secondary, colorRole: 'secondary' }),
          el('text', { name: 'Owner name', x: 22, y: 26, w: 292, h: 26, text: brand.tagline || 'Your Name — Title', fontFamily: 'Arial', fontSize: 12.5, fontWeight: 700, align: 'left', fill: '#FFFFFF' }),
          el('symbol', { name: 'Phone icon', symbol: 'phone', x: 22, y: 62, w: 14, h: 14, fill: p.secondary, colorRole: 'secondary' }),
          el('text', { name: 'Phones', x: 42, y: 58, w: 272, h: 22, text: phones, fontFamily: 'Arial', fontSize: 11, align: 'left', vAlign: 'middle', fill: '#FFFFFF' }),
          el('symbol', { name: 'Location icon', symbol: 'location', x: 22, y: 90, w: 14, h: 14, fill: p.secondary, colorRole: 'secondary' }),
          el('text', { name: 'Address', x: 42, y: 82, w: 272, h: 40, text: shortAddr, fontFamily: 'Arial', fontSize: 9.5, align: 'left', vAlign: 'middle', fill: '#E8E4DA', lineHeight: 1.3 }),
          ...(brand.email ? [
            el('symbol', { name: 'Mail icon', symbol: 'mail', x: 22, y: 128, w: 14, h: 14, fill: p.secondary, colorRole: 'secondary' }),
            el('text', { name: 'Email', x: 42, y: 124, w: 272, h: 22, text: brand.email, fontFamily: 'Arial', fontSize: 10.5, align: 'left', vAlign: 'middle', fill: '#E8E4DA' }),
          ] : []),
        ],
      },
    ], 'business-card', 'card-navy')
  }
  if (style === 'clean') {
    return doc(W, H, '#FFFFFF', [
      {
        ...newPage('Front', '#FFFFFF'),
        elements: [
          el('rect', { name: 'Top strip', x: 0, y: 0, w: W, h: 44, fill: p.primary, colorRole: 'primary' }),
          el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 18, y: 56, w: 56, h: 56, fit: 'contain' }),
          el('text', { name: 'Business name', x: 18, y: 122, w: 300, h: 30, text: name, fontFamily: 'Arial', fontSize: 16, fontWeight: 700, align: 'left', fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Phones', x: 18, y: 152, w: 300, h: 20, text: phones, fontFamily: 'Arial', fontSize: 10.5, align: 'left', fill: '#333333' }),
          el('text', { name: 'Address', x: 18, y: 170, w: 300, h: 18, text: shortAddr, fontFamily: 'Arial', fontSize: 8.5, align: 'left', fill: '#666666' }),
        ],
      },
      {
        ...newPage('Back', p.primary),
        elements: [
          el('ellipse', { name: 'Emblem ring', x: 118, y: 26, w: 100, h: 100, fill: null, stroke: p.secondary, strokeRole: 'secondary', strokeWidth: 3 }),
          el('symbol', { name: 'Sun', symbol: 'sun-half', symbolWeight: 'bold', x: 136, y: 44, w: 64, h: 64, fill: p.secondary, colorRole: 'secondary' }),
          el('text', { name: 'MK', x: 118, y: 78, w: 100, h: 60, text: 'MK', fontFamily: 'Arial', fontSize: 40, fontWeight: 900, align: 'center', vAlign: 'middle', fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Business name', x: 18, y: 142, w: 300, h: 26, text: name.toUpperCase(), fontFamily: 'Arial', fontSize: 12, fontWeight: 700, align: 'center', fill: '#FFFFFF', letterSpacing: 2 }),
          el('text', { name: 'Phones', x: 18, y: 166, w: 300, h: 20, text: phones, fontFamily: 'Arial', fontSize: 10, align: 'center', fill: p.secondary, colorRole: 'secondary' }),
        ],
      },
    ], 'business-card', 'card-clean')
  }
  return doc(W, H, '#FFFFFF', [
    {
      ...newPage('Front', '#FFFFFF'),
      elements: [
        el('rect', { name: 'Amber edge', x: 0, y: 0, w: 10, h: H, fill: p.secondary, colorRole: 'secondary' }),
        el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 24, y: 18, w: 60, h: 60, fit: 'contain' }),
        el('text', { name: 'Business name', x: 24, y: 90, w: 292, h: 30, text: name, fontFamily: 'Trebuchet MS', fontSize: 16, fontWeight: 700, align: 'left', fill: p.primary, colorRole: 'primary' }),
        el('text', { name: 'Tagline', x: 24, y: 120, w: 292, h: 20, text: brand.tagline, fontFamily: 'Trebuchet MS', fontSize: 9.5, italic: true, align: 'left', fill: '#777777' }),
        el('text', { name: 'Phones', x: 24, y: 146, w: 292, h: 20, text: phones, fontFamily: 'Arial', fontSize: 11, fontWeight: 700, align: 'left', fill: '#222222' }),
        el('text', { name: 'Address', x: 24, y: 166, w: 292, h: 18, text: shortAddr, fontFamily: 'Arial', fontSize: 8.5, align: 'left', fill: '#555555' }),
      ],
    },
    {
      ...newPage('Back', p.secondary),
      elements: [
        el('text', { name: 'Big MK', x: 18, y: 40, w: 300, h: 80, text: 'MK', fontFamily: 'Arial', fontSize: 64, fontWeight: 900, align: 'center', vAlign: 'middle', fill: '#FFFFFF' }),
        el('text', { name: 'Business name', x: 18, y: 126, w: 300, h: 26, text: name.toUpperCase(), fontFamily: 'Arial', fontSize: 11, fontWeight: 700, align: 'center', fill: '#FFFFFF', letterSpacing: 2 }),
        el('text', { name: 'Phones', x: 18, y: 152, w: 300, h: 20, text: phones, fontFamily: 'Arial', fontSize: 10, align: 'center', fill: '#FFFFFF' }),
      ],
    },
  ], 'business-card', 'card-amber')
}

// =====================================================================
// COMPLIMENTARY CARD (A6 397×560)
// =====================================================================

export function buildComplimentaryDoc(style: 'thanks' | 'appreciation' | 'promo', brand: BrandSettings): DesignDocument {
  const p = brand.palette
  const W = 397
  const H = 560
  const name = brand.businessName
  const phones = brand.phones.join('  •  ')

  if (style === 'thanks') {
    return doc(W, H, '#FFFFFF', [
      {
        ...newPage('Front', '#FFFFFF'),
        elements: [
          el('rect', { name: 'Top band', x: 0, y: 0, w: W, h: 150, fill: p.primary, colorRole: 'primary' }),
          el('rect', { name: 'Accent', x: 0, y: 150, w: W, h: 6, fill: p.secondary, colorRole: 'secondary' }),
          el('text', { name: 'Greeting', x: 24, y: 40, w: 349, h: 70, text: 'Thank You!', fontFamily: 'Georgia', fontSize: 42, fontWeight: 700, align: 'center', vAlign: 'middle', fill: '#FFFFFF' }),
          el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 148, y: 190, w: 100, h: 100, fit: 'contain' }),
          el('text', { name: 'Message', x: 40, y: 310, w: 317, h: 130, text: 'We sincerely appreciate your patronage. It is always a pleasure serving you, and we look forward to being your trusted partner for electronics and solar power solutions.', fontFamily: 'Arial', fontSize: 14, align: 'center', fill: '#333333', lineHeight: 1.5 }),
          el('text', { name: 'Business name', x: 24, y: 452, w: 349, h: 30, text: name, fontFamily: 'Arial', fontSize: 15, fontWeight: 700, align: 'center', fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Contacts', x: 24, y: 484, w: 349, h: 40, text: `${phones}\n${brand.address}`, fontFamily: 'Arial', fontSize: 10.5, align: 'center', fill: '#666666', lineHeight: 1.4 }),
        ],
      },
    ], 'complimentary-card', 'comp-thanks')
  }
  if (style === 'appreciation') {
    return doc(W, H, p.light, [
      {
        ...newPage('Front', p.light),
        elements: [
          el('ellipse', { name: 'Decor circle', x: 260, y: -60, w: 220, h: 220, fill: p.secondary, colorRole: 'secondary', opacity: 0.25 }),
          el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 24, y: 24, w: 72, h: 72, fit: 'contain' }),
          el('text', { name: 'Greeting', x: 24, y: 130, w: 349, h: 56, text: 'You Are Valued 💛', fontFamily: 'Georgia', fontSize: 30, fontWeight: 700, align: 'left', fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Message', x: 24, y: 200, w: 349, h: 180, text: 'Dear valued customer,\n\nThank you for choosing Muhammad Kairu Electronics. Your trust means everything to us. If you ever need a television, refrigerator, fan, or dependable solar power solution, we are always here for you.', fontFamily: 'Arial', fontSize: 13.5, align: 'left', fill: '#333333', lineHeight: 1.55 }),
          el('rect', { name: 'Contact card', x: 24, y: 420, w: 349, h: 92, radius: 10, fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Business name', x: 44, y: 436, w: 309, h: 24, text: name, fontFamily: 'Arial', fontSize: 13, fontWeight: 700, align: 'left', fill: '#FFFFFF' }),
          el('text', { name: 'Contacts', x: 44, y: 462, w: 309, h: 40, text: `${phones}\n${brand.address}`, fontFamily: 'Arial', fontSize: 10, align: 'left', fill: '#E8E4DA', lineHeight: 1.4 }),
        ],
      },
    ], 'complimentary-card', 'comp-appreciation')
  }
  return doc(W, H, '#FFFFFF', [
    {
      ...newPage('Front', '#FFFFFF'),
      elements: [
        el('rect', { name: 'Amber header', x: 0, y: 0, w: W, h: 110, fill: p.secondary, colorRole: 'secondary' }),
        el('text', { name: 'Headline', x: 24, y: 24, w: 349, h: 66, text: 'A Special Offer For You', fontFamily: 'Arial', fontSize: 26, fontWeight: 700, align: 'left', vAlign: 'middle', fill: '#FFFFFF' }),
        el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 148, y: 136, w: 100, h: 100, fit: 'contain' }),
        el('text', { name: 'Message', x: 36, y: 256, w: 325, h: 120, text: 'Present this card at our shop and enjoy a special welcome offer on your next purchase. Ask our team about current deals on TVs, refrigerators, fans and complete solar systems.', fontFamily: 'Arial', fontSize: 13, align: 'center', fill: '#333333', lineHeight: 1.5 }),
        el('rect', { name: 'QR holder', meta: { placeholder: 'qr' }, x: 148, y: 392, w: 100, h: 100, radius: 8, fill: null, stroke: '#CCCCCC', strokeWidth: 2 }),
        el('text', { name: 'Business name', x: 24, y: 502, w: 349, h: 26, text: name, fontFamily: 'Arial', fontSize: 13, fontWeight: 700, align: 'center', fill: p.primary, colorRole: 'primary' }),
        el('text', { name: 'Contacts', x: 24, y: 526, w: 349, h: 24, text: phones, fontFamily: 'Arial', fontSize: 10.5, align: 'center', fill: '#666666' }),
      ],
    },
  ], 'complimentary-card', 'comp-promo')
}

// =====================================================================
// SOCIAL MEDIA POSTS
// =====================================================================

export function buildSocialDoc(style: 'square' | 'status' | 'wide', brand: BrandSettings): DesignDocument {
  const p = brand.palette
  if (style === 'square') {
    return doc(1080, 1080, p.primary, [
      {
        ...newPage('Post', p.primary),
        elements: [
          el('ellipse', { name: 'Decor', x: 720, y: -160, w: 520, h: 520, fill: p.secondary, colorRole: 'secondary', opacity: 0.18 }),
          el('image', { name: 'Product image', meta: { placeholder: 'product' }, x: 90, y: 130, w: 900, h: 520, radius: 24 }),
          el('text', { name: 'Headline', x: 60, y: 60, w: 960, h: 60, text: brand.tagline || 'Quality You Can Trust', fontFamily: 'Arial', fontSize: 40, fontWeight: 700, align: 'center', fill: '#FFFFFF' }),
          el('text', { name: 'Sub heading', x: 90, y: 690, w: 900, h: 130, text: brand.shortDescription, fontFamily: 'Arial', fontSize: 34, align: 'center', fill: '#F1EDE2', lineHeight: 1.35 }),
          el('rect', { name: 'Contact strip', x: 60, y: 870, w: 960, h: 130, radius: 20, fill: p.secondary, colorRole: 'secondary' }),
          el('text', { name: 'Call to action', x: 90, y: 892, w: 900, h: 50, text: 'Call to Enquire Today', fontFamily: 'Arial', fontSize: 34, fontWeight: 700, align: 'center', fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Contacts', x: 90, y: 946, w: 900, h: 40, text: `${brand.phones.join('  •  ')}  •  ${brand.address.split(',').slice(-3, -1).join(',').trim()}`, fontFamily: 'Arial', fontSize: 22, align: 'center', fill: p.primary, colorRole: 'primary' }),
        ],
      },
    ], 'social-post', 'social-square')
  }
  if (style === 'status') {
    return doc(1080, 1920, p.primary, [
      {
        ...newPage('Status', p.primary),
        elements: [
          el('text', { name: 'Headline', x: 60, y: 120, w: 960, h: 200, text: 'NEW STOCK ALERT', fontFamily: 'Arial', fontSize: 72, fontWeight: 900, align: 'center', fill: '#FFFFFF' }),
          el('rect', { name: 'Accent', x: 440, y: 340, w: 200, h: 10, radius: 5, fill: p.secondary, colorRole: 'secondary' }),
          el('image', { name: 'Product image', meta: { placeholder: 'product' }, x: 90, y: 420, w: 900, h: 700, radius: 28 }),
          el('text', { name: 'Sub heading', x: 90, y: 1180, w: 900, h: 200, text: brand.shortDescription, fontFamily: 'Arial', fontSize: 40, align: 'center', fill: '#F1EDE2', lineHeight: 1.4 }),
          el('rect', { name: 'Contact card', x: 90, y: 1500, w: 900, h: 240, radius: 24, fill: '#FFFFFF' }),
          el('text', { name: 'Call to action', x: 120, y: 1530, w: 840, h: 70, text: 'Contact Us Today', fontFamily: 'Arial', fontSize: 48, fontWeight: 700, align: 'center', fill: p.primary, colorRole: 'primary' }),
          el('text', { name: 'Phones', x: 120, y: 1610, w: 840, h: 60, text: brand.phones.join('   •   '), fontFamily: 'Arial', fontSize: 42, fontWeight: 700, align: 'center', fill: p.secondary, colorRole: 'secondary' }),
          el('text', { name: 'Address', x: 120, y: 1674, w: 840, h: 50, text: brand.address, fontFamily: 'Arial', fontSize: 22, align: 'center', fill: '#555555' }),
        ],
      },
    ], 'social-post', 'social-status')
  }
  return doc(1200, 630, p.light, [
    {
      ...newPage('Cover', p.light),
      elements: [
        el('rect', { name: 'Left panel', x: 0, y: 0, w: 480, h: 630, fill: p.primary, colorRole: 'primary' }),
        el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: 120, y: 90, w: 240, h: 240, fit: 'contain' }),
        el('text', { name: 'Business name', x: 40, y: 360, w: 400, h: 60, text: brand.businessName, fontFamily: 'Arial', fontSize: 34, fontWeight: 700, align: 'center', fill: '#FFFFFF' }),
        el('text', { name: 'Phones', x: 40, y: 430, w: 400, h: 40, text: brand.phones.join(' • '), fontFamily: 'Arial', fontSize: 22, align: 'center', fill: p.secondary, colorRole: 'secondary' }),
        el('text', { name: 'Headline', x: 540, y: 120, w: 600, h: 180, text: brand.tagline || 'Your Trusted Electronics & Solar Partner', fontFamily: 'Arial', fontSize: 48, fontWeight: 700, align: 'left', fill: p.primary, colorRole: 'primary', lineHeight: 1.25 }),
        el('text', { name: 'Body', x: 540, y: 320, w: 600, h: 180, text: brand.shortDescription, fontFamily: 'Arial', fontSize: 24, align: 'left', fill: '#444444', lineHeight: 1.45 }),
        el('text', { name: 'Address', x: 540, y: 540, w: 600, h: 50, text: brand.address, fontFamily: 'Arial', fontSize: 17, align: 'left', fill: '#777777' }),
      ],
    },
  ], 'social-post', 'social-wide')
}

// =====================================================================
// Registry
// =====================================================================

export interface TemplateDef {
  id: string
  name: string
  type: ProjectType
  description: string
  build: (brand: BrandSettings) => DesignDocument
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'logo-primary', name: 'Primary Logo — Reference Badge', type: 'logo', description: "Recreates the owner's original badge: sun, solar panel, product silhouettes and bold MK.", build: (b) => buildLogoDoc('primary', b) },
  { id: 'logo-symbol', name: 'Symbol-Only Logo', type: 'logo', description: 'Compact emblem without the business name — ideal for avatars and stamps.', build: (b) => buildLogoDoc('symbol', b) },
  { id: 'logo-horizontal', name: 'Horizontal Logo', type: 'logo', description: 'Emblem beside the business name for headers and signage.', build: (b) => buildLogoDoc('horizontal', b) },
  { id: 'logo-stacked', name: 'Stacked Logo', type: 'logo', description: 'Emblem above the business name — posters and packaging.', build: (b) => buildLogoDoc('stacked', b) },
  { id: 'logo-mono', name: 'Monochrome Logo', type: 'logo', description: 'Single-colour version for stamps, engraving and fax/print.', build: (b) => buildLogoDoc('mono', b) },
  { id: 'letterhead-band', name: 'Letterhead — Navy Band', type: 'letterhead', description: 'Confident top band with amber accent and contact footer.', build: (b) => buildLetterheadDoc('band', b) },
  { id: 'letterhead-side', name: 'Letterhead — Side Accent', type: 'letterhead', description: 'Elegant serif header with a vertical accent band.', build: (b) => buildLetterheadDoc('side', b) },
  { id: 'letterhead-minimal', name: 'Letterhead — Minimal Centre', type: 'letterhead', description: 'Centred classic letterhead for formal correspondence.', build: (b) => buildLetterheadDoc('minimal', b) },
  { id: 'card-navy', name: 'Business Card — Navy Bold', type: 'business-card', description: 'Dark premium front with amber details, contact back.', build: (b) => buildBusinessCardDoc('navy', b) },
  { id: 'card-clean', name: 'Business Card — Clean White', type: 'business-card', description: 'Light professional front with emblem back.', build: (b) => buildBusinessCardDoc('clean', b) },
  { id: 'card-amber', name: 'Business Card — Amber Edge', type: 'business-card', description: 'Bright friendly card with bold back.', build: (b) => buildBusinessCardDoc('amber', b) },
  { id: 'comp-thanks', name: 'Complimentary Card — Thank You', type: 'complimentary-card', description: 'Classic customer thank-you card.', build: (b) => buildComplimentaryDoc('thanks', b) },
  { id: 'comp-appreciation', name: 'Complimentary Card — Appreciation', type: 'complimentary-card', description: 'Warm personal appreciation note.', build: (b) => buildComplimentaryDoc('appreciation', b) },
  { id: 'comp-promo', name: 'Complimentary Card — Promo Insert', type: 'complimentary-card', description: 'Offer insert with optional QR code.', build: (b) => buildComplimentaryDoc('promo', b) },
  { id: 'social-square', name: 'Social Post — Square', type: 'social-post', description: 'Instagram/Facebook square promotional post.', build: (b) => buildSocialDoc('square', b) },
  { id: 'social-status', name: 'WhatsApp Status — Tall', type: 'social-post', description: '1080×1920 status/story announcement.', build: (b) => buildSocialDoc('status', b) },
  { id: 'social-wide', name: 'Facebook Cover — Wide', type: 'social-post', description: '1200×630 landscape cover post.', build: (b) => buildSocialDoc('wide', b) },
]

export function templatesForType(type: ProjectType): TemplateDef[] {
  return TEMPLATES.filter((t) => t.type === type)
}

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
