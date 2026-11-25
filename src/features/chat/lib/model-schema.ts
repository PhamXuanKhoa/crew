import { z } from 'zod'

/**
 * Parses an HTTP(S) endpoint that the server will later call. Rejecting
 * user-info, queries, and fragments keeps the provider URL predictable and
 * prevents smuggling a second target into the URL.
 */
export function parseModelEndpoint(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (url.search || url.hash) return null
    if (!url.hostname) return null
    return url
  } catch {
    return null
  }
}

export const modelEndpointSchema = z
  .string()
  .trim()
  .min(1, 'Please enter a model endpoint URL.')
  .max(2048, 'The endpoint URL is too long.')
  .refine((value) => parseModelEndpoint(value) !== null, 'Enter a valid http(s) URL without credentials, query, or fragment.')
  .transform((value) => value.replace(/\/+$/, ''))

export const modelProfileInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Please enter a display name.').max(80, 'The display name is too long.'),
    model: z.string().trim().min(1, 'Please enter the model identifier.').max(200, 'The model identifier is too long.'),
    endpoint: modelEndpointSchema,
    apiKey: z
      .string()
      .max(512, 'The API key is too long.')
      .optional()
      .transform((value) => (value?.trim() ? value.trim() : undefined)),
  })
  .strict()

export type ModelProfileInput = z.infer<typeof modelProfileInputSchema>

export const deleteModelProfileSchema = z
  .object({
    id: z.string().uuid('Invalid model id.'),
  })
  .strict()
