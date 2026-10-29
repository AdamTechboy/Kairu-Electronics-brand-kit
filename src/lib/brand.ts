// Brand identity types + defaults for Muhammad Kairu Electronics
// Business data comes from the owner's verified specification.

export interface BrandPalette {
  primary: string
  secondary: string
  accent: string
  dark: string
  light: string
}

export interface BrandTypography {
  headingFont: string
  bodyFont: string
}

export interface SocialHandle {
  label: string
  handle: string
}

export interface BrandSettings {
  businessName: string
  businessCategory: string
  description: string
  shortDescription: string
  tagline: string
  address: string
  phones: string[]
  email: string
  website: string
  socials: SocialHandle[]
  openingHours: string
  extraInfo: string
  logoProjectId: string | null
  logoApplyToSite: boolean
  logoApplyToNewDesigns: boolean
  palette: BrandPalette
  typography: BrandTypography
}

export const DEFAULT_PALETTE: BrandPalette = {
  primary: '#1F2A44', // deep navy (owner's reference logo badge)
  secondary: '#F5A623', // solar amber (owner's reference logo sun)
  accent: '#C43D2F', // warm signal red for offers/highlights
  dark: '#101820',
  light: '#F7F5F0',
}

export const DEFAULT_TYPOGRAPHY: BrandTypography = {
  headingFont: 'Arial',
  bodyFont: 'Arial',
}

// Verified business information supplied by the owner (spec section 2).
export const DEFAULT_BRAND: BrandSettings = {
  businessName: 'Muhammad Kairu Electronics',
  businessCategory: 'Electronics Retail & Solar Energy',
  description:
    'Discover quality electronics and solar power solutions at Muhammad Kairu Electronics. From televisions, refrigerators and electric fans to solar panels, inverters, batteries and essential solar accessories, we bring together products designed to support everyday living, home comfort and dependable power solutions. Visit our shop at No. 41 Ahmadu Bello Way, Shop 31A, Rochas Plaza, Jos, Plateau State, or contact us on 07038365737 or 09037621052 for product enquiries and availability.',
  shortDescription:
    'Quality electronics and solar power solutions in Jos — TVs, refrigerators, fans, solar panels, inverters, batteries and accessories.',
  tagline: 'Powering Homes. Entertaining Families.',
  address: 'No. 41 Ahmadu Bello Way, Shop 31A, Rochas Plaza, Jos, Plateau State, Nigeria',
  phones: ['07038365737', '09037621052'],
  email: '',
  website: '',
  socials: [],
  openingHours: '',
  extraInfo: '',
  logoProjectId: null,
  logoApplyToSite: true,
  logoApplyToNewDesigns: true,
  palette: DEFAULT_PALETTE,
  typography: DEFAULT_TYPOGRAPHY,
}

export function slugifyFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'design'
  )
}

export function formatNaira(value: string | number): string {
  if (value === '' || value === null || value === undefined) return ''
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return String(value)
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 2 })
}

export const AVAILABILITY_OPTIONS = [
  'In Stock',
  'Limited Stock',
  'Out of Stock',
  'Pre-order',
  'Coming Soon',
]

export const PRODUCT_CATEGORIES = [
  'Solar Panels',
  'Solar Inverters',
  'Solar Batteries',
  'Solar Accessories',
  'Televisions',
  'Refrigerators',
  'Electric Fans',
  'Other Electronics',
]
