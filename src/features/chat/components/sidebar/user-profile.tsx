'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Settings, Trash2, Sparkles } from 'lucide-react'
import { useChatStore } from '../../store/use-chat-store'

export function UserProfile() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const clearAllConversations = useChatStore((s) => s.clearAllConversations)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative border-t border-[#262626] p-2" ref={menuRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg p-2 text-left transition hover:bg-[#212121] group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-xs font-semibold text-white shadow-xs">
            K
          </div>
          {/* Info */}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-[#ececec] group-hover:text-white">
              Khoa
            </span>
            <span className="text-[11px] text-[#8e8e8e]">Free plan</span>
          </div>
        </div>

        <MoreHorizontal className="h-4 w-4 text-[#8e8e8e] group-hover:text-[#ececec]" />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-2 right-2 mb-2 z-50 rounded-xl border border-[#333333] bg-[#1e1e1e] p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95">
          <div className="px-2 py-1.5 text-xs text-[#8e8e8e] font-medium border-b border-[#2d2d2d] mb-1">
            khoa@example.com
          </div>

          <button
            onClick={() => {
              setIsOpen(false)
              alert('Settings: Model defaults, preferences, and customization.')
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-[#ececec] transition hover:bg-[#282828]"
          >
            <Settings className="h-4 w-4 text-[#a0a0a0]" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false)
              alert('Dots Plus: Access GPT-4o, unlimited image generation, and custom GPTs.')
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-[#ececec] transition hover:bg-[#282828]"
          >
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>Upgrade to Plus</span>
          </button>

          <div className="my-1 border-t border-[#2d2d2d]" />

          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete all conversations?')) {
                clearAllConversations()
                setIsOpen(false)
              }
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-rose-400 transition hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear all conversations</span>
          </button>
        </div>
      )}
    </div>
  )
}
