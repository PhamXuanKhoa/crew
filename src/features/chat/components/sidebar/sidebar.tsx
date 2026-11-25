'use client'

import React, { useMemo } from 'react'
import {
  PanelLeftClose,
  Plus,
  SquarePen,
} from 'lucide-react'
import { useChatStore } from '../../store/use-chat-store'
import { groupConversationsByDate } from '../../lib/date-utils'
import { ChatHistoryGroup } from './chat-history-group'
import { UserProfile } from './user-profile'
import { RandomAvatar } from './random-avatar'

interface SidebarProps {
  onCloseMobile?: () => void
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const conversations = useChatStore((s) => s.conversations)
  const currentConversationId = useChatStore((s) => s.currentConversationId)
  const resetToNewChat = useChatStore((s) => s.resetToNewChat)
  const selectConversation = useChatStore((s) => s.selectConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const toggleSidebar = useChatStore((s) => s.toggleSidebar)

  const grouped = useMemo(() => {
    return groupConversationsByDate(conversations)
  }, [conversations])

  const handleNewChat = () => {
    resetToNewChat()
    if (onCloseMobile) {
      onCloseMobile()
    }
  }

  const handleSelect = (id: string) => {
    selectConversation(id)
    if (onCloseMobile) {
      onCloseMobile()
    }
  }

  return (
    <aside className="flex h-full w-[260px] min-w-[260px] flex-col bg-[#171717] text-[#ececec] border-r border-[#262626] select-none">
      {/* Top action row */}
      <div className="flex items-center justify-between p-3 pb-2">
        {/* Random Avatar logo from /public/avatars/ */}
        <div className="flex items-center gap-2.5 px-1">
          <RandomAvatar className="h-7 w-7" size={28} />
          <span className="font-semibold text-sm tracking-tight text-white">Dots</span>
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-[#8e8e8e] transition hover:bg-[#212121] hover:text-[#ececec]"
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center justify-between rounded-lg border border-[#2d2d2d] bg-[#212121] px-3 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-[#282828] active:scale-[0.99]"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#ececec]" />
            <span>New chat</span>
          </div>
          <SquarePen className="h-4 w-4 text-[#8e8e8e]" />
        </button>
      </div>

      {/* Grouped Chat History */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-[#282828]">
        {conversations.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8e8e8e]">
            No previous chats
          </div>
        ) : (
          <>
            <ChatHistoryGroup
              label="Today"
              conversations={grouped.today}
              activeId={currentConversationId}
              onSelect={handleSelect}
              onDelete={deleteConversation}
            />
            <ChatHistoryGroup
              label="Yesterday"
              conversations={grouped.yesterday}
              activeId={currentConversationId}
              onSelect={handleSelect}
              onDelete={deleteConversation}
            />
            <ChatHistoryGroup
              label="Previous 7 Days"
              conversations={grouped.previous7Days}
              activeId={currentConversationId}
              onSelect={handleSelect}
              onDelete={deleteConversation}
            />
            <ChatHistoryGroup
              label="Older"
              conversations={grouped.older}
              activeId={currentConversationId}
              onSelect={handleSelect}
              onDelete={deleteConversation}
            />
          </>
        )}
      </div>

      {/* User Profile */}
      <UserProfile />
    </aside>
  )
}

