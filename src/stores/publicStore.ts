import { ref } from 'vue'

const STORAGE_KEY = 'app_is_public'

const isPublic = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')

export function usePublicStore() {
  function makePublic() {
    isPublic.value = true
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  function makePrivate() {
    isPublic.value = false
    localStorage.removeItem(STORAGE_KEY)
  }

  return { isPublic, makePublic, makePrivate }
}
