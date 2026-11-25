'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Loader2, Plus, Server } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChatStore } from '../../store/use-chat-store'
import { modelProfileInputSchema } from '../../lib/model-schema'
import { createModelProfileAction } from '../../actions/model-actions'

interface AddModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMPTY_FORM = {
  name: '',
  model: '',
  endpoint: '',
  apiKey: '',
}

export function AddModelDialog({ open, onOpenChange }: AddModelDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const addModelProfile = useChatStore((s) => s.addModelProfile)

  const updateField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) {
      setForm(EMPTY_FORM)
      setErrorMessage(null)
      setShowApiKey(false)
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    setErrorMessage(null)

    const parsed = modelProfileInputSchema.safeParse({
      name: form.name,
      model: form.model,
      endpoint: form.endpoint,
      apiKey: form.apiKey || undefined,
    })

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Please check the model details.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createModelProfileAction(parsed.data)
      if (!result.ok) {
        setErrorMessage(result.error)
        return
      }

      addModelProfile(result.profile)
      setForm(EMPTY_FORM)
      setShowApiKey(false)
      setErrorMessage(null)
      onOpenChange(false)
    } catch {
      setErrorMessage('Unable to save the model. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[#383838] bg-[#212121] text-[#ececec] sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f2f2f] text-emerald-400">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white">
                Add Model
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8e8e8e]">
                Connect any OpenAI-compatible chat completions endpoint with vision and tool calling.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5 py-1">
          {errorMessage && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="custom-model-name" className="text-xs text-[#ececec]">
              Display Name
            </Label>
            <Input
              id="custom-model-name"
              type="text"
              autoComplete="off"
              placeholder="e.g. GPT-4o or Local Qwen"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              disabled={isSubmitting}
              className="border-[#383838] bg-[#1a1a1a] text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-model-id" className="text-xs text-[#ececec]">
              Model Identifier
            </Label>
            <Input
              id="custom-model-id"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. gpt-4o or qwen2.5-vl:7b"
              value={form.model}
              onChange={(event) => updateField('model', event.target.value)}
              disabled={isSubmitting}
              className="border-[#383838] bg-[#1a1a1a] font-mono text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-model-endpoint" className="text-xs text-[#ececec]">
              Base URL
            </Label>
            <Input
              id="custom-model-endpoint"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. https://api.openai.com/v1 or http://localhost:11434/v1"
              value={form.endpoint}
              onChange={(event) => updateField('endpoint', event.target.value)}
              disabled={isSubmitting}
              className="border-[#383838] bg-[#1a1a1a] text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
            />
            <p className="text-[11px] leading-relaxed text-[#8e8e8e]">
              Use the API base URL. The server appends <span className="font-mono">/chat/completions</span> when needed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-model-api-key" className="text-xs text-[#ececec]">
              API Key <span className="text-[#8e8e8e]">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                id="custom-model-api-key"
                type={showApiKey ? 'text' : 'password'}
                autoComplete="off"
                placeholder="sk-..."
                value={form.apiKey}
                onChange={(event) => updateField('apiKey', event.target.value)}
                disabled={isSubmitting}
                className="border-[#383838] bg-[#1a1a1a] pr-9 text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e8e] transition hover:text-[#ececec]"
                title={showApiKey ? 'Hide API key' : 'Show API key'}
                tabIndex={-1}
              >
                {showApiKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#8e8e8e]">
              Encrypted in an httpOnly server cookie. It is never written to localStorage or exposed to client JavaScript.
            </p>
          </div>

          <DialogFooter className="border-t border-[#2d2d2d] pt-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                className="text-xs text-[#a0a0a0] hover:text-white"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 bg-white text-xs font-medium text-black hover:bg-neutral-200"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>{isSubmitting ? 'Saving...' : 'Add Model'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
