import 'dotenv/config'
import express from 'express'
import { v2 as cloudinary } from 'cloudinary'

const app = express()
const serverPort = Number(process.env.MEDIA_LIST_PORT ?? 8787)

function resolveCloudinaryConfig() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL ?? process.env.VITE_CLOUDINARY_URL

  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl)

      if (parsed.protocol === 'cloudinary:' && parsed.hostname) {
        return {
          cloud_name: parsed.hostname,
          api_key: decodeURIComponent(parsed.username),
          api_secret: decodeURIComponent(parsed.password),
        }
      }
    } catch {
      // Fall back to explicit env vars when CLOUDINARY_URL is malformed.
    }
  }

  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ?? process.env.VITE_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET ?? process.env.VITE_CLOUDINARY_API_SECRET,
  }
}

function normalizeMediaItem(resource, type) {
  const fallbackName = resource.public_id.split('/').at(-1) ?? resource.public_id

  return {
    id: resource.public_id,
    name: resource.original_filename || fallbackName,
    type,
    src: resource.secure_url,
    createdAt: resource.created_at,
  }
}

function validateCloudinaryConfig(config) {
  return Boolean(config.cloud_name && config.api_key && config.api_secret)
}

const cloudinaryConfig = resolveCloudinaryConfig()

if (!validateCloudinaryConfig(cloudinaryConfig)) {
  console.error('Missing Cloudinary API credentials for media-list server.')
  process.exit(1)
}

cloudinary.config(cloudinaryConfig)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/media-list', async (req, res) => {
  const requestedMax = Number(req.query.max ?? 100)
  const maxResults = Number.isFinite(requestedMax)
    ? Math.min(Math.max(Math.trunc(requestedMax), 1), 500)
    : 100

  try {
    const [images, videos] = await Promise.all([
      cloudinary.api.resources({
        type: 'upload',
        resource_type: 'image',
        max_results: maxResults,
      }),
      cloudinary.api.resources({
        type: 'upload',
        resource_type: 'video',
        max_results: maxResults,
      }),
    ])

    const media = [
      ...images.resources.map((item) => normalizeMediaItem(item, 'image')),
      ...videos.resources.map((item) => normalizeMediaItem(item, 'video')),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json({ media })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Cloudinary API error'

    res.status(500).json({
      error: 'Failed to fetch media list from Cloudinary.',
      detail: message,
    })
  }
})

app.listen(serverPort, () => {
  console.log(`Media list server running on http://localhost:${serverPort}`)
})
