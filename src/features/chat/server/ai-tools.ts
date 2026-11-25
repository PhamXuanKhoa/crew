import 'server-only'

import {
  AGENT_TOOL_ARGS_SCHEMAS,
  agentToolNameSchema,
  type AgentAction,
  type AgentToolName,
} from '../lib/agent-schema'

export interface RawToolCall {
  id: string
  name: string
  arguments: string
}

export interface OpenAiToolDefinition {
  type: 'function'
  function: {
    name: AgentToolName
    description: string
    parameters: Record<string, unknown>
  }
}

const coordinateProperties = {
  x: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Horizontal position on the screenshot. 0 = left edge, 1 = right edge.',
  },
  y: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Vertical position on the screenshot. 0 = top edge, 1 = bottom edge.',
  },
} as const

const keyNames = AGENT_TOOL_ARGS_SCHEMAS.press_key.shape.key.options

const ALL_TOOLS: OpenAiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'move_pointer',
      description: 'Move the mouse pointer without clicking.',
      parameters: {
        type: 'object',
        properties: coordinateProperties,
        required: ['x', 'y'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Move the pointer to a normalized coordinate and click a mouse button.',
      parameters: {
        type: 'object',
        properties: {
          ...coordinateProperties,
          button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button. Defaults to left.' },
          clickCount: { type: 'integer', enum: [1, 2], description: '1 for a single click, 2 for a double click.' },
        },
        required: ['x', 'y'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Type text into the focused field. Click the field first if it is not focused.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 1000 },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'press_key',
      description: 'Press and release one key, such as enter, tab, escape, backspace, or an arrow key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', enum: [...keyNames] },
        },
        required: ['key'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hotkey',
      description: 'Press a keyboard shortcut, for example ctrl+c or alt+tab.',
      parameters: {
        type: 'object',
        properties: {
          modifiers: {
            type: 'array',
            items: { type: 'string', enum: ['ctrl', 'alt', 'shift', 'meta'] },
            minItems: 1,
            maxItems: 3,
          },
          key: { type: 'string', enum: [...keyNames] },
        },
        required: ['modifiers', 'key'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'Scroll the desktop at a normalized coordinate. Negative deltaY scrolls up, positive scrolls down.',
      parameters: {
        type: 'object',
        properties: {
          ...coordinateProperties,
          deltaY: { type: 'integer', minimum: -2000, maximum: 2000 },
        },
        required: ['x', 'y', 'deltaY'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Wait briefly for a page, menu, or animation to finish loading.',
      parameters: {
        type: 'object',
        properties: {
          seconds: { type: 'number', minimum: 0.2, maximum: 10 },
        },
        required: ['seconds'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Pause and ask the user for information or a decision. Use this for credentials, OTP codes, choices, or confirmation of an irreversible action. The user answer arrives before the next step.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', minLength: 1, maxLength: 1000 },
          options: {
            type: 'array',
            items: { type: 'string', minLength: 1, maxLength: 120 },
            minItems: 1,
            maxItems: 6,
          },
        },
        required: ['question'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Finish the task and give the user a short summary of the result.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', minLength: 1, maxLength: 2000 },
        },
        required: ['summary'],
        additionalProperties: false,
      },
    },
  },
]

const DESKTOP_TOOL_NAMES = new Set<AgentToolName>([
  'move_pointer',
  'click',
  'type_text',
  'press_key',
  'hotkey',
  'scroll',
  'wait',
])

export function getToolDefinitions(desktopConnected: boolean): OpenAiToolDefinition[] {
  if (desktopConnected) return ALL_TOOLS
  return ALL_TOOLS.filter((tool) => tool.function.name === 'ask_user' || tool.function.name === 'finish')
}

export class ModelToolCallError extends Error {}

export function parseAgentToolCall(call: RawToolCall, desktopConnected: boolean): AgentAction {
  const nameResult = agentToolNameSchema.safeParse(call.name)
  if (!nameResult.success) {
    throw new ModelToolCallError(`The model requested an unknown action (${call.name}).`)
  }

  const name = nameResult.data
  if (!desktopConnected && DESKTOP_TOOL_NAMES.has(name)) {
    throw new ModelToolCallError('The model requested a desktop action while the desktop was not connected.')
  }

  let rawArguments: unknown
  try {
    rawArguments = call.arguments.trim() ? JSON.parse(call.arguments) : {}
  } catch {
    throw new ModelToolCallError('The model returned malformed action arguments.')
  }

  const argsResult = AGENT_TOOL_ARGS_SCHEMAS[name].safeParse(rawArguments)
  if (!argsResult.success) {
    throw new ModelToolCallError(`The model returned invalid arguments for ${name}.`)
  }

  const id = call.id.trim().slice(0, 120) || `call-${name}-${Date.now()}`

  return {
    id,
    name,
    args: argsResult.data,
  } as AgentAction
}
