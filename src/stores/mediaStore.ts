import { ref } from 'vue'

export type UploadedMediaType = 'image' | 'video'

export interface UploadedMedia {
  id: string
  name: string
  type: UploadedMediaType
  src: string
}

const CLOUDINARY_URL = import.meta.env.VITE_CLOUDINARY_URL as string | undefined
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined
const MEDIA_LIST_ENDPOINT = '/api/media-list'

function resolveCloudinaryCloudName() {
  if (CLOUDINARY_URL) {
    try {
      const parsed = new URL(CLOUDINARY_URL)
      if (parsed.protocol === 'cloudinary:' && parsed.hostname) {
        return parsed.hostname
      }
    } catch {
      // Ignore malformed VITE_CLOUDINARY_URL and fallback to VITE_CLOUDINARY_CLOUD_NAME.
    }
  }

  return CLOUDINARY_CLOUD_NAME
}

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

const STORAGE_KEY = 'v-wed-media'

function loadFromStorage(): UploadedMedia[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMediaListApiItem)
  } catch {
    return []
  }
}

function saveToStorage(items: UploadedMedia[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded)
  }
}

const uploadedMedia = ref<UploadedMedia[]>(loadFromStorage())

export function useMediaStore() {
  async function syncUploadedMediaWithCloudinary() {
    const response = await fetch(MEDIA_LIST_ENDPOINT, { cache: 'no-store' })

    if (!response.ok) {
      throw new Error('Failed to retrieve media list from server.')
    }

    const payload = (await response.json()) as { media?: unknown }
    const mediaItems = Array.isArray(payload.media) ? payload.media : []
    const validItems = mediaItems.filter(isMediaListApiItem)

    uploadedMedia.value = validItems
    saveToStorage(uploadedMedia.value)

    return uploadedMedia.value.length
  }

  async function addFiles(files: FileList | File[]) {
    const cloudName = resolveCloudinaryCloudName()

    if (!cloudName || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error('Cloudinary environment variables are missing.')
    }

    const fileArray = Array.from(files)

    for (const file of fileArray) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')

      if (!isImage && !isVideo) {
        continue
      }

      const resourceType = isImage ? 'image' : 'video'
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`

      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}.`)
      }

      const data = (await response.json()) as {
        public_id: string
        secure_url: string
      }

      uploadedMedia.value.push({
        id: data.public_id,
        name: file.name,
        type: isImage ? 'image' : 'video',
        src: data.secure_url,
      })
      saveToStorage(uploadedMedia.value)
    }
  }

  return {
    uploadedMedia,
    addFiles,
    syncUploadedMediaWithCloudinary,
  }
}
