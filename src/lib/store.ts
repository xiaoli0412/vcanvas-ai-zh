// Shared types

export interface ChatChip {
  role: 'user' | 'assistant'
  text: string
  badge?: string
  images?: { src: string; label: string }[]
}

export function createModeChip(
  role: ChatChip['role'],
  text: string,
  modeBadge: string,
  partial: Omit<Partial<ChatChip>, 'role' | 'text'> = {},
): ChatChip {
  return {
    role,
    text,
    badge: partial.badge || modeBadge,
    images: partial.images,
  }
}

export function trimChipText(text: string, maxLength = 40) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

export function formatOutcomeText(actionLabel: string) {
  return `OK · ${actionLabel}`
}
