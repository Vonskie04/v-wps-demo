import { ref } from 'vue'

const STORAGE_KEY = 'app_session_token'

const sessionToken = ref<string | null>(localStorage.getItem(STORAGE_KEY))
const isPublic = ref<boolean>(false)
let sessionVerified = false

export function usePublicStore() {
  async function verifySession(): Promise<boolean> {
    if (sessionVerified) return isPublic.value
    const token = sessionToken.value
    if (!token) {
      isPublic.value = false
      sessionVerified = true
      return false
    }
    try {
      const res = await fetch(`/api/verify?sessionToken=${encodeURIComponent(token)}`)
      const data = await res.json()
      isPublic.value = Boolean(data.valid)
    } catch {
      isPublic.value = false
    }
    sessionVerified = true
    return isPublic.value
  }

  function makePublic(token: string) {
    sessionToken.value = token
    isPublic.value = true
    sessionVerified = true
    localStorage.setItem(STORAGE_KEY, token)
  }

  function makePrivate() {
    sessionToken.value = null
    isPublic.value = false
    sessionVerified = false
    localStorage.removeItem(STORAGE_KEY)
  }

  return { isPublic, makePublic, makePrivate, verifySession }
}
