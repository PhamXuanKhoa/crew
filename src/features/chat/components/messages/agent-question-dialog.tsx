'use client'

import React, { useState } from 'react'
import { MessageCircleQuestion, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { PendingQuestion } from '../../hooks/use-vnc-agent'

interface AgentQuestionDialogProps {
  question: PendingQuestion | null
  onAnswer: (answer: string) => void
  onCancel: () => void
}

interface AnswerFormProps {
  question: PendingQuestion
  onAnswer: (answer: string) => void
  onCancel: () => void
}

function AnswerForm({ question, onAnswer, onCancel }: AnswerFormProps) {
  const [answer, setAnswer] = useState('')

  const submit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAnswer(trimmed)
  }

  return (
    <div className="space-y-4 py-1">
      <p className="whitespace-pre-wrap rounded-xl border border-[#333333] bg-[#1a1a1a] p-3 text-sm leading-relaxed text-[#ececec]">
        {question.question}
      </p>

      {question.options && question.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => submit(option)}
              className="rounded-full border border-[#3d3d3d] bg-[#2a2a2a] px-3 py-1.5 text-xs text-[#ececec] transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit(answer)
        }}
        className="space-y-2"
      >
        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          maxLength={4000}
          rows={3}
          autoFocus
          placeholder="Type your answer..."
          className="min-h-20 resize-y border-[#383838] bg-[#1a1a1a] text-sm text-white placeholder-[#666666] focus-visible:border-[#555555]"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit(answer)
            }
          }}
        />
        <p className="text-[11px] leading-relaxed text-[#8e8e8e]">
          Your answer is sent to the selected AI model and shown in this chat.
        </p>

        <DialogFooter className="border-t border-[#2d2d2d] pt-3 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-xs text-[#a0a0a0] hover:text-white"
          >
            Cancel run
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!answer.trim()}
            className="gap-1.5 bg-white text-xs font-medium text-black hover:bg-neutral-200"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send answer</span>
          </Button>
        </DialogFooter>
      </form>
    </div>
  )
}

export function AgentQuestionDialog({ question, onAnswer, onCancel }: AgentQuestionDialogProps) {
  return (
    <Dialog
      open={question !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="border-[#383838] bg-[#212121] text-[#ececec] sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <MessageCircleQuestion className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-white">
                The agent needs your input
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-[#a0a0a0]">
                It paused the remote session and is waiting for your answer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {question && (
          <AnswerForm
            key={question.id}
            question={question}
            onAnswer={onAnswer}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
