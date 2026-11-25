export type MessageRole = 'user' | 'assistant' | 'system'

export type AgentStepKind = 'action' | 'question' | 'answer' | 'error'
export type AgentStepStatus = 'running' | 'done' | 'error'

/**
 * Display-only trace of what the desktop agent did while producing an
 * assistant message. Never contains credentials or raw provider payloads.
 */
export interface AgentStep {
  id: string
  kind: AgentStepKind
  label: string
  detail?: string
  status: AgentStepStatus
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  agentSteps?: AgentStep[]
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export interface GroupedConversations {
  today: Conversation[]
  yesterday: Conversation[]
  previous7Days: Conversation[]
  older: Conversation[]
}

/**
 * A model the browser may select. The API key never reaches this type: it is
 * kept server-side in an encrypted httpOnly cookie.
 */
export interface ModelProfile {
  id: string
  name: string
  model: string
  endpoint: string
}

export type RemoteDesktopStatus = 'connecting' | 'connected' | 'error'

/**
 * One VNC session per conversation, held in memory only. Credentials must
 * never be persisted to localStorage.
 */
export interface RemoteDesktopSession {
  host: string
  port: number
  username?: string
  password: string
  status: RemoteDesktopStatus
  errorMessage: string | null
  minimized: boolean
}
