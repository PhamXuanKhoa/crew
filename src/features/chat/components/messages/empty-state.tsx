'use client'

import React from 'react'
import { GraduationCap, Film, Mail, RefreshCw } from 'lucide-react'
import { RandomAvatar } from '../sidebar/random-avatar'

interface EmptyStateProps {
  hasSelectedModel: boolean
  onSelectSuggestion: (prompt: string) => void
}

interface SuggestionCardItem {
  id: string
  title: string
  subtitle: string
  prompt: string
  icon: React.ReactNode
}

export function EmptyState({ hasSelectedModel, onSelectSuggestion }: EmptyStateProps) {
  const suggestions: SuggestionCardItem[] = [
    {
      id: 'movie-ticket',
      title: 'Book a movie ticket',
      subtitle: 'Book a ticket for any hot movie on CGV Vietnam',
      prompt: 'Book a ticket for any hot movie on CGV Vietnam website',
      icon: <Film className="h-5 w-5 text-purple-400" />,
    },
    {
      id: 'updates',
      title: 'Check for updates',
      subtitle: 'Check for updates on my machine',
      prompt: 'Check for updates on my machine using the CLI',
      icon: <RefreshCw className="h-5 w-5 text-blue-400" />,
    },
    {
      id: 'moodle',
      title: 'Check for assignments on Moodle',
      subtitle: 'Check any undone assignments on VGU Moodle',
      prompt: 'Go to moodle.vgu.edu.vn and check if I had any undone assignments or activities. If yes then notify me immediately',
      icon: <GraduationCap className="h-5 w-5 text-emerald-400" />,
    },
    {
      id: 'facebook',
      title: 'Check unread messages',
      subtitle: 'Check for unread messages on Facebook',
      prompt: 'Open facebook.com and check if I had any unread messages',
      icon: <Mail className="h-5 w-5 text-amber-400" />,
    },
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      {/* Brand Avatar */}
      <RandomAvatar className="mb-4 h-12 w-12 border border-[#383838]" size={48} />

      {/* Main Title */}
      <h1
        className={`text-2xl font-semibold tracking-tight text-white sm:text-3xl ${
          hasSelectedModel ? 'mb-8' : 'mb-2'
        }`}
      >
        What can I help with?
      </h1>

      {!hasSelectedModel && (
        <p className="mb-6 text-xs text-amber-300/90">
          Select or add a model to start chatting.
        </p>
      )}

      {/* 4 Suggestion Cards in 2x2 grid */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectSuggestion(item.prompt)}
            disabled={!hasSelectedModel}
            className="group flex flex-col justify-between rounded-2xl border border-[#383838] bg-[#212121]/70 p-4 text-left transition hover:border-[#4f4f4f] hover:bg-[#282828] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#383838] disabled:hover:bg-[#212121]/70 disabled:active:scale-100"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-[#ececec] group-hover:text-white">
                {item.title}
              </span>
              <div className="rounded-lg p-1 transition group-hover:bg-[#383838]">
                {item.icon}
              </div>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-[#8e8e8e] group-hover:text-[#a0a0a0]">
              {item.subtitle}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
