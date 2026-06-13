import { ref } from 'vue'

const STORAGE_KEY = 'app_session_token'

interface StoredSession {
  token: string
  expiresAt: number | null
}

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw || !raw.startsWith('{')) return null
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

const stored = loadStoredSession()
const sessionToken = ref<string | null>(stored?.token ?? null)
const sessionExpiresAt = ref<number | null>(stored?.expiresAt ?? null)
const isPublic = ref<boolean>(false)

export function usePublicStore() {
  function makePrivate() {
    sessionToken.value = null
    sessionExpiresAt.value = null
    isPublic.value = false
    localStorage.removeItem(STORAGE_KEY)
  }

  async function verifySession(): Promise<boolean> {
    const token = sessionToken.value
    if (!token) {
      isPublic.value = false
      return false
    }
    // Fast client-side expiry check
    if (sessionExpiresAt.value !== null && sessionExpiresAt.value <= Date.now()) {
      makePrivate()
      return false
    }
    try {
      const res = await fetch(`/api/verify?sessionToken=${encodeURIComponent(token)}`)
      const data = await res.json()
      isPublic.value = Boolean(data.valid)
      if (!isPublic.value) makePrivate()
    } catch {
      isPublic.value = false
    }
    return isPublic.value
  }

  function makePublic(token: string, expiresAt: number | null = null) {
    sessionToken.value = token
    sessionExpiresAt.value = expiresAt
    isPublic.value = true
    const session: StoredSession = { token, expiresAt }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }

  function getSessionToken() {
    return sessionToken.value
  }

  return { isPublic, makePublic, makePrivate, verifySession, getSessionToken }
}
