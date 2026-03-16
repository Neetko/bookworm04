export const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG?.trim() ?? ""

export function buildAmazonProductUrl(identifier: string): string {
  const base = `https://www.amazon.com/dp/${encodeURIComponent(identifier)}/`
  if (!AMAZON_TAG) return base
  return `${base}?tag=${encodeURIComponent(AMAZON_TAG)}`
}

export function buildAmazonSearchUrl(query: string): string {
  const base = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`
  if (!AMAZON_TAG) return base
  return `${base}&tag=${encodeURIComponent(AMAZON_TAG)}`
}
