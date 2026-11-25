import type { AgentAction } from './agent-schema'
import type { VncAgentController } from './vnc-agent-controller'

export class AgentCancelledError extends Error {
  constructor() {
    super('The agent run was cancelled.')
    this.name = 'AgentCancelledError'
  }
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AgentCancelledError()
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AgentCancelledError())
      return
    }

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      window.clearTimeout(timeoutId)
      signal.removeEventListener('abort', onAbort)
      reject(new AgentCancelledError())
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`

export interface ActionDescription {
  label: string
  detail?: string
}

export function describeAgentAction(action: AgentAction): ActionDescription {
  switch (action.name) {
    case 'move_pointer':
      return {
        label: 'Move pointer',
        detail: `x ${percent(action.args.x)}, y ${percent(action.args.y)}`,
      }
    case 'click':
      return {
        label: `Click ${action.args.button}${action.args.clickCount === 2 ? ' (double)' : ''}`,
        detail: `x ${percent(action.args.x)}, y ${percent(action.args.y)}`,
      }
    case 'type_text':
      return {
        label: 'Type text',
        detail: `"${action.args.text.length > 100 ? `${action.args.text.slice(0, 100)}...` : action.args.text}"`,
      }
    case 'press_key':
      return { label: `Press ${action.args.key}` }
    case 'hotkey':
      return { label: `Press ${[...action.args.modifiers, action.args.key].join('+')}` }
    case 'scroll':
      return {
        label: action.args.deltaY < 0 ? 'Scroll up' : 'Scroll down',
        detail: `x ${percent(action.args.x)}, y ${percent(action.args.y)}, ${Math.abs(action.args.deltaY)} px`,
      }
    case 'wait':
      return { label: `Wait ${action.args.seconds.toFixed(1)}s` }
    case 'ask_user':
      return { label: 'Ask you a question', detail: action.args.question }
    case 'finish':
      return { label: 'Finish task', detail: action.args.summary }
  }
}

const SETTLE_MS: Record<AgentAction['name'], number> = {
  move_pointer: 100,
  click: 450,
  type_text: 250,
  press_key: 300,
  hotkey: 350,
  scroll: 450,
  wait: 0,
  ask_user: 0,
  finish: 0,
}

export async function executeAgentAction(
  controller: VncAgentController,
  action: AgentAction,
  signal: AbortSignal
): Promise<void> {
  throwIfAborted(signal)

  if (action.name === 'wait') {
    await sleep(action.args.seconds * 1000, signal)
    return
  }

  if (action.name === 'ask_user' || action.name === 'finish') return

  controller.execute(action)
  const settle = SETTLE_MS[action.name]
  if (settle > 0) {
    await sleep(settle, signal)
  }
}
