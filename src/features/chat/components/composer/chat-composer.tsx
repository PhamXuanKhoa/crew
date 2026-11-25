'use client'

import React, { useRef, useEffect, useState } from 'react'
import { ArrowUp, Globe, Mic, Plus, Square } from 'lucide-react'

interface ChatComposerProps {
  input: string
  setInput: (value: string) => void
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  noModelSelected?: boolean
}

export function ChatComposer({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  noModelSelected = false,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [webSearchActive, setWebSearchActive] = useState(false)

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 200)
    textarea.style.height = `${Math.max(newHeight, 24)}px`
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isStreaming && input.trim()) {
        handleSubmit()
      }
    }
  }

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
    }
  }

  const canSubmit = input.trim().length > 0 && !isStreaming && !disabled

  return (
    <div className="w-full max-w-3xl px-3 sm:px-4">
      {/* Pill container */}
      <div className="relative rounded-[28px] border border-[#383838] bg-[#2f2f2f] p-3 shadow-lg transition-colors focus-within:border-[#525252]">
        {/* Text input area */}
        <div className="flex w-full items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noModelSelected ? 'Select a model to start chatting' : 'Message Dots'}
            disabled={disabled}
            className="w-full resize-none border-none bg-transparent px-2 text-[15px] leading-relaxed text-[#ececec] placeholder-[#8e8e8e] outline-none focus:outline-none focus:ring-0"
            style={{ maxHeight: '200px' }}
          />
        </div>

        {/* Action icons bar */}
        <div className="mt-2 flex items-center justify-between pt-1">
          {/* Left tools */}
          <div className="flex items-center gap-1 text-[#b4b4b4]">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[#3d3d3d] hover:text-white"
              title="Attach files"
              aria-label="Attach files"
            >
              <Plus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setWebSearchActive(!webSearchActive)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${
                webSearchActive
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'hover:bg-[#3d3d3d] hover:text-white'
              }`}
              title="Search the web"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>

          {/* Right tools: Voice & Submit/Stop */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#b4b4b4] transition hover:bg-[#3d3d3d] hover:text-white"
              title="Voice mode"
              aria-label="Voice mode"
            >
              <Mic className="h-4 w-4" />
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:opacity-90 active:scale-95"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-black" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 ${
                  canSubmit
                    ? 'bg-white text-black hover:opacity-90 cursor-pointer shadow-sm'
                    : 'bg-[#424242] text-[#8e8e8e] cursor-not-allowed opacity-60'
                }`}
                title="Send message"
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="py-2 text-center text-[11px] text-[#8e8e8e]">
        Dots can make mistakes. Check important info.
      </div>
    </div>
  )
}
