import { Conversation, GroupedConversations } from '../types'

export function groupConversationsByDate(conversations: Conversation[]): GroupedConversations {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const sevenDaysAgoStart = todayStart - 7 * 86400000

  const groups: GroupedConversations = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  }

  // Sort descending by updatedAt
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)

  for (const conv of sorted) {
    const time = conv.updatedAt || conv.createdAt
    if (time >= todayStart) {
      groups.today.push(conv)
    } else if (time >= yesterdayStart) {
      groups.yesterday.push(conv)
    } else if (time >= sevenDaysAgoStart) {
      groups.previous7Days.push(conv)
    } else {
      groups.older.push(conv)
    }
  }

  return groups
}

