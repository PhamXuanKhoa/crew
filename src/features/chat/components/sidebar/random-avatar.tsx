'use client'

import React, { useSyncExternalStore } from 'react'
import Image from 'next/image'

// Evaluated once per browser page reload: integer from 1 to 9
const randomAvatarNumber =
  typeof window !== 'undefined' ? Math.floor(Math.random() * 9) + 1 : 1

const emptySubscribe = () => () => {}

export function useRandomAvatar(): number {
  return useSyncExternalStore(
    emptySubscribe,
    () => randomAvatarNumber,
    () => 1
  )
}

interface RandomAvatarProps {
  className?: string
  size?: number
}

export function RandomAvatar({ className = 'h-7 w-7', size = 28 }: RandomAvatarProps) {
  const avatarId = useRandomAvatar()

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-[#2a2a2a] shadow-xs flex items-center justify-center ${className}`}
    >
      <Image
        src={`/avatars/${avatarId}.svg`}
        alt={`Avatar ${avatarId}`}
        width={size}
        height={size}
        unoptimized
        priority
        className="h-full w-full object-cover"
      />
    </div>
  )
}

