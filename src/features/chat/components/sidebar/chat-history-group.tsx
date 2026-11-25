'use client'

import React from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'
import { Conversation } from '../../types'

interface ChatHistoryGroupProps {
  label: string
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function ChatHistoryGroup({
  label,
  conversations,
  activeId,
  onSelect,
  onDelete,
}: ChatHistoryGroupProps) {
  if (conversations.length === 0) return null

  return (
    <div className="mb-4">
      {/* Group label */}
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
        {label}
      </div>

      {/* List */}
      <div className="space-y-0.5">
        {conversations.map((conv) => {
          const isActive = conv.id === activeId

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition cursor-pointer select-none ${
                isActive
                  ? 'bg-[#212121] text-white font-medium'
                  : 'text-[#c5c5c5] hover:bg-[#212121]/70 hover:text-white'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5 pr-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-[#8e8e8e] group-hover:text-[#ececec]" />
                <span className="truncate">{conv.title || 'New chat'}</span>
              </div>

              {/* Delete button (visible on hover or active) */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(conv.id)
                }}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-[#8e8e8e] transition hover:bg-[#2f2f2f] hover:text-rose-400"
                title="Delete conversation"
                aria-label={`Delete ${conv.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

