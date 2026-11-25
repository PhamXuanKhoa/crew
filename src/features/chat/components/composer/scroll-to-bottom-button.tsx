'use client'

import React from 'react'
import { ArrowDown } from 'lucide-react'

interface ScrollToBottomButtonProps {
  visible: boolean
  onClick: () => void
}

export function ScrollToBottomButton({ visible, onClick }: ScrollToBottomButtonProps) {
  if (!visible) return null

  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#444444] bg-[#212121] text-[#ececec] shadow-md transition hover:bg-[#2f2f2f] hover:text-white"
      aria-label="Scroll to bottom"
      title="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  )
}

