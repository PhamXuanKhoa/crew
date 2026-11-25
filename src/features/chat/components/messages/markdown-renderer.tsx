'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, Copy } from 'lucide-react'

interface MarkdownRendererProps {
  content: string
}

function CodeBlock({
  language,
  value,
}: {
  language: string
  value: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[#333333] bg-[#0d0d0d]">
      <div className="flex items-center justify-between bg-[#1e1e1e] px-4 py-1.5 text-xs text-[#a0a0a0]">
        <span className="font-mono lowercase">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 transition hover:bg-[#2d2d2d] hover:text-[#ececec]"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#f0f0f0]">
        <code>{value}</code>
      </pre>
    </div>
  )
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert max-w-none text-[#ececec]">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !String(children).includes('\n')

            if (isInline) {
              return (
                <code
                  className="rounded bg-[#2a2a2a] px-1.5 py-0.5 font-mono text-[13px] text-[#f2f2f2]"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            const codeText = String(children).replace(/\n$/, '')
            const language = match ? match[1] : ''

            return <CodeBlock language={language} value={codeText} />
          },
          p({ children }) {
            return <p className="mb-3 text-[15px] leading-7 text-[#ececec] last:mb-0">{children}</p>
          },
          h1({ children }) {
            return <h1 className="mb-4 mt-6 text-xl font-bold tracking-tight text-white first:mt-0">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="mb-3 mt-5 text-lg font-semibold tracking-tight text-white first:mt-0">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="mb-2 mt-4 text-base font-semibold text-white first:mt-0">{children}</h3>
          },
          ul({ children }) {
            return <ul className="mb-3 list-disc space-y-1 pl-6 text-[15px] leading-7 text-[#ececec]">{children}</ul>
          },
          ol({ children }) {
            return <ol className="mb-3 list-decimal space-y-1 pl-6 text-[15px] leading-7 text-[#ececec]">{children}</ol>
          },
          li({ children }) {
            return <li className="pl-1 leading-relaxed">{children}</li>
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 border-l-2 border-[#555555] pl-4 italic text-[#b4b4b4]">
                {children}
              </blockquote>
            )
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#10a37f] underline underline-offset-2 hover:text-[#1a7f64]"
              >
                {children}
              </a>
            )
          },
          hr() {
            return <hr className="my-4 border-[#333333]" />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

