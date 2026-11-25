'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Check,
  ChevronDown,
  Loader2,
  Menu,
  PanelLeft,
  Plus,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { useChatStore } from '../../store/use-chat-store'
import { ConnectPcDialog } from './connect-pc-dialog'
import { AddModelDialog } from './add-model-dialog'
import { deleteModelProfileAction } from '../../actions/model-actions'

interface ChatHeaderProps {
  onToggleMobileSidebar: () => void
}

export function ChatHeader({ onToggleMobileSidebar }: ChatHeaderProps) {
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen)
  const toggleSidebar = useChatStore((s) => s.toggleSidebar)
  const selectedModelId = useChatStore((s) => s.selectedModelId)
  const selectModel = useChatStore((s) => s.selectModel)
  const modelProfiles = useChatStore((s) => s.modelProfiles)
  const removeModelProfile = useChatStore((s) => s.removeModelProfile)
  const resetToNewChat = useChatStore((s) => s.resetToNewChat)
  const isDropdownOpen = useChatStore((s) => s.isModelMenuOpen)
  const setDropdownOpen = useChatStore((s) => s.setModelMenuOpen)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedModel = modelProfiles.find((model) => model.id === selectedModelId) ?? null

  const handleDeleteModel = async (id: string) => {
    if (deletingModelId) return
    setModelError(null)
    setDeletingModelId(id)

    try {
      const result = await deleteModelProfileAction({ id })
      if (!result.ok) {
        setModelError(result.error)
        return
      }
      removeModelProfile(id)
    } catch {
      setModelError('Unable to delete the model. Please try again.')
    } finally {
      setDeletingModelId(null)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, setDropdownOpen])

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-[#282828] bg-[#212121]/90 px-3 backdrop-blur-md sm:px-4">
      {/* Left section: toggle + model selector */}
      <div className="flex items-center gap-2">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#ececec] transition hover:bg-[#2f2f2f] md:hidden"
          title="Open menu"
          aria-label="Open sidebar menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop sidebar expand button (when collapsed) */}
        {!isSidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#ececec] transition hover:bg-[#2f2f2f] md:flex"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        )}

        {/* Model Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-base font-semibold transition hover:bg-[#2f2f2f] ${
              selectedModel ? 'text-white' : 'text-[#a0a0a0]'
            }`}
            aria-expanded={isDropdownOpen}
          >
            <span>{selectedModel ? selectedModel.name : 'Select model'}</span>
            <ChevronDown className="h-4 w-4 text-[#8e8e8e]" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-[#383838] bg-[#1e1e1e] p-2 shadow-2xl animate-in fade-in-0 zoom-in-95">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
                Model selection
              </div>

              <div className="mt-1 space-y-1">
                {/* Model profiles are stored server-side; only summaries reach the client. */}
                {modelProfiles.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs leading-relaxed text-[#8e8e8e]">
                    No models yet. Add one below to start chatting.
                  </p>
                ) : (
                  modelProfiles.map((profile) => {
                    const isSelected = profile.id === selectedModelId
                    const isDeleting = deletingModelId === profile.id

                    return (
                      <div
                        key={profile.id}
                        className={`group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition ${
                          isSelected
                            ? 'bg-[#2a2a2a] text-white'
                            : 'text-[#ececec] hover:bg-[#262626]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            selectModel(profile.id)
                            setDropdownOpen(false)
                          }}
                          className="flex flex-1 flex-col pr-2 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{profile.name}</span>
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-400">
                              AI
                            </span>
                          </div>
                          <span className="mt-0.5 max-w-[210px] truncate font-mono text-[11px] text-[#8e8e8e]">
                            {profile.model}
                          </span>
                          <span className="max-w-[210px] truncate font-mono text-[10px] text-[#666666]">
                            {profile.endpoint}
                          </span>
                        </button>

                        <div className="flex items-center gap-1">
                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0 text-white" />
                          )}
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDeleteModel(profile.id)
                            }}
                            className="rounded p-1 text-[#8e8e8e] opacity-0 transition group-hover:opacity-100 hover:bg-[#383838] hover:text-rose-400 disabled:opacity-100"
                            title="Delete model"
                            aria-label={`Delete ${profile.name}`}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}

                {modelError && (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
                    {modelError}
                  </p>
                )}

                {/* Option at bottom to add another model */}
                <div className="my-1.5 border-t border-[#2d2d2d]" />
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false)
                    setIsAddModalOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl p-2 text-left text-xs font-medium text-[#ececec] transition hover:bg-[#282828] hover:text-white"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>Add another model...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Model Dialog */}
      <AddModelDialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />

      {/* Right section: New chat + Connect to PC */}
      <div className="flex items-center gap-2">
        <button
          onClick={resetToNewChat}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#ececec] transition hover:bg-[#2f2f2f]"
          title="New chat"
          aria-label="New chat"
        >
          <SquarePen className="h-4 w-4" />
        </button>

        <ConnectPcDialog />
      </div>
    </header>
  )
}
