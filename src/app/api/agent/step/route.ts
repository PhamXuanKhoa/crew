import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/http/same-origin'
import { agentStepRequestSchema, type AgentStepResponse } from '@/features/chat/lib/agent-schema'
import { getToolDefinitions, ModelToolCallError, parseAgentToolCall } from '@/features/chat/server/ai-tools'
import { AiProviderError, buildAgentMessages, requestAgentStep } from '@/features/chat/server/ai-provider'
import { ModelEndpointError } from '@/features/chat/server/endpoint-guard'
import { getModelProfileWithSecret } from '@/features/chat/server/model-profile-store'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BODY_CHARS = 5_000_000

function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function errorResponse(error: string, status: number): NextResponse {
  return jsonResponse({ error }, status)
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return errorResponse('This endpoint only accepts same-origin requests.', 403)
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return errorResponse('Expected an application/json request body.', 415)
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_CHARS) {
    return errorResponse('The request body is too large.', 413)
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return errorResponse('Unable to read the request body.', 400)
  }

  if (rawBody.length > MAX_BODY_CHARS) {
    return errorResponse('The request body is too large.', 413)
  }

  let input: unknown
  try {
    input = JSON.parse(rawBody)
  } catch {
    return errorResponse('The request body is not valid JSON.', 400)
  }

  const parsed = agentStepRequestSchema.safeParse(input)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request.', 400)
  }

  const profile = await getModelProfileWithSecret(parsed.data.modelId)
  if (!profile) {
    return errorResponse('The selected model is no longer available. Add it again and retry.', 404)
  }

  const desktopConnected = parsed.data.screenshotDataUrl !== null
  const messages = buildAgentMessages({
    task: parsed.data.task,
    history: parsed.data.history,
    screenshotDataUrl: parsed.data.screenshotDataUrl,
    screen: parsed.data.screen,
  })

  try {
    const completion = await requestAgentStep({
      profile,
      messages,
      tools: getToolDefinitions(desktopConnected),
      requestSignal: request.signal,
    })

    if (completion.toolCalls.length > 1) {
      throw new ModelToolCallError('The model requested more than one action in a single step. Please retry.')
    }

    const action =
      completion.toolCalls.length === 1
        ? parseAgentToolCall(completion.toolCalls[0], desktopConnected)
        : null

    const response: AgentStepResponse = {
      message: completion.content.slice(0, 6000),
      action,
    }

    return jsonResponse(response)
  } catch (error) {
    if (error instanceof ModelToolCallError) {
      return errorResponse(error.message, 502)
    }
    if (error instanceof ModelEndpointError) {
      return errorResponse(error.message, 400)
    }
    if (error instanceof AiProviderError) {
      return errorResponse(error.message, error.httpStatus)
    }

    console.error('Agent step failed.', error)
    return errorResponse('The agent could not complete this step.', 500)
  }
}
