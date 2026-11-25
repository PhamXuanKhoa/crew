import 'server-only'

/**
 * Rejects cross-site POSTs to cookie-authenticated route handlers. Browsers
 * always attach `Origin` to a cross-origin POST, so a mismatch cannot be
 * forged by another site. Server Actions additionally have Next.js's built-in
 * origin checks.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false

  const origin = request.headers.get('origin')
  if (!origin) {
    // Some browsers omit Origin for same-origin POSTs but always set this
    // forbidden header, which a cross-site page cannot forge.
    return fetchSite === 'same-origin'
  }
  if (origin === 'null') return false

  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    return false
  }

  if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') return false

  const host = request.headers.get('host')
  if (!host) return false

  return originUrl.host === host
}
