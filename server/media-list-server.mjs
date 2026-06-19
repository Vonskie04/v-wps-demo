import 'dotenv/config'
import express from 'express'
import { createHmac, randomBytes } from 'crypto'
import { fileURLToPath } from 'url'
import { basename, dirname, parse, join } from 'path'
import { existsSync } from 'fs'
import { v2 as cloudinary } from 'cloudinary'
const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '../dist')

const app = express()

// server/media-list-server.mjs
const serverPort = Number(process.env.PORT ?? process.env.MEDIA_LIST_PORT ?? 8787)
const configuredMediaFolder = sanitizeCloudinaryFolder(
  process.env.CLOUDINARY_MEDIA_FOLDER ?? process.env.MEDIA_FOLDER ?? 'wedding-media',
)
const MEDIA_FOLDER = configuredMediaFolder || 'wedding-media'
const configuredMaxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 250 * 1024 * 1024)
const MAX_UPLOAD_BYTES = Number.isFinite(configuredMaxUploadBytes)
  ? configuredMaxUploadBytes
  : 250 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = /^(image|video)\//

app.use(express.json())

// Allow cross-origin requests from any device (needed for multi-device access)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token, Authorization')
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

function sanitizeCloudinaryFolder(folder) {
  return String(folder)
    .split('/')
    .map((part) => part.trim().replace(/[^a-zA-Z0-9_-]/g, '-'))
    .filter(Boolean)
    .join('/')
}

function sanitizeOriginalName(name) {
  const parsed = parse(basename(name || 'upload'))
  const baseName = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-')

  return baseName || 'upload'
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

const ACCESS_TOKEN = process.env.ACCESS_TOKEN ?? process.env.MASTER_TOKEN
const MASTER_KEY = process.env.MASTER_KEY

// In-memory issued-token store: token -> { expiresAt, paused }
const issuedTokens = new Map()
const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

function pruneExpired() {
  const now = Date.now()
  for (const [t, info] of issuedTokens) {
    if (!info.paused && info.expiresAt <= now) issuedTokens.delete(t)
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

async function restoreSessionIfNeeded(sessionToken) {
  if (activeSessions.has(sessionToken)) return

  const stored = await storeGet(STORE_SESSIONS_KEY)
  if (
    stored &&
    typeof stored === 'object' &&
    Object.prototype.hasOwnProperty.call(stored, sessionToken)
  ) {
    const expiresAt = stored[sessionToken]
    if (expiresAt === null || expiresAt > Date.now()) {
      activeSessions.set(sessionToken, expiresAt)
    }
  }
}

async function isActiveSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return false

  pruneExpiredSessions()
  await restoreSessionIfNeeded(sessionToken)

  if (!activeSessions.has(sessionToken)) return false

  const expiresAt = activeSessions.get(sessionToken)
  if (expiresAt === null || expiresAt > Date.now()) return true

  activeSessions.delete(sessionToken)
  persistSessions()
  return false
}

function getSessionToken(req) {
  const headerToken = req.get('X-Session-Token')
  if (headerToken) return headerToken

  const authorization = req.get('Authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim()

  return req.query.sessionToken
}

async function requireSession(req, res) {
  const sessionToken = getSessionToken(req)
  if (await isActiveSession(sessionToken)) return true

  res.status(401).json({ error: 'A valid session is required.' })
  return false
}

setInterval(pruneExpiredSessions, 5 * 60 * 1000)

function createSessionToken() {
  return randomBytes(32).toString('hex')
}

// ── Redis (token-gen store) persistence ───────────────────────────────────────
// Set STORE_URL and STORE_TOKEN in .env to point at the token-gen store server.
// Without these the server works as before (in-memory only, no restart survival).
const STORE_BASE = process.env.STORE_URL ? process.env.STORE_URL.replace(/\/$/, '') : null
const STORE_AUTH = process.env.STORE_TOKEN ? `Bearer ${process.env.STORE_TOKEN}` : null
const STORE_ISSUED_KEY = 'wed_issued_tokens'
const STORE_SESSIONS_KEY = 'wed_active_sessions'

async function storeGet(key) {
  if (!STORE_BASE || !STORE_AUTH) return null
  try {
    const res = await fetch(`${STORE_BASE}/api/store/${encodeURIComponent(key)}`, {
      headers: { Authorization: STORE_AUTH },
    })
    if (!res.ok) return null
    return (await res.json()).value ?? null
  } catch {
    return null
  }
}

async function storeSet(key, value) {
  if (!STORE_BASE || !STORE_AUTH) return
  try {
    await fetch(`${STORE_BASE}/api/store/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { Authorization: STORE_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  } catch {
    /* best-effort */
  }
}

function persistIssuedTokens() {
  const obj = {}
  for (const [t, info] of issuedTokens) obj[t] = info
  storeSet(STORE_ISSUED_KEY, obj)
}

function persistSessions() {
  const obj = {}
  for (const [t, exp] of activeSessions) obj[t] = exp
  storeSet(STORE_SESSIONS_KEY, obj)
}

async function loadPersistedState() {
  const [tokens, sessions] = await Promise.all([
    storeGet(STORE_ISSUED_KEY),
    storeGet(STORE_SESSIONS_KEY),
  ])
  const now = Date.now()
  if (tokens && typeof tokens === 'object') {
    for (const [t, info] of Object.entries(tokens)) {
      if (info.paused || info.expiresAt > now) issuedTokens.set(t, info)
    }
  }
  if (sessions && typeof sessions === 'object') {
    for (const [t, exp] of Object.entries(sessions)) {
      if (exp === null || exp > now) activeSessions.set(t, exp)
    }
  }
  if (tokens || sessions) console.log('Restored persisted tokens and sessions from store.')
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
  issuedTokens.set(token, { expiresAt, paused: false })
  persistIssuedTokens()
  res.json({ ok: true, expiresAt })
})

app.post('/api/pause-token', (req, res) => {
  if (!MASTER_KEY) {
    return res.status(500).json({ error: 'Not configured.' })
  }
  const { token, masterKey, paused } = req.body ?? {}
  if (!masterKey || masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid token.' })
  }
  const info = issuedTokens.get(token)
  if (!info) {
    return res.status(404).json({ error: 'Token not found.' })
  }
  if (paused && !info.paused) {
    // Pause: store remaining ms instead of absolute expiry
    info.remainingMs = info.expiresAt - Date.now()
    info.paused = true
  } else if (!paused && info.paused) {
    // Resume: recalculate expiresAt from remaining ms
    info.expiresAt = Date.now() + (info.remainingMs ?? 0)
    delete info.remainingMs
    info.paused = false
  }
  persistIssuedTokens()
  res.json({ ok: true })
})

app.post('/api/unlock', (req, res) => {
  const { token } = req.body ?? {}
  if (!token) {
    return res.status(401).json({ error: 'Incorrect token.' })
  }
  // Static ACCESS_TOKEN / MASTER_TOKEN from env — use default TTL
  if (ACCESS_TOKEN && token === ACCESS_TOKEN) {
    const sessionToken = createSessionToken()
    const expiresAt = Date.now() + TOKEN_TTL_MS
    activeSessions.set(sessionToken, expiresAt)
    persistSessions()
    return res.json({ sessionToken, expiresAt })
  }
  // Issued token with TTL
  pruneExpired()
  const info = issuedTokens.get(token)
  if (!info) {
    return res.status(401).json({ error: 'Incorrect token.' })
  }
  if (info.paused) {
    return res.status(403).json({ error: 'Token is paused.' })
  }
  if (info.expiresAt <= Date.now()) {
    issuedTokens.delete(token)
    return res.status(401).json({ error: 'Token has expired.' })
  }
  const sessionToken = createSessionToken()
  activeSessions.set(sessionToken, info.expiresAt)
  persistSessions()
  res.json({ sessionToken, expiresAt: info.expiresAt })
})

app.get('/api/verify', async (req, res) => {
  const { sessionToken } = req.query
  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.json({ valid: false })
  }

  res.json({ valid: await isActiveSession(sessionToken) })
})

function headersFromRequest(req) {
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else if (value !== undefined) {
      headers.set(key, value)
    }
  }

  return headers
}

async function parseMultipartRequest(req) {
  const request = new Request(`http://localhost${req.originalUrl}`, {
    method: req.method,
    headers: headersFromRequest(req),
    body: req,
    duplex: 'half',
  })

  return request.formData()
}

function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error)
      else resolve(result)
    })

    stream.end(buffer)
  })
}

app.post('/api/media-upload', async (req, res) => {
  if (!(await requireSession(req, res))) return

  const contentType = req.get('Content-Type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return res.status(415).json({ error: 'Expected multipart/form-data upload.' })
  }

  try {
    const form = await parseMultipartRequest(req)
    const uploadedFile = form.get('file')

    if (!(uploadedFile instanceof File)) {
      return res.status(400).json({ error: 'Missing file upload.' })
    }

    if (!ALLOWED_MEDIA_TYPES.test(uploadedFile.type)) {
      return res.status(400).json({ error: 'Only image and video files are allowed.' })
    }

    if (uploadedFile.size > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'File is too large.' })
    }

    const resourceType = uploadedFile.type.startsWith('image/') ? 'image' : 'video'
    const bytes = Buffer.from(await uploadedFile.arrayBuffer())
    const uploadResult = await uploadBufferToCloudinary(bytes, {
      resource_type: resourceType,
      folder: MEDIA_FOLDER,
      use_filename: true,
      unique_filename: true,
      public_id: sanitizeOriginalName(uploadedFile.name),
      overwrite: false,
      context: {
        uploaded_via: 'media-list-server',
      },
    })

    res.status(201).json({
      media: normalizeMediaItem(uploadResult, resourceType),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error'

    res.status(500).json({
      error: 'Failed to upload media.',
      detail: message,
    })
  }
})

app.get('/api/media-list', async (req, res) => {
  if (!(await requireSession(req, res))) return

  const requestedMax = Number(req.query.max ?? 100)
  const maxResults = Number.isFinite(requestedMax)
    ? Math.min(Math.max(Math.trunc(requestedMax), 1), 500)
    : 100

  try {
    const [images, videos] = await Promise.all([
      cloudinary.api.resources({
        type: 'upload',
        resource_type: 'image',
        prefix: `${MEDIA_FOLDER}/`,
        max_results: maxResults,
      }),
      cloudinary.api.resources({
        type: 'upload',
        resource_type: 'video',
        prefix: `${MEDIA_FOLDER}/`,
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

loadPersistedState().then(() => {
  app.listen(serverPort, () => {
    console.log(`Media list server running on port ${serverPort}`)
    if (existsSync(distDir)) {
      console.log(`Serving static frontend from ${distDir}`)
    }
  })
})
