import type RFB from '@novnc/novnc'
import type { AgentAction } from './agent-schema'

export interface VncScreenshot {
  dataUrl: string
  width: number
  height: number
}

/**
 * Browser-side bridge between the agent and noVNC. Only normalized
 * coordinates and already-validated actions reach this layer.
 */
export interface VncAgentController {
  isConnected(): boolean
  captureScreenshot(): VncScreenshot | null
  execute(action: AgentAction): void
}

const SPECIAL_KEYS: Record<string, { keysym: number; code: string }> = {
  enter: { keysym: 0xff0d, code: 'Enter' },
  tab: { keysym: 0xff09, code: 'Tab' },
  escape: { keysym: 0xff1b, code: 'Escape' },
  space: { keysym: 0x0020, code: 'Space' },
  backspace: { keysym: 0xff08, code: 'Backspace' },
  delete: { keysym: 0xffff, code: 'Delete' },
  insert: { keysym: 0xff63, code: 'Insert' },
  home: { keysym: 0xff50, code: 'Home' },
  end: { keysym: 0xff57, code: 'End' },
  pageup: { keysym: 0xff55, code: 'PageUp' },
  pagedown: { keysym: 0xff56, code: 'PageDown' },
  up: { keysym: 0xff52, code: 'ArrowUp' },
  down: { keysym: 0xff54, code: 'ArrowDown' },
  left: { keysym: 0xff51, code: 'ArrowLeft' },
  right: { keysym: 0xff53, code: 'ArrowRight' },
  f1: { keysym: 0xffbe, code: 'F1' },
  f2: { keysym: 0xffbf, code: 'F2' },
  f3: { keysym: 0xffc0, code: 'F3' },
  f4: { keysym: 0xffc1, code: 'F4' },
  f5: { keysym: 0xffc2, code: 'F5' },
  f6: { keysym: 0xffc3, code: 'F6' },
  f7: { keysym: 0xffc4, code: 'F7' },
  f8: { keysym: 0xffc5, code: 'F8' },
  f9: { keysym: 0xffc6, code: 'F9' },
  f10: { keysym: 0xffc7, code: 'F10' },
  f11: { keysym: 0xffc8, code: 'F11' },
  f12: { keysym: 0xffc9, code: 'F12' },
  ctrl: { keysym: 0xffe3, code: 'ControlLeft' },
  alt: { keysym: 0xffe9, code: 'AltLeft' },
  shift: { keysym: 0xffe1, code: 'ShiftLeft' },
  meta: { keysym: 0xffeb, code: 'MetaLeft' },
}

const MOUSE_BUTTONS = {
  left: { button: 0, buttons: 1 },
  right: { button: 2, buttons: 2 },
  middle: { button: 1, buttons: 4 },
} as const

function clampCoordinate(value: number): number {
  return Math.min(0.999, Math.max(0.001, value))
}

function keyEventFor(key: string): { keysym: number; code: string } {
  if (/^[a-z]$/.test(key)) {
    return { keysym: key.charCodeAt(0), code: `Key${key.toUpperCase()}` }
  }
  if (/^[0-9]$/.test(key)) {
    return { keysym: key.charCodeAt(0), code: `Digit${key}` }
  }

  const special = SPECIAL_KEYS[key]
  if (!special) throw new Error(`Unsupported key: ${key}`)
  return special
}

export function createVncAgentController(rfb: RFB, container: HTMLElement): VncAgentController {
  const getCanvas = (): HTMLCanvasElement | null => container.querySelector('canvas')

  const pointInCanvas = (x: number, y: number): { clientX: number; clientY: number } | null => {
    const canvas = getCanvas()
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    return {
      clientX: rect.left + clampCoordinate(x) * rect.width,
      clientY: rect.top + clampCoordinate(y) * rect.height,
    }
  }

  const dispatchMouse = (
    type: 'mousemove' | 'mousedown' | 'mouseup',
    point: { clientX: number; clientY: number },
    button: number,
    buttons: number
  ) => {
    const canvas = getCanvas()
    if (!canvas) return

    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: point.clientX,
        clientY: point.clientY,
        button,
        buttons,
      })
    )
  }

  const movePointer = (x: number, y: number) => {
    const point = pointInCanvas(x, y)
    if (!point) throw new Error('The VNC canvas is not ready.')
    dispatchMouse('mousemove', point, 0, 0)
  }

  const click = (x: number, y: number, button: keyof typeof MOUSE_BUTTONS, clickCount: number) => {
    const point = pointInCanvas(x, y)
    if (!point) throw new Error('The VNC canvas is not ready.')

    const mask = MOUSE_BUTTONS[button]
    for (let count = 0; count < clickCount; count++) {
      dispatchMouse('mousemove', point, 0, 0)
      dispatchMouse('mousedown', point, mask.button, mask.buttons)

      // noVNC installs a full-screen capture proxy on mousedown so a real
      // mouseup happens over that proxy. Target it too, otherwise its
      // stopPropagation() leaves the proxy covering the UI.
      const captureProxy = document.getElementById('noVNC_mouse_capture_elem')
      if (captureProxy) {
        captureProxy.dispatchEvent(
          new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            clientX: point.clientX,
            clientY: point.clientY,
            button: mask.button,
            buttons: 0,
          })
        )
      } else {
        dispatchMouse('mouseup', point, mask.button, 0)
      }
    }
  }

  const scroll = (x: number, y: number, deltaY: number) => {
    const point = pointInCanvas(x, y)
    if (!point) throw new Error('The VNC canvas is not ready.')
    if (deltaY === 0) return

    const canvas = getCanvas()
    if (!canvas) return

    const steps = Math.min(10, Math.max(1, Math.round(Math.abs(deltaY) / 100)))
    const stepDelta = Math.sign(deltaY) * 100

    for (let index = 0; index < steps; index++) {
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: point.clientX,
          clientY: point.clientY,
          deltaY: stepDelta,
          deltaMode: 0,
        })
      )
    }
  }

  const typeText = (text: string) => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    for (const character of normalized) {
      if (character === '\n') {
        const key = SPECIAL_KEYS.enter
        rfb.sendKey(key.keysym, key.code)
        continue
      }
      if (character === '\t') {
        const key = SPECIAL_KEYS.tab
        rfb.sendKey(key.keysym, key.code)
        continue
      }

      const codePoint = character.codePointAt(0)
      if (codePoint === undefined) continue
      const keysym = codePoint < 0x100 ? codePoint : 0x01000000 + codePoint
      rfb.sendKey(keysym, null)
    }
  }

  const pressKey = (key: string) => {
    const event = keyEventFor(key)
    rfb.sendKey(event.keysym, event.code)
  }

  const hotkey = (modifiers: string[], key: string) => {
    const pressed: { keysym: number; code: string }[] = []
    try {
      for (const modifier of modifiers) {
        const event = keyEventFor(modifier)
        rfb.sendKey(event.keysym, event.code, true)
        pressed.push(event)
      }

      const target = keyEventFor(key)
      rfb.sendKey(target.keysym, target.code, true)
      rfb.sendKey(target.keysym, target.code, false)
    } finally {
      for (const event of [...pressed].reverse()) {
        rfb.sendKey(event.keysym, event.code, false)
      }
    }
  }

  const execute = (action: AgentAction) => {
    switch (action.name) {
      case 'move_pointer':
        movePointer(action.args.x, action.args.y)
        break
      case 'click':
        click(action.args.x, action.args.y, action.args.button, action.args.clickCount)
        break
      case 'type_text':
        typeText(action.args.text)
        break
      case 'press_key':
        pressKey(action.args.key)
        break
      case 'hotkey':
        hotkey(action.args.modifiers, action.args.key)
        break
      case 'scroll':
        scroll(action.args.x, action.args.y, action.args.deltaY)
        break
      case 'wait':
      case 'ask_user':
      case 'finish':
        break
    }
  }

  return {
    isConnected: () => {
      const canvas = getCanvas()
      return container.isConnected && canvas !== null && canvas.width > 0 && canvas.height > 0
    },

    captureScreenshot: () => {
      try {
        const source = getCanvas()
        if (!source || source.width === 0 || source.height === 0) return null

        const scale = Math.min(1, 1440 / source.width, 1200 / source.height)
        const width = Math.max(1, Math.round(source.width * scale))
        const height = Math.max(1, Math.round(source.height * scale))

        const output = document.createElement('canvas')
        output.width = width
        output.height = height
        const context = output.getContext('2d')
        if (!context) return null

        context.fillStyle = '#000000'
        context.fillRect(0, 0, width, height)
        context.drawImage(source, 0, 0, width, height)

        return {
          dataUrl: output.toDataURL('image/jpeg', 0.72),
          width,
          height,
        }
      } catch {
        return null
      }
    },

    execute,
  }
}
