'use client'

import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore, useCallback } from 'react'
import { AlertCircle, Expand } from 'lucide-react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useChatStore } from '../store/use-chat-store'
import { Sidebar } from './sidebar/sidebar'
import { ChatHeader } from './header/chat-header'
import { ChatMessageList } from './messages/chat-message-list'
import { ChatComposer } from './composer/chat-composer'
import { VncMonitor } from './remote/vnc-monitor'
import { AgentQuestionDialog } from './messages/agent-question-dialog'
import { useVncAgent } from '../hooks/use-vnc-agent'
import type { VncAgentController } from '../lib/vnc-agent-controller'
import { ChatMessage, ModelProfile } from '../types'

const emptySubscribe = () => () => {}

interface ChatLayoutProps {
  initialModelProfiles: ModelProfile[]
}

function createMessageId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ChatLayout({ initialModelProfiles }: ChatLayoutProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
  const [composerInput, setComposerInput] = useState('')
  const vncControllerRef = useRef<VncAgentController | null>(null)

  const conversations = useChatStore((s) => s.conversations)
  const currentConversationId = useChatStore((s) => s.currentConversationId)
  const remoteDesktops = useChatStore((s) => s.remoteDesktops)
  const selectedModelId = useChatStore((s) => s.selectedModelId)
  const modelProfiles = useChatStore((s) => s.modelProfiles)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen)
  const isMobileSidebarOpen = useChatStore((s) => s.isMobileSidebarOpen)

  const createConversation = useChatStore((s) => s.createConversation)
  const addMessage = useChatStore((s) => s.addMessage)
  const setModelProfiles = useChatStore((s) => s.setModelProfiles)
  const setMobileSidebarOpen = useChatStore((s) => s.setMobileSidebarOpen)
  const setModelMenuOpen = useChatStore((s) => s.setModelMenuOpen)
  const setRemoteDesktopMinimized = useChatStore((s) => s.setRemoteDesktopMinimized)

  const { runAgent, stopAgent, pendingQuestion, answerQuestion, cancelQuestion } =
    useVncAgent(vncControllerRef)

  const hasSelectedModel =
    selectedModelId !== null && modelProfiles.some((profile) => profile.id === selectedModelId)

  // Server-provided model summaries hydrate the client store. API keys stay in
  // the encrypted httpOnly cookie and never travel through this component.
  useEffect(() => {
    setModelProfiles(initialModelProfiles)
  }, [initialModelProfiles, setModelProfiles])

  // Active conversation object
  const currentConversation = useMemo(() => {
    if (!currentConversationId) return null
    return conversations.find((conversation) => conversation.id === currentConversationId) || null
  }, [conversations, currentConversationId])

  const activeMessages = currentConversation ? currentConversation.messages : []

  // The active chat's desktop, if any. One VNC session per chat.
  const currentDesktop =
    currentConversationId != null ? remoteDesktops[currentConversationId] : undefined
  const showMonitorPanel = Boolean(currentDesktop) && !currentDesktop?.minimized

  const handleControllerChange = useCallback((controller: VncAgentController | null) => {
    vncControllerRef.current = controller
  }, [])

  const handleSendMessage = (promptText: string) => {
    // A chat cannot be started without a selected, server-backed model.
    if (!hasSelectedModel || !selectedModelId) {
      setModelMenuOpen(true)
      return
    }

    if (!promptText.trim() || isStreaming) return

    const targetId =
      currentConversationId ?? createConversation(promptText.slice(0, 36).trim() || 'New chat')

    addMessage(targetId, {
      id: createMessageId('usr'),
      role: 'user',
      content: promptText,
      createdAt: Date.now(),
    })

    const assistantMessageId = createMessageId('ai')
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now() + 1,
    }

    addMessage(targetId, assistantMessage)

    void runAgent({
      conversationId: targetId,
      assistantMessageId,
      modelId: selectedModelId,
      task: promptText,
    })
  }

  const handleStopStreaming = () => {
    stopAgent()
  }

  const handleRegenerateLast = () => {
    if (!hasSelectedModel || !selectedModelId) {
      setModelMenuOpen(true)
      return
    }

    if (isStreaming || !currentConversation) return

    const lastUserMessage = [...activeMessages].reverse().find((message) => message.role === 'user')
    if (!lastUserMessage) return

    const assistantMessageId = createMessageId('ai')
    addMessage(currentConversation.id, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    })

    void runAgent({
      conversationId: currentConversation.id,
      assistantMessageId,
      modelId: selectedModelId,
      task: lastUserMessage.content,
    })
  }

  const handleCloseMonitor = () => {
    if (currentConversationId != null) {
      setRemoteDesktopMinimized(currentConversationId, true)
    }
  }

  const handleExpandMonitor = () => {
    if (currentConversationId != null) {
      setRemoteDesktopMinimized(currentConversationId, false)
    }
  }

  if (!isClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#212121] text-[#8e8e8e]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#555] border-t-white" />
      </div>
    )
  }

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden bg-[#212121] text-[#ececec]">
        {/* Mobile Drawer Backdrop */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-xs transition-opacity md:hidden"
            aria-hidden="true"
          />
        )}

        {/* Mobile Sidebar (Slide-over drawer) */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
        </div>

        {/* Desktop Sidebar (Collapsible 260px) */}
        {isSidebarOpen && (
          <div className="hidden h-full md:flex">
            <Sidebar />
          </div>
        )}

        {/* Main Right Area — chat and (optionally) the monitor side by side */}
        <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
          <ResizablePanel
            id="chat"
            minSize="40%"
            className="flex min-w-0 h-full bg-[#212121]"
          >
            <div className="relative flex min-w-0 flex-1 flex-col h-full bg-[#212121]">
              {/* Sticky Header */}
              <ChatHeader onToggleMobileSidebar={() => setMobileSidebarOpen(true)} />

              {/* Re-open strip when the monitor is hidden but a session lives */}
              {currentDesktop && !showMonitorPanel && (
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#282828] bg-[#171717] px-3 py-1.5">
                  <span className="truncate text-xs text-[#8e8e8e]">
                    Remote desktop is hidden for this chat
                  </span>
                  <button
                    type="button"
                    onClick={handleExpandMonitor}
                    className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/10"
                  >
                    <Expand className="h-3.5 w-3.5" />
                    <span>Expand monitor</span>
                  </button>
                </div>
              )}

              {/* Messages / Empty State */}
              <div className="flex-1 overflow-hidden">
                <ChatMessageList
                  messages={activeMessages}
                  isStreaming={isStreaming}
                  hasSelectedModel={hasSelectedModel}
                  onSelectSuggestion={handleSendMessage}
                  onRegenerateLast={handleRegenerateLast}
                />
              </div>

              {/* Floating Pill Composer at bottom */}
              <div className="sticky bottom-0 z-20 flex w-full flex-col items-center bg-gradient-to-t from-[#212121] via-[#212121] to-transparent pt-3 pb-1">
                {!hasSelectedModel && (
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen(true)}
                    className="mb-2 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>No model selected — choose a model to start chatting</span>
                  </button>
                )}

                <ChatComposer
                  input={composerInput}
                  setInput={setComposerInput}
                  onSend={handleSendMessage}
                  onStop={handleStopStreaming}
                  isStreaming={isStreaming}
                  disabled={!hasSelectedModel}
                  noModelSelected={!hasSelectedModel}
                />
              </div>
            </div>
          </ResizablePanel>

          {showMonitorPanel && currentDesktop && currentConversationId != null && (
            <>
              <ResizableHandle
                withHandle
                className="bg-[#282828] data-[separator=active]:bg-emerald-500/40"
              />
              <ResizablePanel
                id="monitor"
                defaultSize="45%"
                minSize="25%"
                maxSize="75%"
                collapsible
                groupResizeBehavior="preserve-pixel-size"
                className="flex min-w-0 h-full bg-[#0b0b0b]"
              >
                <VncMonitor
                  conversationId={currentConversationId}
                  host={currentDesktop.host}
                  port={currentDesktop.port}
                  username={currentDesktop.username}
                  password={currentDesktop.password}
                  hidden={false}
                  onClose={handleCloseMonitor}
                  onControllerChange={handleControllerChange}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <AgentQuestionDialog
        question={pendingQuestion}
        onAnswer={answerQuestion}
        onCancel={cancelQuestion}
      />
    </>
  )
}
