import 'server-only'

import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * Encrypts model API keys before they are placed in an httpOnly cookie.
   * Required in production; development falls back to an ephemeral per-process
   * key so the app still runs without configuration.
   */
  MODEL_CREDENTIALS_SECRET: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return undefined
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    },
    z.string().min(32, 'MODEL_CREDENTIALS_SECRET must be at least 32 characters.').optional()
  ),
  /**
   * Opt in to model endpoints on localhost / private networks. Disabled by
   * default in production to reduce SSRF exposure.
   */
  ALLOW_PRIVATE_MODEL_ENDPOINTS: z.enum(['true', 'false']).default('false'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(60_000),
})

export const env = envSchema.parse(process.env)

export const allowPrivateModelEndpoints = env.ALLOW_PRIVATE_MODEL_ENDPOINTS === 'true'
