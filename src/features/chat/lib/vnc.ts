import { z } from 'zod'

/** Default port of the WebSocket proxy (websockify) that fronts the VNC server. */
export const DEFAULT_VNC_WS_PORT = 6080

/** Conventional websockify path exposed by the proxy. */
export const VNC_WEBSOCKIFY_PATH = '/websockify'

const HOST_ERROR =
  'Enter a plain hostname or IP address (no scheme, port, or path).'

/**
 * Accepts only a bare hostname / IP literal. Parsing with URL rejects
 * attempts to smuggle a scheme, port, credentials, path, or query into the
 * host, so it can never change the origin/path of the WebSocket URL.
 */
function normalizeHost(value: string): string | null {
  try {
    const parsed = new URL(`ws://${value}`)
    const isBareHost =
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.port === '' &&
      parsed.pathname === '/' &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.hostname !== ''

    return isBareHost ? parsed.hostname : null
  } catch {
    return null
  }
}

export const vncConnectionSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1, 'Please enter an IP address or hostname.')
    .max(253, HOST_ERROR)
    .refine((value) => normalizeHost(value) !== null, HOST_ERROR),
  port: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, 'Enter a valid port (1-65535).')
    .transform(Number)
    .refine((port) => port >= 1 && port <= 65535, 'Enter a valid port (1-65535).'),
  username: z.string().trim().max(255, 'Username is too long.').optional(),
  password: z.string().min(1, 'Please enter a password.'),
})

export type VncConnection = z.infer<typeof vncConnectionSchema>

/**
 * Builds ws(s)://<host>:<proxy-port>/websockify for the browser-side noVNC
 * client. Uses wss on HTTPS pages because browsers block mixed-content ws://.
 */
export function buildVncWebSocketUrl({
  host,
  port,
}: Pick<VncConnection, 'host' | 'port'>): string {
  const normalizedHost = normalizeHost(host)
  if (!normalizedHost) {
    throw new Error(HOST_ERROR)
  }

  const scheme =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'wss'
      : 'ws'

  return `${scheme}://${normalizedHost}:${port}${VNC_WEBSOCKIFY_PATH}`
}
