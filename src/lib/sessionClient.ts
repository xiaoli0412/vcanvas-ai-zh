import type { AuthSession } from '../../shared/contracts/publicServer'

const SESSION_STORAGE_KEY = 'vcanvas_public_session'

interface StoredPublicSession {
  sessionId: string
  userId: string
  expiresAt: string
}

function storage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function savePublicSession(session: AuthSession | null | undefined) {
  const target = storage()
  if (!target || !session) return
  const value: StoredPublicSession = {
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
  }
  target.setItem(SESSION_STORAGE_KEY, JSON.stringify(value))
}

export function clearPublicSession() {
  storage()?.removeItem(SESSION_STORAGE_KEY)
}

export function getPublicSession(): StoredPublicSession | null {
  const target = storage()
  if (!target) return null
  try {
    const value = JSON.parse(target.getItem(SESSION_STORAGE_KEY) || 'null') as StoredPublicSession | null
    if (!value?.sessionId || !value.userId || !value.expiresAt) return null
    if (Date.parse(value.expiresAt) <= Date.now()) {
      clearPublicSession()
      return null
    }
    return value
  } catch {
    clearPublicSession()
    return null
  }
}

export function sessionHeaders(): Record<string, string> {
  const session = getPublicSession()
  if (!session) return {}
  return {
    'x-vcanvas-session-id': session.sessionId,
    'x-vcanvas-user-id': session.userId,
  }
}

export function mergeSessionHeaders(headers?: HeadersInit): HeadersInit {
  return {
    ...(headers as Record<string, string> | undefined),
    ...sessionHeaders(),
  }
}
