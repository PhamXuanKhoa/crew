'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  Unplug,
  Wifi,
} from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChatStore } from '../../store/use-chat-store'
import { DEFAULT_VNC_WS_PORT, vncConnectionSchema } from '../../lib/vnc'

export function ConnectPcDialog() {
  const [open, setOpen] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState(String(DEFAULT_VNC_WS_PORT))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const currentConversationId = useChatStore((s) => s.currentConversationId)
  const activeDesktop = useChatStore((s) =>
    s.currentConversationId ? s.remoteDesktops[s.currentConversationId] : undefined
  )
  const createConversation = useChatStore((s) => s.createConversation)
  const connectRemoteDesktop = useChatStore((s) => s.connectRemoteDesktop)
  const setRemoteDesktopMinimized = useChatStore((s) => s.setRemoteDesktopMinimized)
  const disconnectRemoteDesktop = useChatStore((s) => s.disconnectRemoteDesktop)

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const parsed = vncConnectionSchema.safeParse({
      host,
      port,
      username,
      password,
    })

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message ?? 'Please check the connection details.'
      )
      return
    }

    // A desktop belongs to a chat: reuse the active one or start a new chat.
    const conversationId =
      currentConversationId ??
      createConversation(`Remote desktop: ${parsed.data.host}`)

    // Credentials stay in memory for this session only — never persisted.
    connectRemoteDesktop(conversationId, parsed.data)
    setPassword('')
    setOpen(false)
  }

  const desktopStatus = activeDesktop?.status ?? null

  const triggerClasses =
    desktopStatus === 'connected'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
      : desktopStatus === 'connecting'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
        : desktopStatus === 'error'
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
          : 'border-[#383838] bg-[#212121] text-[#ececec] hover:bg-[#2f2f2f] hover:text-white'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={triggerClasses}
          title="Remote desktop for this chat"
        >
          {desktopStatus === 'connected' ? (
            <>
              <Wifi className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Connected</span>
              <span className="max-w-20 truncate text-[11px] text-current opacity-80 sm:inline">
                ({activeDesktop?.host})
              </span>
            </>
          ) : desktopStatus === 'connecting' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Connecting</span>
            </>
          ) : desktopStatus === 'error' ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>VNC error</span>
            </>
          ) : (
            <>
              <Monitor className="h-3.5 w-3.5" />
              <span>Connect to PC</span>
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="border-[#383838] bg-[#212121] text-[#ececec] sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f2f2f] text-white">
              <Monitor className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white">
                {activeDesktop ? 'Remote desktop session' : 'Connect to PC'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8e8e8e]">
                {activeDesktop
                  ? 'This chat has its own remote desktop connection.'
                  : "Open a live VNC session through the server's WebSocket proxy."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {activeDesktop ? (
          <div className="space-y-4 py-2">
            <div
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                activeDesktop.status === 'connected'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : activeDesktop.status === 'connecting'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              {activeDesktop.status === 'connected' ? (
                <Wifi className="h-5 w-5 shrink-0" />
              ) : activeDesktop.status === 'connecting' ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-white">
                  {activeDesktop.status === 'connected'
                    ? 'Connected'
                    : activeDesktop.status === 'connecting'
                      ? 'Connecting...'
                      : 'Connection failed'}
                </p>
                <p className="truncate font-mono text-current opacity-90">
                  {activeDesktop.host}:{activeDesktop.port}
                </p>
                {activeDesktop.errorMessage && (
                  <p className="mt-1 leading-relaxed text-rose-200/90">
                    {activeDesktop.errorMessage}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-[#2d2d2d] pt-3 sm:justify-between">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!currentConversationId) return
                  setRemoteDesktopMinimized(currentConversationId, false)
                  setOpen(false)
                }}
                className="gap-1.5 bg-white text-xs font-medium text-black hover:bg-neutral-200"
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Open monitor</span>
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (!currentConversationId) return
                  disconnectRemoteDesktop(currentConversationId)
                }}
                className="gap-1.5"
              >
                <Unplug className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleConnect} noValidate className="space-y-3.5 py-1">
            {errorMessage && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="pc-host" className="text-xs text-[#ececec]">
                  IP Address or Hostname
                </Label>
                <Input
                  id="pc-host"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. 192.168.1.100"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="border-[#383838] bg-[#1a1a1a] text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pc-port" className="text-xs text-[#ececec]">
                  Proxy Port
                </Label>
                <Input
                  id="pc-port"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="border-[#383838] bg-[#1a1a1a] font-mono text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pc-username" className="text-xs text-[#ececec]">
                Username <span className="text-[#8e8e8e]">(optional)</span>
              </Label>
              <Input
                id="pc-username"
                type="text"
                autoComplete="username"
                spellCheck={false}
                placeholder="Optional"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border-[#383838] bg-[#1a1a1a] text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pc-password" className="text-xs text-[#ececec]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="pc-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter VNC password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-[#383838] bg-[#1a1a1a] pr-9 text-xs text-white placeholder-[#666666] focus-visible:border-[#555555]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e8e] transition hover:text-[#ececec]"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[#8e8e8e]">
              Each chat keeps its own remote desktop. Connects to{' '}
              <span className="font-mono">
                ws(s)://&lt;host&gt;:{port || DEFAULT_VNC_WS_PORT}/websockify
              </span>
              ; the VNC server runs on port 5900 behind that proxy.
            </p>

            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
              The selected AI model receives screenshots of this desktop and can control the mouse and
              keyboard. Credentials are kept in memory for this tab and are never saved.
            </p>

            <DialogFooter className="border-t border-[#2d2d2d] pt-3 sm:justify-end">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#a0a0a0] hover:text-white"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                className="bg-white text-xs font-medium text-black hover:bg-neutral-200"
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Connect</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
