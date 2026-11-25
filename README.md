# Dots — AI VNC desktop agent

A 100% Next.js computer-use app. The selected AI model sees screenshots of a remote
desktop, drives it through noVNC (mouse, keyboard, scrolling), and can pause to ask
the user for input with an in-app prompt.

## Architecture

```
Browser (noVNC) ──screenshot──► POST /api/agent/step ──► OpenAI-compatible model
      ▲                                                        │
      └────────────── validated tool action ◄──────────────────┘
```

- The VNC session lives entirely in the browser. The server never receives VNC
  credentials.
- Each agent step sends the current screenshot, the task, and a bounded progress log
  to `POST /api/agent/step`.
- The route validates the request with Zod, loads the selected model's API key from
  an encrypted httpOnly cookie, calls the model with a strict tool schema, and returns
  at most one validated action.
- The browser executes that action through noVNC, waits briefly for the UI to settle,
  captures a new screenshot, and repeats (max 20 steps).
- `ask_user` pauses the loop and opens a prompt in the chat. The answer is added to the
  history and the loop resumes.

## Setup

```bash
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
# then set MODEL_CREDENTIALS_SECRET (32+ chars)
npm run dev
```

Development works without the secret by using an ephemeral in-memory encryption key,
but model profiles then disappear whenever the dev server restarts. Production
requires `MODEL_CREDENTIALS_SECRET`.

## VNC setup

The browser connects to a WebSocket proxy in front of the VNC server:

```bash
websockify 6080 localhost:5900
```

In the app, choose **Connect to PC**, enter the machine hostname/IP and the proxy port
(`6080` by default), then enter the VNC password. The VNC server itself should listen
on `localhost:5900`. When the app is served over HTTPS, use a `wss://` capable proxy.

Screenshots of the desktop are sent to the selected AI provider and the model can
control the remote mouse and keyboard. VNC credentials stay in memory for the tab and
are never persisted.

## Model requirements

Add a model from the model selector in the header. It must expose an
OpenAI-compatible `POST /chat/completions` API with:

- image/vision input,
- function/tool calling,
- a base URL such as `https://api.openai.com/v1` or `http://localhost:11434/v1`.

API keys are encrypted with AES-256-GCM and stored in an httpOnly, SameSite=Lax cookie.
They are never stored in `localStorage` or exposed to client JavaScript. The agent
route is same-origin only and validates every request and tool argument. Answers to
agent questions and text typed into the remote desktop stay in the live transcript but
are redacted before chat history is written to `localStorage`.

Private-network model endpoints are allowed in development. In production they are
blocked unless `ALLOW_PRIVATE_MODEL_ENDPOINTS=true`; keep that default unless the
deployment is trusted.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```
