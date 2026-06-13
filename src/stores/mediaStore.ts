import { ref } from 'vue'
import { usePublicStore } from '@/stores/publicStore'

export type UploadedMediaType = 'image' | 'video'

export interface UploadedMedia {
  id: string
  name: string
  type: UploadedMediaType
  src: string
}

const MEDIA_LIST_ENDPOINT = '/api/media-list'
const MEDIA_UPLOAD_ENDPOINT = '/api/media-upload'

interface MediaListApiItem {
  id: string
  name: string
  type: UploadedMediaType
  src: string
}

function isMediaListApiItem(item: unknown): item is MediaListApiItem {
  if (!item || typeof item !== 'object') {
    return false
  }

  const candidate = item as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.type === 'image' || candidate.type === 'video') &&
    typeof candidate.src === 'string'
  )
}

const uploadedMedia = ref<UploadedMedia[]>([])

export function useMediaStore() {
  const { getSessionToken } = usePublicStore()

  function sessionHeaders() {
    const token = getSessionToken()

    if (!token) {
      throw new Error('A valid session is required.')
    }

    return {
      'X-Session-Token': token,
    }
  }

  async function syncUploadedMediaWithCloudinary() {
    const response = await fetch(MEDIA_LIST_ENDPOINT, {
      cache: 'no-store',
      headers: sessionHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to retrieve media list from server.')
    }

    const payload = (await response.json()) as { media?: unknown }
    const mediaItems = Array.isArray(payload.media) ? payload.media : []
    const validItems = mediaItems.filter(isMediaListApiItem)

    uploadedMedia.value = validItems

    return uploadedMedia.value.length
  }

  async function addFiles(
    files: FileList | File[],
    onProgress?: (current: number, total: number) => void,
  ) {
    const fileArray = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
    )

    for (const [i, file] of fileArray.entries()) {
      onProgress?.(i + 1, fileArray.length)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(MEDIA_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: sessionHeaders(),
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}.`)
      }

      await response.json()
    }

    await syncUploadedMediaWithCloudinary()
  }

  return {
    uploadedMedia,
    addFiles,
    syncUploadedMediaWithCloudinary,
  }
}
