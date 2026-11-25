import { ChatLayout } from '@/features/chat/components/chat-layout'
import { listModelProfiles } from '@/features/chat/server/model-profile-store'

export const metadata = {
  title: 'Dots',
  description: 'Dots AI desktop agent built with Next.js',
}

export default async function Page() {
  const initialModelProfiles = await listModelProfiles()
  return <ChatLayout initialModelProfiles={initialModelProfiles} />
}
