import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { z } from 'zod'
import {
  AgentStep,
  ChatMessage,
  Conversation,
  ModelProfile,
  RemoteDesktopSession,
  RemoteDesktopStatus,
} from '../types'
import type { VncConnection } from '../lib/vnc'

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  selectedModelId: string | null
  /** Public model metadata only; API keys live server-side. */
  modelProfiles: ModelProfile[]
  remoteDesktops: Record<string, RemoteDesktopSession>
  isStreaming: boolean
  isSidebarOpen: boolean
  isMobileSidebarOpen: boolean
  isModelMenuOpen: boolean

  // Actions
  createConversation: (title?: string) => string
  selectConversation: (id: string | null) => void
  deleteConversation: (id: string) => void
  clearAllConversations: () => void
  addMessage: (conversationId: string, message: ChatMessage) => void
  updateMessageContent: (conversationId: string, messageId: string, content: string) => void
  appendAgentStep: (conversationId: string, messageId: string, step: AgentStep) => void
  updateAgentStep: (
    conversationId: string,
    messageId: string,
    stepId: string,
    patch: Partial<Pick<AgentStep, 'label' | 'detail' | 'status'>>
  ) => void
  updateConversationTitle: (conversationId: string, title: string) => void
  setStreaming: (isStreaming: boolean) => void
  selectModel: (id: string | null) => void
  setModelMenuOpen: (open: boolean) => void
  setModelProfiles: (profiles: ModelProfile[]) => void
  addModelProfile: (profile: ModelProfile) => void
  removeModelProfile: (id: string) => void
  connectRemoteDesktop: (conversationId: string, connection: VncConnection) => void
  setRemoteDesktopStatus: (
    conversationId: string,
    status: RemoteDesktopStatus,
    errorMessage?: string | null
  ) => void
  setRemoteDesktopMinimized: (conversationId: string, minimized: boolean) => void
  disconnectRemoteDesktop: (conversationId: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
  resetToNewChat: () => void
}

// localStorage is outside our trust boundary: validate everything rehydrated
// from it before it reaches the store.
const agentStepSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(['action', 'question', 'answer', 'error']),
  label: z.string().max(4000),
  detail: z.string().max(4000).optional(),
  status: z.enum(['running', 'done', 'error']),
})

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.number(),
  agentSteps: z.array(agentStepSchema).max(100).optional(),
})

const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  messages: z.array(chatMessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const persistedChatStateSchema = z.object({
  conversations: z.array(conversationSchema),
  currentConversationId: z.string().nullable(),
  selectedModelId: z.string().nullable(),
  isSidebarOpen: z.boolean(),
})

type PersistedChatState = z.infer<typeof persistedChatStateSchema>

// v0 persisted the selected model by name and shipped three hardcoded default
// models. Older versions also persisted model API keys in localStorage; that
// data is deliberately discarded here and never migrated.
const legacyPersistedChatStateSchema = z.object({
  conversations: z.array(conversationSchema).optional(),
  currentConversationId: z.string().nullable().optional(),
  selectedModel: z.string().nullable().optional(),
  isSidebarOpen: z.boolean().optional(),
})

function redactSensitiveStepDetails(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => {
      if (!message.agentSteps) return message

      return {
        ...message,
        agentSteps: message.agentSteps.map((step) => {
          // Answers to agent questions and text typed into the remote machine
          // may contain passwords or OTPs. Keep them in memory for the live
          // transcript, but never write them to localStorage.
          const sensitive =
            step.kind === 'answer' || (step.kind === 'action' && step.label === 'Type text')
          if (!sensitive) return step

          return {
            id: step.id,
            kind: step.kind,
            label: step.label,
            status: step.status,
          }
        }),
      }
    }),
  }
}

const getInitialConversations = (): Conversation[] => {
  const now = Date.now()
  const oneHourAgo = now - 1000 * 60 * 60
  const yesterday = now - 1000 * 60 * 60 * 25

  return [
    {
      id: 'demo-today-1',
      title: 'Python Script File Organizer',
      createdAt: oneHourAgo,
      updatedAt: oneHourAgo,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Write a Python script to organize files by extension.',
          createdAt: oneHourAgo,
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: `Here is a clean Python script using \`pathlib\` to automatically organize files into folders by category:

\`\`\`python
from pathlib import Path
import shutil

CATEGORIES = {
    "Images": [".jpg", ".jpeg", ".png", ".webp"],
    "Documents": [".pdf", ".docx", ".txt", ".md"],
    "Code": [".py", ".ts", ".js", ".json"],
}

def organize(folder: str):
    dir_path = Path(folder)
    for file in dir_path.iterdir():
        if file.is_file() and not file.name.startsWith("."):
            for category, exts in CATEGORIES.items():
                if file.suffix.lower() in exts:
                    dest = dir_path / category
                    dest.mkdir(exist_ok=True)
                    shutil.move(str(file), str(dest / file.name))
                    break
\`\`\`

Let me know if you would like to add custom categories or recursive scanning!`,
          createdAt: oneHourAgo + 1000,
        },
      ],
    },
    {
      id: 'demo-yesterday-1',
      title: 'Quantum Computing Primer',
      createdAt: yesterday,
      updatedAt: yesterday,
      messages: [
        {
          id: 'msg-3',
          role: 'user',
          content: 'Explain quantum computing in simple terms.',
          createdAt: yesterday,
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: `### ⚛️ Quantum Computing in a Nutshell

Classical computers think in bits (switches that are either **0** or **1**). 

Quantum computers use **qubits**, which leverage two fundamental principles of quantum mechanics:

1. **Superposition**: A qubit can be a 0, a 1, or both at the same time until measured.
2. **Entanglement**: Qubits can be linked so that what happens to one instantaneously influences another.

This allows quantum computers to analyze immense numbers of possibilities in parallel, ideal for molecular modeling, drug discovery, and route optimization.`,
          createdAt: yesterday + 1000,
        },
      ],
    },
  ]
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: getInitialConversations(),
      currentConversationId: null, // Start with empty state initially to showcase "What can I help with?"
      selectedModelId: null, // No default models: users must add/select one before chatting
      modelProfiles: [],
      remoteDesktops: {}, // Per-conversation VNC sessions, in memory only (credentials are never persisted)
      isStreaming: false,
      isSidebarOpen: true,
      isMobileSidebarOpen: false,
      isModelMenuOpen: false,

      createConversation: (title = 'New chat') => {
        const id = 'conv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
        const newConversation: Conversation = {
          id,
          title,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: id,
          isMobileSidebarOpen: false,
        }))

        return id
      },

      selectConversation: (id) => {
        set({
          currentConversationId: id,
          isMobileSidebarOpen: false,
        })
      },

      resetToNewChat: () => {
        set({
          currentConversationId: null,
          isMobileSidebarOpen: false,
        })
      },

      deleteConversation: (id) => {
        set((state) => {
          const nextConversations = state.conversations.filter((c) => c.id !== id)
          const nextActiveId =
            state.currentConversationId === id
              ? nextConversations.length > 0
                ? null // Return to empty state if active conversation is deleted
                : null
              : state.currentConversationId

          const nextRemoteDesktops = { ...state.remoteDesktops }
          delete nextRemoteDesktops[id]

          return {
            conversations: nextConversations,
            currentConversationId: nextActiveId,
            remoteDesktops: nextRemoteDesktops,
          }
        })
      },

      clearAllConversations: () => {
        set({
          conversations: [],
          currentConversationId: null,
          remoteDesktops: {},
          isMobileSidebarOpen: false,
        })
      },

      addMessage: (conversationId, message) => {
        set((state) => {
          let found = false
          const updatedConversations = state.conversations.map((conv) => {
            if (conv.id === conversationId) {
              found = true
              // Auto-update title if it was default 'New chat' and first message is from user
              let newTitle = conv.title
              if (conv.title === 'New chat' && message.role === 'user') {
                newTitle = message.content.slice(0, 36).trim() || 'New chat'
              }
              return {
                ...conv,
                title: newTitle,
                updatedAt: Date.now(),
                messages: [...conv.messages, message],
              }
            }
            return conv
          })

          if (!found) {
            const newConv: Conversation = {
              id: conversationId,
              title: message.role === 'user' ? message.content.slice(0, 36).trim() || 'New chat' : 'New chat',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messages: [message],
            }
            return {
              conversations: [newConv, ...state.conversations],
              currentConversationId: conversationId,
            }
          }

          return {
            conversations: updatedConversations,
          }
        })
      },

      updateMessageContent: (conversationId, messageId, content) => {
        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                updatedAt: Date.now(),
                messages: conv.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, content } : msg
                ),
              }
            }
            return conv
          }),
        }))
      },

      appendAgentStep: (conversationId, messageId, step) => {
        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id !== conversationId) return conv

            return {
              ...conv,
              updatedAt: Date.now(),
              messages: conv.messages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, agentSteps: [...(msg.agentSteps ?? []), step].slice(-100) }
                  : msg
              ),
            }
          }),
        }))
      },

      updateAgentStep: (conversationId, messageId, stepId, patch) => {
        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id !== conversationId) return conv

            return {
              ...conv,
              updatedAt: Date.now(),
              messages: conv.messages.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      agentSteps: msg.agentSteps?.map((step) =>
                        step.id === stepId ? { ...step, ...patch } : step
                      ),
                    }
                  : msg
              ),
            }
          }),
        }))
      },

      updateConversationTitle: (conversationId, title) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, title } : conv
          ),
        }))
      },

      setStreaming: (isStreaming) => set({ isStreaming }),

      selectModel: (selectedModelId) => set({ selectedModelId }),

      setModelMenuOpen: (isModelMenuOpen) => set({ isModelMenuOpen }),

      setModelProfiles: (profiles) => {
        set((state) => ({
          modelProfiles: profiles,
          selectedModelId:
            state.selectedModelId && profiles.some((profile) => profile.id === state.selectedModelId)
              ? state.selectedModelId
              : null,
        }))
      },

      addModelProfile: (profile) => {
        set((state) => ({
          modelProfiles: [...state.modelProfiles.filter((item) => item.id !== profile.id), profile],
          selectedModelId: profile.id,
        }))
      },

      removeModelProfile: (id) => {
        set((state) => ({
          modelProfiles: state.modelProfiles.filter((profile) => profile.id !== id),
          selectedModelId: state.selectedModelId === id ? null : state.selectedModelId,
        }))
      },

      connectRemoteDesktop: (conversationId, connection) => {
        set((state) => ({
          remoteDesktops: {
            ...state.remoteDesktops,
            [conversationId]: {
              host: connection.host,
              port: connection.port,
              username: connection.username,
              password: connection.password,
              status: 'connecting',
              errorMessage: null,
              minimized: false,
            },
          },
        }))
      },

      setRemoteDesktopStatus: (conversationId, status, errorMessage = null) => {
        set((state) => {
          const desktop = state.remoteDesktops[conversationId]
          if (!desktop) return {}
          return {
            remoteDesktops: {
              ...state.remoteDesktops,
              [conversationId]: { ...desktop, status, errorMessage },
            },
          }
        })
      },

      setRemoteDesktopMinimized: (conversationId, minimized) => {
        set((state) => {
          const desktop = state.remoteDesktops[conversationId]
          if (!desktop) return {}
          return {
            remoteDesktops: {
              ...state.remoteDesktops,
              [conversationId]: { ...desktop, minimized },
            },
          }
        })
      },

      disconnectRemoteDesktop: (conversationId) => {
        set((state) => {
          if (!state.remoteDesktops[conversationId]) return {}
          const nextRemoteDesktops = { ...state.remoteDesktops }
          delete nextRemoteDesktops[conversationId]
          return { remoteDesktops: nextRemoteDesktops }
        })
      },

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

      setMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
    }),
    {
      name: 'Dots_clone_storage',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Only chat history and UI state persist. Model profiles, including API
      // keys, live in a server-side encrypted httpOnly cookie.
      partialize: (state): PersistedChatState => ({
        conversations: state.conversations.map(redactSensitiveStepDetails),
        currentConversationId: state.currentConversationId,
        selectedModelId: state.selectedModelId,
        isSidebarOpen: state.isSidebarOpen,
      }),
      migrate: (persistedState) => {
        const parsed = legacyPersistedChatStateSchema.safeParse(persistedState)
        if (!parsed.success) {
          return {
            conversations: [],
            currentConversationId: null,
            selectedModelId: null,
            isSidebarOpen: true,
          }
        }

        // Legacy model records contained plaintext API keys in localStorage,
        // so the selection is dropped along with them.
        return {
          conversations: parsed.data.conversations ?? [],
          currentConversationId: parsed.data.currentConversationId ?? null,
          selectedModelId: null,
          isSidebarOpen: parsed.data.isSidebarOpen ?? true,
        }
      },
      merge: (persistedState, currentState) => {
        const parsed = persistedChatStateSchema.safeParse(persistedState)
        if (!parsed.success) return currentState

        const { conversations, currentConversationId, selectedModelId, isSidebarOpen } =
          parsed.data

        // A reload interrupts any in-flight run. Do not leave spinners that
        // can never finish. Redact old sensitive agent details at the same
        // time so they cannot survive in memory or get re-written.
        const hydratedConversations = conversations
          .map(redactSensitiveStepDetails)
          .map((conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) => ({
              ...message,
              ...(message.agentSteps
                ? {
                    agentSteps: message.agentSteps.map((step) =>
                      step.status === 'running' ? { ...step, status: 'error' as const } : step
                    ),
                  }
                : {}),
            })),
          }))

        return {
          ...currentState,
          conversations: hydratedConversations,
          // Drop dangling conversation references. Model ids are validated
          // once the server-provided profile list arrives.
          currentConversationId:
            currentConversationId &&
            hydratedConversations.some((conversation) => conversation.id === currentConversationId)
              ? currentConversationId
              : null,
          selectedModelId,
          isSidebarOpen,
        }
      },
    }
  )
)
