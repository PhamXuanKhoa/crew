'use client'

import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { ChatMessage } from '../../types'

interface UserMessageProps {
  message: ChatMessage
}

export function UserMessage({ message }: UserMessageProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="group relative mb-6 flex flex-col items-end">
      <div className="max-w-[85%] sm:max-w-[70%] rounded-[24px] bg-[#2f2f2f] px-5 py-2.5 text-[15px] leading-relaxed text-white shadow-sm select-text">
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      <div className="mt-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md p-1 text-xs text-[#8e8e8e] transition hover:bg-[#2f2f2f] hover:text-[#ececec]"
          aria-label="Copy prompt"
          title="Copy"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

