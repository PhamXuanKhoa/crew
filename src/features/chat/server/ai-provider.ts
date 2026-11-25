import 'server-only'

import { z } from 'zod'
import { env } from '@/lib/env'
import type { ModelProfile } from '../types'
import { buildAgentMessages, type OpenAiChatMessage } from './agent-prompt'
import type { OpenAiToolDefinition, RawToolCall } from './ai-tools'
import { assertSafeModelEndpoint } from './endpoint-guard'

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number = 502
  ) {
    super(message)
  }
}

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.unknown().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().optional(),
                function: z.object({
                  name: z.string(),
                  arguments: z.unknown(),
                }),
              })
            )
            .nullish(),
        }),
      })
    )
    .min(1),
})

export interface ChatCompletionRequest {
  profile: ModelProfile & { apiKey?: string }
  messages: OpenAiChatMessage[]
  tools: OpenAiToolDefinition[]
  requestSignal?: AbortSignal
}

export interface ChatCompletionResult {
  content: string
  toolCalls: RawToolCall[]
}

function buildChatCompletionsUrl(endpoint: string): URL {
  const url = new URL(endpoint)
  const path = url.pathname.replace(/\/+$/, '')
  if (!path.endsWith('/chat/completions')) {
    url.pathname = `${path}/chat/completions`
  }
  return url
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text') {
        const value = (part as { text?: unknown }).text
        return typeof value === 'string' ? value : ''
      }
      return ''
    })
    .join('')
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  const onAbort = () => controller.abort()

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return controller.signal
}

export async function requestAgentStep({
  profile,
  messages,
  tools,
  requestSignal,
}: ChatCompletionRequest): Promise<ChatCompletionResult> {
  let url: URL
  try {
    url = buildChatCompletionsUrl(profile.endpoint)
  } catch {
    throw new AiProviderError('The saved model endpoint URL is invalid. Add the model again.', 400)
  }
  await assertSafeModelEndpoint(url)

  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), env.AI_REQUEST_TIMEOUT_MS)
  const signal = requestSignal
    ? combineSignals([requestSignal, timeoutController.signal])
    : timeoutController.signal

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (profile.apiKey) {
    headers.Authorization = `Bearer ${profile.apiKey}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: profile.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1200,
        stream: false,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal,
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (timeoutController.signal.aborted) {
      throw new AiProviderError('The model request timed out.', 504)
    }
    if (requestSignal?.aborted) {
      throw new AiProviderError('The request was cancelled.', 499)
    }
    console.error('Model endpoint request failed.', error)
    throw new AiProviderError('Unable to reach the model endpoint. Check the URL and network.')
  }

  const announcedLength = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(announcedLength) && announcedLength > 2_000_000) {
    clearTimeout(timeoutId)
    throw new AiProviderError('The model response was too large.')
  }

  let body: string
  try {
    body = await response.text()
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new AiProviderError('The model request timed out.', 504)
    }
    if (requestSignal?.aborted) {
      throw new AiProviderError('The request was cancelled.', 499)
    }
    console.error('Unable to read the model response.', error)
    throw new AiProviderError('Unable to read the model response.')
  } finally {
    clearTimeout(timeoutId)
  }

  if (body.length > 2_000_000) {
    throw new AiProviderError('The model response was too large.')
  }

  if (!response.ok) {
    const detail = body.replace(/\s+/g, ' ').trim().slice(0, 300)
    throw new AiProviderError(
      `The AI provider returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`
    )
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(body)
  } catch {
    throw new AiProviderError('The AI provider returned a non-JSON response.')
  }

  const parsed = completionSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new AiProviderError('The AI provider returned an unexpected response shape.')
  }

  const message = parsed.data.choices[0].message
  const content = contentToText(message.content).trim()

  const toolCalls: RawToolCall[] = (message.tool_calls ?? []).map((call, index) => {
    if (!call.function.name.trim()) {
      throw new AiProviderError('The model returned a tool call without a name.')
    }

    const args =
      typeof call.function.arguments === 'string'
        ? call.function.arguments
        : JSON.stringify(call.function.arguments ?? {})

    return {
      id: call.id?.trim() || `call-${index}`,
      name: call.function.name.trim(),
      arguments: args,
    }
  })

  if (content.length === 0 && toolCalls.length === 0) {
    throw new AiProviderError('The model returned an empty response.')
  }

  return { content, toolCalls }
}

export { buildAgentMessages }
