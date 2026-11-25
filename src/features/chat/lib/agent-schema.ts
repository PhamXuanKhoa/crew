import { z } from 'zod'

/**
 * Control surface the model is allowed to use against the remote desktop.
 * Every argument is validated again on the server before it reaches the
 * browser, and the browser gives coordinates back to noVNC as normalized
 * values so a scaled screenshot can never shift the pointer.
 */
export const agentKeySchema = z.enum([
  'enter',
  'tab',
  'escape',
  'space',
  'backspace',
  'delete',
  'insert',
  'home',
  'end',
  'pageup',
  'pagedown',
  'up',
  'down',
  'left',
  'right',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
])

export const agentModifierSchema = z.enum(['ctrl', 'alt', 'shift', 'meta'])

const normalizedCoordinateSchema = z.number().finite().min(0).max(1)

const pointSchema = {
  x: normalizedCoordinateSchema.describe('Horizontal position, 0 = left edge, 1 = right edge.'),
  y: normalizedCoordinateSchema.describe('Vertical position, 0 = top edge, 1 = bottom edge.'),
}

export const AGENT_TOOL_ARGS_SCHEMAS = {
  move_pointer: z
    .object({
      ...pointSchema,
    })
    .strict(),
  click: z
    .object({
      ...pointSchema,
      button: z.enum(['left', 'right', 'middle']).default('left'),
      clickCount: z.union([z.literal(1), z.literal(2)]).default(1),
    })
    .strict(),
  type_text: z
    .object({
      text: z.string().min(1).max(1000),
    })
    .strict(),
  press_key: z
    .object({
      key: agentKeySchema,
    })
    .strict(),
  hotkey: z
    .object({
      modifiers: z.array(agentModifierSchema).min(1).max(3),
      key: agentKeySchema,
    })
    .strict(),
  scroll: z
    .object({
      ...pointSchema,
      deltaY: z.number().int().min(-2000).max(2000),
    })
    .strict(),
  wait: z
    .object({
      seconds: z.number().min(0.2).max(10),
    })
    .strict(),
  ask_user: z
    .object({
      question: z.string().min(1).max(1000),
      options: z.array(z.string().min(1).max(120)).min(1).max(6).optional(),
    })
    .strict(),
  finish: z
    .object({
      summary: z.string().min(1).max(2000),
    })
    .strict(),
} as const

export const agentToolNameSchema = z.enum([
  'move_pointer',
  'click',
  'type_text',
  'press_key',
  'hotkey',
  'scroll',
  'wait',
  'ask_user',
  'finish',
])

export type AgentToolName = z.infer<typeof agentToolNameSchema>

export type AgentAction =
  | { id: string; name: 'move_pointer'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.move_pointer> }
  | { id: string; name: 'click'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.click> }
  | { id: string; name: 'type_text'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.type_text> }
  | { id: string; name: 'press_key'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.press_key> }
  | { id: string; name: 'hotkey'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.hotkey> }
  | { id: string; name: 'scroll'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.scroll> }
  | { id: string; name: 'wait'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.wait> }
  | { id: string; name: 'ask_user'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.ask_user> }
  | { id: string; name: 'finish'; args: z.infer<typeof AGENT_TOOL_ARGS_SCHEMAS.finish> }

const actionIdSchema = z.string().min(1).max(120)

export const agentActionSchema = z.discriminatedUnion('name', [
  z
    .object({ id: actionIdSchema, name: z.literal('move_pointer'), args: AGENT_TOOL_ARGS_SCHEMAS.move_pointer })
    .strict(),
  z.object({ id: actionIdSchema, name: z.literal('click'), args: AGENT_TOOL_ARGS_SCHEMAS.click }).strict(),
  z.object({ id: actionIdSchema, name: z.literal('type_text'), args: AGENT_TOOL_ARGS_SCHEMAS.type_text }).strict(),
  z.object({ id: actionIdSchema, name: z.literal('press_key'), args: AGENT_TOOL_ARGS_SCHEMAS.press_key }).strict(),
  z.object({ id: actionIdSchema, name: z.literal('hotkey'), args: AGENT_TOOL_ARGS_SCHEMAS.hotkey }).strict(),
  z.object({ id: actionIdSchema, name: z.literal('scroll'), args: AGENT_TOOL_ARGS_SCHEMAS.scroll }).strict(),
  z.object({ id: actionIdSchema, name: z.literal('wait'), args: AGENT_TOOL_ARGS_SCHEMAS.wait }).strict(),
  z.object({ id: actionIdSchema, name: z.literal('ask_user'), args: AGENT_TOOL_ARGS_SCHEMAS.ask_user }).strict(),
  z.object({ id: actionIdSchema, name: z.literal('finish'), args: AGENT_TOOL_ARGS_SCHEMAS.finish }).strict(),
])

export const agentHistoryEntrySchema = z
  .object({
    role: z.enum(['user', 'assistant', 'action', 'observation']),
    content: z.string().min(1).max(4000),
  })
  .strict()

export type AgentHistoryEntry = z.infer<typeof agentHistoryEntrySchema>

export const agentStepRequestSchema = z
  .object({
    modelId: z.string().min(1).max(64),
    task: z.string().trim().min(1).max(8000),
    history: z.array(agentHistoryEntrySchema).max(32),
    screenshotDataUrl: z
      .string()
      .max(4_000_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Invalid screenshot data.')
      .nullable(),
    screen: z
      .object({
        width: z.number().int().positive().max(10_000),
        height: z.number().int().positive().max(10_000),
      })
      .strict()
      .nullable(),
  })
  .strict()

export type AgentStepRequest = z.infer<typeof agentStepRequestSchema>

export const agentStepResponseSchema = z
  .object({
    message: z.string().max(6000),
    action: agentActionSchema.nullable(),
  })
  .strict()

export type AgentStepResponse = z.infer<typeof agentStepResponseSchema>
