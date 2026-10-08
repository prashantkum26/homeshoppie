import { SEO_CONFIG } from './config'

export function absoluteUrl(path = ''): string {
  const base = SEO_CONFIG.siteUrl.replace(/\/+$/, '')

  if (!path) {
    return base
  }

  return `${base}/${path.replace(/^\/+/, '')}`
}

export function cleanText(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncateDescription(
  value: string,
  maxLength = 160
): string {
  const text = cleanText(value)

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 3).trim()}...`
}

export function createSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}