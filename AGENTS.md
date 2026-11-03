## 1. System Architecture & Data Flow
Enforce strict separation between the client boundary, server entry points, and the Data Access Layer (DAL).

[Client Component ('use client')] 
       │
       ├──(Reads)────► [React Server Component (RSC)]
       │                      │
       └──(Mutates)──► [Server Action ('use server') / Route Handler]
                              │
                              ▼
                  ┌───────────────────────┐
                  │   Validation (Zod)    │ ◄── Reject malformed input
                  └───────────┬───────────┘
                              ▼
                  ┌───────────────────────┐
                  │ Data Access Layer     │ ◄── Enforce import 'server-only'
                  │ (AuthZ + Session Ver) │ ◄── Verify identity & RBAC here
                  └───────────┬───────────┘
                              ▼
                  ┌───────────────────────┐
                  │   Database / External │
                  │    Returns clean DTOs  │ ◄── Never return raw DB rows
                  └───────────────────────┘

## 2. Core Next.js (15/16+) Conventions
* **App Router Only:** Never use the legacy `pages/` directory, `getServerSideProps`, or `getStaticProps`.
* **Async Request APIs:** Always `await` dynamic APIs before accessing properties: `await params`, `await searchParams`, `await cookies()`, and `await headers()`.
* **RSC by Default:** Every component is a Server Component unless it requires browser APIs, event listeners, or React state/effects. Push `'use client'` to the smallest possible leaf node.
* **Explicit Caching:** `fetch()` and Route Handlers are uncached by default. Opt into caching explicitly using `{ next: { revalidate: N, tags: ['...'] } }` or the `'use cache'` directive. Trigger invalidation after mutations via `revalidateTag()` or `revalidatePath()`.
* **Feature-Colocated Structure:**
src/
├── app/                  # Routing, layouts, generateMetadata ONLY
├── features/[feature]/   # Feature-scoped components, actions, hooks, types
├── components/ui/        # Shared stateless UI primitives (Tailwind + shadcn/ui)
└── lib/                  # DAL (server-only), auth, db client, env schema

* **Performance Defaults:** Use `next/image` (configure `sizes` and `priority` for LCP), `next/font`, and wrap slow data-fetching RSCs in `<Suspense>` boundaries.

## 3. Strict Security & Vulnerability Prevention
* **Zero-Trust Middleware/Proxy (CVE-2025-29927):** Never rely solely on `middleware.ts` (or `proxy.ts` in Next 16) for authentication or authorization. Use it only for optimistic redirects. Always re-verify the session inside the DAL, Server Action, or Route Handler.
* **Treat Server Actions as Public HTTP Endpoints:**
* Any function under `'use server'` is publicly callable via POST.
* Validate 100% of arguments (and URL `params`/`searchParams`) at the top of the function using **Zod**; TypeScript types do not exist at runtime.
* Authenticate and verify resource-level authorization inside every action.


* **Isolate the Data Access Layer (DAL):**
* Place `"import 'server-only'"` at the top of all DB, auth, and secret-handling modules.
* Return minimal **Data Transfer Objects (DTOs)**. Never pass raw database records or `db.update().returning()` directly to Client Components or Server Action responses (prevents leaking password hashes, internal flags, or PII).


* **Secrets & Environment Variables (CVE-2025-55183):**
* Never hardcode secrets in source code (prevents leakage if compiled Server Function source is exposed).
* Never prefix sensitive keys with `NEXT_PUBLIC_`.
* Validate all environment variables at boot using a typed schema (`@t3-oss/env-nextjs` or `zod`).


* **Session & Auth Hygiene:**
* Store session tokens exclusively in `httpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) cookies. Never store tokens or sensitive state in `localStorage` or `sessionStorage`.
* Verify `Origin` and `Host` headers on custom cookie-authenticated Route Handlers to prevent CSRF.


* **SSRF, Open Redirect, & XSS Prevention:**
* Never construct `rewrites()`, `redirects()`, or server `fetch()` target hosts from unvalidated user input (prevents SSRF/Open Redirects like CVE-2026-64645).
* Lock down `next.config` `images.remotePatterns` to exact trusted domains and paths. Keep `dangerouslyAllowSVG` and `dangerouslyAllowLocalIP` disabled.
* Never use `dangerouslySetInnerHTML` without strict sanitization (`dompurify`). Escape all dynamic values passed into `next/og` SVG templates (CVE-2026-94545).
* Configure strict security headers in `next.config`: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.



## 4. Coding & Verification Workflow
* **Minimalist Code:** Write strict, zero-any TypeScript. Prefer native Web APIs and Server Actions over unnecessary client libraries or `useEffect` state syncs.
* **Self-Verification Gate:** After generating or modifying code, always run `tsc --noEmit` and `next lint` to verify zero type or convention errors before completing the task.