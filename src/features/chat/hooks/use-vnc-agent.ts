'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  agentStepResponseSchema,
  type AgentHistoryEntry,
} from '../lib/agent-schema'
import {
  AgentCancelledError,
  describeAgentAction,
  executeAgentAction,
  throwIfAborted,
} from '../lib/agent-executor'
import type { VncAgentController } from '../lib/vnc-agent-controller'
import { useChatStore } from '../store/use-chat-store'
import type { AgentStep } from '../types'

const MAX_AGENT_STEPS = 20

export interface PendingQuestion {
  id: string
  question: string
  options?: string[]
}

interface RunAgentInput {
  conversationId: string
  assistantMessageId: string
  modelId: string
  task: string
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong while talking to the model.'
}

export function useVncAgent(controllerRef: RefObject<VncAgentController | null>) {
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const questionResolverRef = useRef<((answer: string | null) => void) | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runIdRef = useRef(0)

  const askUser = useCallback(
    (question: string, options: string[] | undefined, signal: AbortSignal): Promise<string | null> => {
      return new Promise((resolve) => {
        if (signal.aborted) {
          resolve(null)
          return
        }

        let settled = false
        const finish = (answer: string | null) => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', onAbort)
          questionResolverRef.current = null
          setPendingQuestion(null)
          resolve(answer)
        }
        const onAbort = () => finish(null)

        signal.addEventListener('abort', onAbort, { once: true })
        questionResolverRef.current = finish
        setPendingQuestion({
          id: createId('question'),
          question,
          ...(options && options.length > 0 ? { options } : {}),
        })
      })
    },
    []
  )

  const answerQuestion = useCallback((answer: string) => {
    const trimmed = answer.trim()
    if (!trimmed) return
    questionResolverRef.current?.(trimmed)
  }, [])

  const cancelQuestion = useCallback(() => {
    questionResolverRef.current?.(null)
  }, [])

  const stopAgent = useCallback(() => {
    abortRef.current?.abort()
    questionResolverRef.current?.(null)
  }, [])

  const runAgent = useCallback(
    async ({ conversationId, assistantMessageId, modelId, task }: RunAgentInput) => {
      abortRef.current?.abort()
      questionResolverRef.current?.(null)

      const runId = runIdRef.current + 1
      runIdRef.current = runId

      const controller = new AbortController()
      abortRef.current = controller
      const signal = controller.signal

      const store = useChatStore.getState()
      const updateContent = store.updateMessageContent
      const appendStep = store.appendAgentStep
      const updateStep = store.updateAgentStep

      store.setStreaming(true)

      const history: AgentHistoryEntry[] = [{ role: 'user', content: task.slice(0, 4000) }]
      let content = ''
      let finished = false

      const addStep = (step: AgentStep) => {
        appendStep(conversationId, assistantMessageId, step)
        return step.id
      }

      const appendContent = (text: string) => {
        if (!text.trim()) return
        content = content ? `${content}\n\n${text}` : text
        updateContent(conversationId, assistantMessageId, content)
      }

      try {
        for (let stepIndex = 0; stepIndex < MAX_AGENT_STEPS; stepIndex++) {
          throwIfAborted(signal)

          const vnc = controllerRef.current
          const screenshot = vnc?.isConnected() ? vnc.captureScreenshot() : null

          const response = await fetch('/api/agent/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            signal,
            body: JSON.stringify({
              modelId,
              task,
              history: history.slice(-32),
              screenshotDataUrl: screenshot?.dataUrl ?? null,
              screen: screenshot ? { width: screenshot.width, height: screenshot.height } : null,
            }),
          })

          if (!response.ok) {
            let serverError = `The agent request failed (HTTP ${response.status}).`
            try {
              const payload: unknown = await response.json()
              if (payload && typeof payload === 'object' && 'error' in payload) {
                const value = (payload as { error?: unknown }).error
                if (typeof value === 'string' && value.trim()) {
                  serverError = value
                }
              }
            } catch {
              // Keep the generic status message.
            }
            throw new Error(serverError)
          }

          const parsed = agentStepResponseSchema.safeParse(await response.json())
          if (!parsed.success) {
            throw new Error('The agent returned an invalid response.')
          }

          const { message, action } = parsed.data
          if (message) {
            appendContent(message)
            history.push({ role: 'assistant', content: message.slice(0, 4000) })
          }

          if (!action) {
            finished = true
            break
          }

          const description = describeAgentAction(action)

          if (action.name === 'ask_user') {
            const questionStepId = addStep({
              id: createId('step'),
              kind: 'question',
              label: 'Waiting for your answer',
              detail: action.args.question,
              status: 'running',
            })

            history.push({
              role: 'assistant',
              content: `Asked user: ${action.args.question}`.slice(0, 4000),
            })

            const answer = await askUser(action.args.question, action.args.options, signal)
            if (answer === null) {
              updateStep(conversationId, assistantMessageId, questionStepId, {
                status: 'error',
                detail: `${action.args.question} — cancelled`,
              })
              throw new AgentCancelledError()
            }

            updateStep(conversationId, assistantMessageId, questionStepId, { status: 'done' })
            addStep({
              id: createId('step'),
              kind: 'answer',
              label: 'You answered',
              detail: answer.slice(0, 4000),
              status: 'done',
            })
            history.push({ role: 'user', content: `User answer: ${answer}`.slice(0, 4000) })
            continue
          }

          if (action.name === 'finish') {
            addStep({
              id: createId('step'),
              kind: 'action',
              label: description.label,
              ...(description.detail ? { detail: description.detail.slice(0, 4000) } : {}),
              status: 'done',
            })
            if (!content.trim() && action.args.summary) {
              appendContent(action.args.summary)
            }
            finished = true
            break
          }

          if (!vnc) {
            throw new Error('The remote desktop is no longer connected.')
          }

          const activeController = controllerRef.current
          if (!activeController) {
            throw new Error('The remote desktop is no longer connected.')
          }

          const actionStepId = addStep({
            id: createId('step'),
            kind: 'action',
            label: description.label,
            ...(description.detail ? { detail: description.detail.slice(0, 4000) } : {}),
            status: 'running',
          })

          try {
            await executeAgentAction(activeController, action, signal)
            updateStep(conversationId, assistantMessageId, actionStepId, { status: 'done' })
            history.push({
              role: 'action',
              content: `${description.label}${description.detail ? ` (${description.detail})` : ''} -> completed`.slice(
                0,
                4000
              ),
            })
          } catch (actionError) {
            if (actionError instanceof AgentCancelledError || signal.aborted) {
              updateStep(conversationId, assistantMessageId, actionStepId, { status: 'error' })
              throw new AgentCancelledError()
            }

            const detail = errorMessage(actionError)
            updateStep(conversationId, assistantMessageId, actionStepId, {
              status: 'error',
              detail: `${description.detail ?? description.label} — ${detail}`.slice(0, 4000),
            })
            history.push({
              role: 'observation',
              content: `${description.label} failed: ${detail}`.slice(0, 4000),
            })
          }
        }

        if (!finished && !signal.aborted) {
          addStep({
            id: createId('step'),
            kind: 'error',
            label: 'Stopped',
            detail: `The agent reached the ${MAX_AGENT_STEPS}-step limit.`,
            status: 'error',
          })
        }
      } catch (error) {
        if (error instanceof AgentCancelledError || signal.aborted) {
          if (runIdRef.current === runId) {
            addStep({
              id: createId('step'),
              kind: 'error',
              label: 'Run stopped',
              status: 'done',
            })
          }
          return
        }

        const detail = errorMessage(error)
        addStep({
          id: createId('step'),
          kind: 'error',
          label: 'Agent error',
          detail: detail.slice(0, 4000),
          status: 'error',
        })
        if (!content.trim()) {
          appendContent(`I couldn't complete that: ${detail}`)
        }
      } finally {
        if (runIdRef.current === runId) {
          abortRef.current = null
          useChatStore.getState().setStreaming(false)
        }
      }
    },
    [askUser, controllerRef]
  )

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      questionResolverRef.current?.(null)
    }
  }, [])

  return {
    runAgent,
    stopAgent,
    pendingQuestion,
    answerQuestion,
    cancelQuestion,
  }
}
