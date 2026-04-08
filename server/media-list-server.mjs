import 'dotenv/config'
import express from 'express'
import { createHmac, randomBytes } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { v2 as cloudinary } from 'cloudinary'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '../dist')

const app = express()

// server/media-list-server.mjs
const serverPort = Number(process.env.PORT ?? process.env.MEDIA_LIST_PORT ?? 8787)

app.use(express.json())

// Allow cross-origin requests from any device (needed for multi-device access)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

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

const ACCESS_TOKEN = process.env.ACCESS_TOKEN
const MASTER_KEY = process.env.MASTER_KEY

// In-memory issued-token store: token -> expiry timestamp (ms)
const issuedTokens = new Map()
const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

function pruneExpired() {
  const now = Date.now()
  for (const [t, exp] of issuedTokens) {
    if (exp <= now) issuedTokens.delete(t)
  }
}

// In-memory active session store: sessionToken -> expiresAt | null (null = no expiry)
const activeSessions = new Map()

function pruneExpiredSessions() {
  const now = Date.now()
  for (const [t, exp] of activeSessions) {
    if (exp !== null && exp <= now) activeSessions.delete(t)
  }
}

setInterval(pruneExpiredSessions, 5 * 60 * 1000)

function createSessionToken() {
  return randomBytes(32).toString('hex')
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/issue-token', (req, res) => {
  if (!MASTER_KEY) {
    return res.status(500).json({ error: 'Token issuance not configured on server.' })
  }
  const { token, masterKey, ttlMinutes } = req.body ?? {}
  if (!masterKey || masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }
  if (!token || typeof token !== 'string' || token.length < 8) {
    return res.status(400).json({ error: 'Invalid token.' })
  }
  const ttl = Number.isFinite(Number(ttlMinutes))
    ? Math.min(Math.max(Math.trunc(Number(ttlMinutes)), 1), 2880) * 60 * 1000
    : TOKEN_TTL_MS
  pruneExpired()
  const expiresAt = Date.now() + ttl
  issuedTokens.set(token, expiresAt)
  res.json({ ok: true, expiresAt })
})

app.post('/api/unlock', (req, res) => {
  const { token } = req.body ?? {}
  if (!token) {
    return res.status(401).json({ error: 'Incorrect token.' })
  }
  // Legacy: static ACCESS_TOKEN from env — use default TTL
  if (ACCESS_TOKEN && token === ACCESS_TOKEN) {
    const sessionToken = createSessionToken()
    const expiresAt = Date.now() + TOKEN_TTL_MS
    activeSessions.set(sessionToken, expiresAt)
    return res.json({ sessionToken, expiresAt })
  }
  // Issued token with TTL
  pruneExpired()
  const expiresAt = issuedTokens.get(token)
  if (!expiresAt) {
    return res.status(401).json({ error: 'Incorrect token.' })
  }
  if (expiresAt <= Date.now()) {
    issuedTokens.delete(token)
    return res.status(401).json({ error: 'Token has expired.' })
  }
  // Consume the token — single-use only
  issuedTokens.delete(token)
  const sessionToken = createSessionToken()
  activeSessions.set(sessionToken, expiresAt)
  res.json({ sessionToken, expiresAt })
})

app.get('/api/verify', (req, res) => {
  const { sessionToken } = req.query
  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.json({ valid: false })
  }
  pruneExpiredSessions()
  if (!activeSessions.has(sessionToken)) {
    return res.json({ valid: false })
  }
  const expiresAt = activeSessions.get(sessionToken)
  if (expiresAt === null || expiresAt <= Date.now()) {
    activeSessions.delete(sessionToken)
    return res.json({ valid: false, expired: true })
  }
  res.json({ valid: true })
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

    res.set('Cache-Control', 'no-store').json({ media })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Cloudinary API error'

    res.status(500).json({
      error: 'Failed to fetch media list from Cloudinary.',
      detail: message,
    })
  }
})

// Serve the built frontend and handle SPA routing in production
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('/*splat', (_req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
}

app.listen(serverPort, () => {
  console.log(`Media list server running on port ${serverPort}`)
  if (existsSync(distDir)) {
    console.log(`Serving static frontend from ${distDir}`)
  }
})
