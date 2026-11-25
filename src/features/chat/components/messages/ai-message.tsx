'use client'

import React, { useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  HelpCircle,
  Loader2,
  MessageSquare,
  MousePointerClick,
  RotateCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { ChatMessage, type AgentStep } from '../../types'
import { MarkdownRenderer } from './markdown-renderer'

interface AiMessageProps {
  message: ChatMessage
  isStreaming?: boolean
  onRegenerate?: () => void
}

function StepIcon({ step }: { step: AgentStep }) {
  if (step.status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#a0a0a0]" />
  }
  if (step.status === 'error' || step.kind === 'error') {
    return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
  }
  if (step.kind === 'question') {
    return <HelpCircle className="h-3.5 w-3.5 shrink-0 text-amber-300" />
  }
  if (step.kind === 'answer') {
    return <MessageSquare className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
  }
  if (step.kind === 'action') {
    return <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-sky-300" />
  }
  return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
}

function AgentSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="mb-3 space-y-1.5 rounded-xl border border-[#2f2f2f] bg-[#1b1b1b] px-3 py-2">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2 text-[12px] leading-relaxed">
          <span className="mt-0.5">
            <StepIcon step={step} />
          </span>
          <div className="min-w-0">
            <span className={step.status === 'error' ? 'text-rose-300' : 'text-[#c9c9c9]'}>
              {step.label}
            </span>
            {step.detail && (
              <p
                className={`mt-0.5 whitespace-pre-wrap break-words text-[11px] ${
                  step.status === 'error' ? 'text-rose-300/80' : 'text-[#8e8e8e]'
                }`}
              >
                {step.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AiMessage({ message, isStreaming = false, onRegenerate }: AiMessageProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null)
  const hasRunningStep = message.agentSteps?.some((step) => step.status === 'running') ?? false

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleLike = () => {
    setFeedback((prev) => (prev === 'liked' ? null : 'liked'))
  }

  const handleDislike = () => {
    setFeedback((prev) => (prev === 'disliked' ? null : 'disliked'))
  }

  return (
    <div className="group mb-8 flex w-full flex-col text-left">
      {/* Agent action / question trace */}
      {message.agentSteps && message.agentSteps.length > 0 && (
        <AgentSteps steps={message.agentSteps} />
      )}

      {/* AI message content */}
      <div className="w-full min-w-0 flex-1">
        {message.content && <MarkdownRenderer content={message.content} />}
        {isStreaming && message.content && (
          <span
            className="ml-1 inline-block h-4 w-2 rounded-[1px] bg-[#ececec] align-middle animate-pulse"
            aria-hidden="true"
          />
        )}
        {isStreaming && !hasRunningStep && (
          <div className="mt-2 flex items-center gap-2 text-xs text-[#8e8e8e]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {/* Action buttons (only show when not streaming or when there is text) */}
      {!isStreaming && message.content && (
        <div className="mt-3 flex items-center gap-1 text-[#8e8e8e]">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md p-1.5 text-xs transition hover:bg-[#2f2f2f] hover:text-[#ececec]"
            title="Copy response"
            aria-label="Copy response"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Copied</span>
              </>
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={handleLike}
            className={`rounded-md p-1.5 transition hover:bg-[#2f2f2f] hover:text-[#ececec] ${
              feedback === 'liked' ? 'text-white' : ''
            }`}
            title="Good response"
            aria-label="Good response"
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${feedback === 'liked' ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleDislike}
            className={`rounded-md p-1.5 transition hover:bg-[#2f2f2f] hover:text-[#ececec] ${
              feedback === 'disliked' ? 'text-white' : ''
            }`}
            title="Bad response"
            aria-label="Bad response"
          >
            <ThumbsDown className={`h-3.5 w-3.5 ${feedback === 'disliked' ? 'fill-current' : ''}`} />
          </button>

          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="rounded-md p-1.5 transition hover:bg-[#2f2f2f] hover:text-[#ececec]"
              title="Regenerate response"
              aria-label="Regenerate response"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
