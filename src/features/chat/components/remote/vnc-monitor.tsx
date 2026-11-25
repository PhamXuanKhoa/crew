'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2, Monitor, RefreshCw, ShieldAlert, Unplug, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type RFB from '@novnc/novnc'
import { buildVncWebSocketUrl } from '../../lib/vnc'
import { createVncAgentController, type VncAgentController } from '../../lib/vnc-agent-controller'
import { useChatStore } from '../../store/use-chat-store'

const CONNECT_TIMEOUT_MS = 15_000

export interface VncMonitorProps {
  conversationId: string
  host: string
  port: number
  username?: string
  password: string
  /** Hidden monitors stay mounted (in-flow, collapsed) so the VNC session keeps running. */
  hidden: boolean
  /** Called when the panel close (X) button is pressed. */
  onClose?: () => void
  /** Exposes the live VNC surface to the chat agent, and null on disconnect. */
  onControllerChange?: (controller: VncAgentController | null) => void
}

// noVNC's `scaleViewport` fits the remote framebuffer into the container
// while preserving its aspect ratio (letterboxing, never stretching), so
// the preview keeps the remote screen's native ratio at any panel width.
// The canvas is centered so the letterbox bars are balanced on both sides.
const MONITOR_FRAME_STYLES: React.CSSProperties = {
  imageRendering: 'auto',
}

const STATUS_STYLES: Record<'connecting' | 'connected' | 'error', string> = {
  connecting: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  connected: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
}

const STATUS_LABELS: Record<'connecting' | 'connected' | 'error', string> = {
  connecting: 'Connecting',
  connected: 'Live',
  error: 'Disconnected',
}

function StatusBadge({ status }: { status: 'connecting' | 'connected' | 'error' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  )
}

/**
 * Renders a live, interactive view of a remote desktop through noVNC.
 *
 * Flow: [VNC server :5900] <- TCP -> [websockify :6080] <- WebSocket -> this canvas.
 * One instance exists per conversation; it stays mounted (hidden panels keep
 * the session alive) and fills its parent — the resizable right panel in
 * `ChatLayout`. noVNC already rescales the canvas to the container with
 * scaleViewport, so the remote screen is never distorted.
 */
export function VncMonitor({
  conversationId,
  host,
  port,
  username,
  password,
  hidden,
  onClose,
  onControllerChange,
}: VncMonitorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const onControllerChangeRef = useRef(onControllerChange)

  useEffect(() => {
    onControllerChangeRef.current = onControllerChange
  }, [onControllerChange])

  const status = useChatStore(
    (s) => s.remoteDesktops[conversationId]?.status ?? 'connecting'
  )
  const errorMessage = useChatStore(
    (s) => s.remoteDesktops[conversationId]?.errorMessage ?? ''
  )
  const setRemoteDesktopStatus = useChatStore((s) => s.setRemoteDesktopStatus)
  const setRemoteDesktopMinimized = useChatStore((s) => s.setRemoteDesktopMinimized)
  const disconnectRemoteDesktop = useChatStore((s) => s.disconnectRemoteDesktop)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let suppressDisconnect = false
    let client: RFB | null = null

    setRemoteDesktopStatus(conversationId, 'connecting')

    const fail = (message: string) => {
      if (cancelled) return
      suppressDisconnect = true
      onControllerChangeRef.current?.(null)
      setRemoteDesktopStatus(conversationId, 'error', message)
      client?.disconnect()
    }

    const timeoutId = window.setTimeout(() => {
      fail(
        `Timed out after ${CONNECT_TIMEOUT_MS / 1000}s. Check that the VNC server and its WebSocket proxy are reachable.`
      )
    }, CONNECT_TIMEOUT_MS)

    void (async () => {
      try {
        // Loaded on demand: noVNC needs browser APIs and must stay out of SSR.
        const { default: RFBClass } = await import('@novnc/novnc')
        if (cancelled) return

        const rfb = new RFBClass(container, buildVncWebSocketUrl({ host, port }), {
          credentials: {
            username: username || undefined,
            password,
          },
          wsProtocols: ['binary'],
        })
        client = rfb

        rfb.scaleViewport = true
        rfb.resizeSession = false
        rfb.focusOnClick = true
        rfb.viewOnly = false

        let credentialsSent = false

        rfb.addEventListener('connect', () => {
          if (cancelled) return
          window.clearTimeout(timeoutId)
          setRemoteDesktopStatus(conversationId, 'connected')
          onControllerChangeRef.current?.(createVncAgentController(rfb, container))
        })

        rfb.addEventListener('credentialsrequired', () => {
          if (cancelled) return
          if (credentialsSent) {
            fail('The VNC server requested credentials this client cannot provide.')
            return
          }
          credentialsSent = true
          rfb.sendCredentials({
            username: username || undefined,
            password,
          })
        })

        rfb.addEventListener('securityfailure', (event) => {
          const reason = event.detail.reason?.trim()
          fail(
            reason
              ? `Authentication failed: ${reason}`
              : 'Authentication failed. Check the VNC password.'
          )
        })

        rfb.addEventListener('disconnect', (event) => {
          if (cancelled || suppressDisconnect) return
          window.clearTimeout(timeoutId)
          onControllerChangeRef.current?.(null)
          setRemoteDesktopStatus(
            conversationId,
            'error',
            event.detail.clean
              ? 'The remote session ended.'
              : 'The connection to the remote desktop was lost.'
          )
        })
      } catch (error) {
        fail(
          error instanceof Error
            ? `Unable to start the VNC session: ${error.message}`
            : 'Unable to start the VNC session.'
        )
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      onControllerChangeRef.current?.(null)
      client?.disconnect()
      container.replaceChildren()
    }
  }, [
    conversationId,
    host,
    port,
    username,
    password,
    attempt,
    setRemoteDesktopStatus,
  ])

  return (
    <div
      aria-hidden={hidden}
      className={`flex h-full min-h-0 flex-col bg-[#0b0b0b] text-[#ececec] ${
        hidden ? 'pointer-events-none invisible' : 'visible'
      }`}
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[#282828] bg-[#171717] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Monitor className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="text-sm font-medium">Remote desktop</span>
          <span className="hidden truncate font-mono text-xs text-[#8e8e8e] sm:inline">
            {host}:{port}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={status} />
          {status === 'error' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAttempt((n) => n + 1)}
              className="text-[#ececec] hover:bg-[#2f2f2f] hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Retry</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRemoteDesktopMinimized(conversationId, true)}
            className="text-[#ececec] hover:bg-[#2f2f2f] hover:text-white"
            title="Hide panel"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Hide</span>
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[#ececec] hover:bg-[#2f2f2f] hover:text-white"
              title="Close panel"
              aria-label="Close monitor panel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnectRemoteDesktop(conversationId)}
            className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <Unplug className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Disconnect</span>
          </Button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {/* noVNC attaches its canvas here. scaleViewport keeps the remote
            framebuffer's aspect ratio; the canvas is centered and never
            stretched, even when the panel is dragged into a tall shape. */}
        <div
          ref={containerRef}
          style={MONITOR_FRAME_STYLES}
          className="absolute inset-0 flex touch-none select-none items-center justify-center bg-black"
        />

        {status === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
            <p className="text-sm font-medium text-white">Connecting to {host}...</p>
            <p className="max-w-md break-all font-mono text-[11px] leading-relaxed text-[#8e8e8e]">
              WebSocket proxy: {buildVncWebSocketUrl({ host, port })}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
            <ShieldAlert className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-semibold text-white">VNC connection failed</p>
            <p className="max-w-lg text-xs leading-relaxed text-[#a0a0a0]">{errorMessage}</p>
            <p className="max-w-lg text-[11px] leading-relaxed text-[#666666]">
              Make sure the VNC server listens on port 5900 and a WebSocket proxy such as
              websockify is serving port {port}. If this app is served over HTTPS,
              the proxy must support wss://.
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setAttempt((n) => n + 1)}
                className="bg-white text-black hover:bg-neutral-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry connection</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemoteDesktopMinimized(conversationId, true)}
                className="text-[#a0a0a0] hover:bg-[#2f2f2f] hover:text-white"
              >
                Hide panel
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
