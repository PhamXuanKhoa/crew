import 'server-only'

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { allowPrivateModelEndpoints, env } from '@/lib/env'

const BLOCKED_HOSTNAMES = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.google.internal.',
  'instance-data',
  'instance-data.ec2.internal',
])

const BLOCKED_IPS = new Set([
  '169.254.169.254',
  '100.100.100.200',
  'fd00:ec2::254',
])

export class ModelEndpointError extends Error {}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().split('%')[0]
  if (value === '::' || value === '::1') return true

  // Conservative: IPv4-mapped/compatible IPv6 forms bypass dotted-quad checks.
  if (value.startsWith('::ffff:') || (value.startsWith('::') && isIP(value.slice(2)) === 4)) {
    const tail = value.startsWith('::ffff:') ? value.slice(7) : value.slice(2)
    return isIP(tail) === 4 ? isPrivateIpv4(tail) : true
  }

  return (
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb') ||
    value.startsWith('ff') ||
    value.startsWith('2001:db8')
  )
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family === 6) return isPrivateIpv6(address)
  return true
}

/**
 * Blocks SSRF-shaped model endpoints. Private hosts are allowed in development
 * so local runners (Ollama, LM Studio, ...) work out of the box. Production
 * requires ALLOW_PRIVATE_MODEL_ENDPOINTS=true and HTTPS otherwise.
 */
export async function assertSafeModelEndpoint(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ModelEndpointError('The model endpoint must use http or https.')
  }
  if (url.username || url.password) {
    throw new ModelEndpointError('The model endpoint must not contain credentials.')
  }

  const hostname = url.hostname.toLowerCase()
  const bareHostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

  if (BLOCKED_HOSTNAMES.has(bareHostname)) {
    throw new ModelEndpointError('That model endpoint is not allowed.')
  }

  if (BLOCKED_IPS.has(bareHostname)) {
    throw new ModelEndpointError('That model endpoint is not allowed.')
  }

  // Development is operator-controlled and commonly points at localhost.
  if (env.NODE_ENV !== 'production' || allowPrivateModelEndpoints) return

  if (url.protocol !== 'https:') {
    throw new ModelEndpointError('Production model endpoints must use HTTPS.')
  }

  let addresses: { address: string }[]
  if (isIP(bareHostname)) {
    addresses = [{ address: bareHostname }]
  } else {
    try {
      addresses = await lookup(bareHostname, { all: true, verbatim: true })
    } catch {
      throw new ModelEndpointError('The model endpoint hostname could not be resolved.')
    }
  }

  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new ModelEndpointError(
      'Private model endpoints are disabled. Set ALLOW_PRIVATE_MODEL_ENDPOINTS=true only for a trusted deployment.'
    )
  }
}
