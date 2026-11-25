/**
 * Minimal ambient types for @novnc/novnc (v1.7), which ships JavaScript only.
 * Only the RFB surface used by this app is declared.
 */
declare module '@novnc/novnc' {
  export interface VncCredentials {
    username?: string
    password?: string
    target?: string
  }

  export interface VncOptions {
    shared?: boolean
    credentials?: VncCredentials
    repeaterID?: string
    wsProtocols?: string[]
  }

  export interface VncDisconnectDetail {
    clean: boolean
  }

  export interface VncSecurityFailureDetail {
    status: number
    reason?: string
  }

  export interface VncCredentialsRequiredDetail {
    types: string[]
  }

  export interface VncDesktopNameDetail {
    name: string
  }

  export interface VncClipboardDetail {
    text: string
  }

  export interface VncEventMap {
    bell: Event
    clipboard: CustomEvent<VncClipboardDetail>
    connect: Event
    credentialsrequired: CustomEvent<VncCredentialsRequiredDetail>
    desktopname: CustomEvent<VncDesktopNameDetail>
    disconnect: CustomEvent<VncDisconnectDetail>
    securityfailure: CustomEvent<VncSecurityFailureDetail>
  }

  export default class RFB extends EventTarget {
    constructor(
      target: HTMLElement,
      urlOrChannel: string | WebSocket | RTCDataChannel,
      options?: VncOptions
    )

    background: string
    clipViewport: boolean
    compressionLevel: number
    focusOnClick: boolean
    qualityLevel: number
    resizeSession: boolean
    scaleViewport: boolean
    viewOnly: boolean

    blur(): void
    clipboardPasteFrom(text: string): void
    disconnect(): void
    focus(options?: FocusOptions): void
    getImageData(): ImageData
    sendCredentials(credentials: VncCredentials): void
    sendCtrlAltDel(): void
    sendKey(keysym: number, code: string | null, down?: boolean): void
    toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void
    toDataURL(type?: string, encoderOptions?: number): string

    addEventListener<K extends keyof VncEventMap>(
      type: K,
      listener: (event: VncEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ): void
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void

    removeEventListener<K extends keyof VncEventMap>(
      type: K,
      listener: (event: VncEventMap[K]) => void,
      options?: boolean | EventListenerOptions
    ): void
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void
  }
}
