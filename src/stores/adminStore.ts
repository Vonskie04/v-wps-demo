import { ref } from 'vue'

const STORAGE_KEY = 'admin_session_token'

interface StoredAdminSession {
  token: string
  expiresAt: number | null
}

function loadStoredAdminSession(): StoredAdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw || !raw.startsWith('{')) return null
    return JSON.parse(raw) as StoredAdminSession
  } catch {
    return null
  }
}

const stored = loadStoredAdminSession()
const adminSessionToken = ref<string | null>(stored?.token ?? null)
const adminSessionExpiresAt = ref<number | null>(stored?.expiresAt ?? null)
const isAdmin = ref(false)

export function useAdminStore() {
  function lockAdmin() {
    adminSessionToken.value = null
    adminSessionExpiresAt.value = null
    isAdmin.value = false
    localStorage.removeItem(STORAGE_KEY)
  }

  async function verifyAdminSession(): Promise<boolean> {
    const token = adminSessionToken.value
    if (!token) {
      isAdmin.value = false
      return false
    }

    if (adminSessionExpiresAt.value !== null && adminSessionExpiresAt.value <= Date.now()) {
      lockAdmin()
      return false
    }

    try {
      const res = await fetch(`/api/admin/verify?sessionToken=${encodeURIComponent(token)}`)
      const data = await res.json()
      isAdmin.value = Boolean(data.valid)
      if (!isAdmin.value) lockAdmin()
    } catch {
      isAdmin.value = false
    }

    return isAdmin.value
  }

  function makeAdmin(token: string, expiresAt: number | null = null) {
    adminSessionToken.value = token
    adminSessionExpiresAt.value = expiresAt
    isAdmin.value = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }))
  }

  function getAdminSessionToken() {
    return adminSessionToken.value
  }

  return { isAdmin, lockAdmin, verifyAdminSession, makeAdmin, getAdminSessionToken }
}
