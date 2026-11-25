'use server'

import { deleteModelProfileSchema } from '../lib/model-schema'
import type { ModelProfile } from '../types'
import {
  createModelProfile,
  deleteModelProfile,
  ModelProfileError,
} from '../server/model-profile-store'

export type CreateModelResult =
  | { ok: true; profile: ModelProfile }
  | { ok: false; error: string }

export type DeleteModelResult = { ok: true } | { ok: false; error: string }

export async function createModelProfileAction(input: unknown): Promise<CreateModelResult> {
  try {
    const profile = await createModelProfile(input)
    return { ok: true, profile }
  } catch (error) {
    if (error instanceof ModelProfileError) {
      return { ok: false, error: error.message }
    }
    console.error('Unable to save model profile.', error)
    return { ok: false, error: 'Unable to save the model profile.' }
  }
}

export async function deleteModelProfileAction(input: unknown): Promise<DeleteModelResult> {
  const parsed = deleteModelProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid model id.' }
  }

  try {
    await deleteModelProfile(parsed.data.id)
    return { ok: true }
  } catch (error) {
    if (error instanceof ModelProfileError) {
      return { ok: false, error: error.message }
    }
    console.error('Unable to delete model profile.', error)
    return { ok: false, error: 'Unable to delete the model profile.' }
  }
}
