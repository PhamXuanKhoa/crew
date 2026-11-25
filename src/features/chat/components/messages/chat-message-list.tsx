'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ChatMessage } from '../../types'
import { UserMessage } from './user-message'
import { AiMessage } from './ai-message'
import { EmptyState } from './empty-state'
import { ScrollToBottomButton } from '../composer/scroll-to-bottom-button'

interface ChatMessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  hasSelectedModel: boolean
  onSelectSuggestion: (prompt: string) => void
  onRegenerateLast?: () => void
}

export function ChatMessageList({
  messages,
  isStreaming,
  hasSelectedModel,
  onSelectSuggestion,
  onRegenerateLast,
}: ChatMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const isAutoScrollBlocked = useRef(false)

  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
    setShowScrollButton(false)
    isAutoScrollBlocked.current = false
  }, [])

  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const isScrolledUp = distanceFromBottom > 100

    setShowScrollButton(isScrolledUp)
    isAutoScrollBlocked.current = isScrolledUp
  }

  // Auto-scroll when messages or streaming content changes
  useEffect(() => {
    if (!isAutoScrollBlocked.current) {
      scrollToBottom(false)
    }
  }, [messages, isStreaming, scrollToBottom])

  if (messages.length === 0) {
    return (
      <div className="relative flex h-full flex-1 flex-col overflow-y-auto">
        <EmptyState
          hasSelectedModel={hasSelectedModel}
          onSelectSuggestion={onSelectSuggestion}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden">
      {/* Scrollable messages container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-[#2f2f2f]"
      >
        <div className="mx-auto max-w-3xl">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1

            if (message.role === 'user') {
              return <UserMessage key={message.id} message={message} />
            }

            return (
              <AiMessage
                key={message.id}
                message={message}
                isStreaming={isStreaming && isLast}
                onRegenerate={isLast && !isStreaming ? onRegenerateLast : undefined}
              />
            )
          })}
        </div>
      </div>

      {/* Floating scroll to bottom button */}
      <ScrollToBottomButton
        visible={showScrollButton}
        onClick={() => scrollToBottom(true)}
      />
    </div>
  )
}

