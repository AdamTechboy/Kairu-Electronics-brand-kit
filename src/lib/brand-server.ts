import { DEFAULT_BRAND } from '@/lib/brand'

export interface BrandSettingsJSON {
  businessName: string
  businessCategory: string
  description: string
  shortDescription: string
  tagline: string
  address: string
  phones: string[]
  email: string
  website: string
  socials: { label: string; handle: string }[]
  openingHours: string
  extraInfo: string
  logoProjectId: string | null
  logoApplyToSite: boolean
  logoApplyToNewDesigns: boolean
  palette: { primary: string; secondary: string; accent: string; dark: string; light: string }
  typography: { headingFont: string; bodyFont: string }
}

export interface BrandRow {
  businessName: string
  businessCategory: string
  description: string
  shortDescription: string
  tagline: string
  address: string
  phones: string
  email: string
  website: string
  socials: string
  openingHours: string
  extraInfo: string
  logoProjectId: string | null
  logoApplyToSite: boolean
  logoApplyToNewDesigns: boolean
  palette: string
  typography: string
}

export function parseBrand(row: BrandRow): BrandSettingsJSON {
  const safeJson = <T>(s: string, fallback: T): T => {
    try {
      return JSON.parse(s) as T
    } catch {
      return fallback
    }
  }
  return {
    businessName: row.businessName,
    businessCategory: row.businessCategory,
    description: row.description,
    shortDescription: row.shortDescription,
    tagline: row.tagline,
    address: row.address,
    phones: safeJson<string[]>(row.phones, []),
    email: row.email,
    website: row.website,
    socials: safeJson<{ label: string; handle: string }[]>(row.socials, []),
    openingHours: row.openingHours,
    extraInfo: row.extraInfo,
    logoProjectId: row.logoProjectId,
    logoApplyToSite: row.logoApplyToSite !== false,
    logoApplyToNewDesigns: row.logoApplyToNewDesigns !== false,
    palette: { ...DEFAULT_BRAND.palette, ...safeJson(row.palette, {}) },
    typography: { ...DEFAULT_BRAND.typography, ...safeJson(row.typography, {}) },
  }
}

export function defaultBrandRowData() {
  return {
    businessName: DEFAULT_BRAND.businessName,
    businessCategory: DEFAULT_BRAND.businessCategory,
    description: DEFAULT_BRAND.description,
    shortDescription: DEFAULT_BRAND.shortDescription,
    tagline: DEFAULT_BRAND.tagline,
    address: DEFAULT_BRAND.address,
    phones: JSON.stringify(DEFAULT_BRAND.phones),
    socials: JSON.stringify(DEFAULT_BRAND.socials),
    logoApplyToSite: true,
    logoApplyToNewDesigns: true,
    palette: JSON.stringify(DEFAULT_BRAND.palette),
    typography: JSON.stringify(DEFAULT_BRAND.typography),
  }
}
