import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { env } from '@/lib/env'
import { modelProfileInputSchema } from '../lib/model-schema'
import type { ModelProfile } from '../types'

const COOKIE_NAME = 'dots_model_profiles'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const MAX_PROFILES = 6
const MAX_COOKIE_LENGTH = 3800

const storedProfileSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80),
    model: z.string().min(1).max(200),
    endpoint: z.string().min(1).max(2048),
    apiKey: z.string().max(512).optional(),
  })
  .strict()

const storedCookieSchema = z
  .object({
    version: z.literal(1),
    profiles: z.array(storedProfileSchema).max(MAX_PROFILES),
  })
  .strict()

type StoredProfile = z.infer<typeof storedProfileSchema>
type StoredCookie = z.infer<typeof storedCookieSchema>

const emptyCookie = (): StoredCookie => ({ version: 1, profiles: [] })

const secretEncryptionKey = env.MODEL_CREDENTIALS_SECRET
  ? scryptSync(env.MODEL_CREDENTIALS_SECRET, 'dots-model-profile-cookie-v1', 32)
  : null

export class ModelProfileError extends Error {}

declare global {
  var __dotsModelCookieKey: Buffer | undefined
}

function getEncryptionKey(): Buffer {
  if (secretEncryptionKey) return secretEncryptionKey

  if (env.NODE_ENV === 'production') {
    throw new ModelProfileError(
      'MODEL_CREDENTIALS_SECRET is not configured. Set a 32+ character secret before storing model credentials.'
    )
  }

  // Development convenience: keep the key stable across HMR, but never
  // pretend it is durable across server restarts.
  globalThis.__dotsModelCookieKey ??= randomBytes(32)
  return globalThis.__dotsModelCookieKey
}

function seal(value: StoredCookie): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  cipher.setAAD(Buffer.from(COOKIE_NAME, 'utf8'))

  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.')
}

function open(raw: string): StoredCookie {
  const parts = raw.split('.')
  if (parts.length !== 3) return emptyCookie()

  try {
    const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'))
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
    decipher.setAAD(Buffer.from(COOKIE_NAME, 'utf8'))
    decipher.setAuthTag(tag)

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    const parsed = storedCookieSchema.safeParse(JSON.parse(plaintext))
    return parsed.success ? parsed.data : emptyCookie()
  } catch {
    return emptyCookie()
  }
}

async function readStore(): Promise<StoredCookie> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get(COOKIE_NAME)?.value
    return raw ? open(raw) : emptyCookie()
  } catch {
    return emptyCookie()
  }
}

async function writeStore(value: StoredCookie): Promise<void> {
  const sealed = seal(value)
  if (sealed.length > MAX_COOKIE_LENGTH) {
    throw new ModelProfileError('Too many model profiles. Delete one before adding another.')
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

const toDto = (profile: StoredProfile): ModelProfile => ({
  id: profile.id,
  name: profile.name,
  model: profile.model,
  endpoint: profile.endpoint,
})

export async function listModelProfiles(): Promise<ModelProfile[]> {
  const store = await readStore()
  return store.profiles.map(toDto)
}

export async function createModelProfile(input: unknown): Promise<ModelProfile> {
  const parsed = modelProfileInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ModelProfileError(parsed.error.issues[0]?.message ?? 'Please check the model details.')
  }

  const store = await readStore()
  if (store.profiles.length >= MAX_PROFILES) {
    throw new ModelProfileError(`You can save at most ${MAX_PROFILES} models. Delete one first.`)
  }

  const profile: StoredProfile = {
    id: randomUUID(),
    name: parsed.data.name,
    model: parsed.data.model,
    endpoint: parsed.data.endpoint,
    ...(parsed.data.apiKey ? { apiKey: parsed.data.apiKey } : {}),
  }

  await writeStore({ ...store, profiles: [...store.profiles, profile] })
  return toDto(profile)
}

export async function deleteModelProfile(id: string): Promise<void> {
  const store = await readStore()
  const profiles = store.profiles.filter((profile) => profile.id !== id)
  if (profiles.length === store.profiles.length) return
  await writeStore({ ...store, profiles })
}

/**
 * Server-only lookup used by the agent route. The returned object contains the
 * API key; never return it from a route or Server Action.
 */
export async function getModelProfileWithSecret(id: string): Promise<StoredProfile | null> {
  const store = await readStore()
  return store.profiles.find((profile) => profile.id === id) ?? null
}
