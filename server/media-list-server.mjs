import express from 'express'
import { createHmac, randomBytes } from 'crypto'
import { fileURLToPath } from 'url'
import { basename, dirname, parse, join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { config as loadEnv, parse as parseEnv } from 'dotenv'
import { v2 as cloudinary } from 'cloudinary'
const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '../dist')
const envFile = join(__dirname, '../.env')

loadEnv({ path: envFile })

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
const configuredResourceCacheMs = Number(process.env.CLOUDINARY_RESOURCE_CACHE_MS ?? 60_000)
const CLOUDINARY_RESOURCE_CACHE_MS = Number.isFinite(configuredResourceCacheMs)
  ? Math.max(Math.trunc(configuredResourceCacheMs), 0)
  : 60_000
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

function envToken(name) {
  return process.env[name]?.trim() || ''
}

function getCloudinaryErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const cloudinaryError = error.error
    if (
      cloudinaryError &&
      typeof cloudinaryError === 'object' &&
      typeof cloudinaryError.message === 'string'
    ) {
      return cloudinaryError.message
    }
  }

  return 'Unknown Cloudinary API error'
}

const ACCESS_TOKEN = envToken('ACCESS_TOKEN')
const ADMIN_TOKEN = envToken('ADMIN_TOKEN')
const MASTER_TOKEN = envToken('MASTER_TOKEN')
const MASTER_KEY = envToken('MASTER_KEY')

function envFileToken(name) {
  try {
    if (!existsSync(envFile)) return envToken(name)
    return String(parseEnv(readFileSync(envFile))[name] ?? envToken(name)).trim()
  } catch {
    return envToken(name)
  }
}

function isLiveFeedPurchased() {
  return envFileToken('PURCHASED').toLowerCase() !== 'false'
}

// In-memory issued-token store: token -> { expiresAt, paused }
const issuedTokens = new Map()
const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

function pruneExpired() {
  const now = Date.now()
  for (const [t, info] of issuedTokens) {
    if (!info.paused && info.expiresAt <= now) issuedTokens.delete(t)
  }
}

// In-memory active session store: sessionToken -> { expiresAt, isAdmin }
const activeSessions = new Map()

function normalizeSessionInfo(info) {
  if (info === null || typeof info === 'number') {
    return { expiresAt: info, isAdmin: false }
  }

  if (info && typeof info === 'object') {
    return {
      expiresAt:
        info.expiresAt === null || typeof info.expiresAt === 'number' ? info.expiresAt : null,
      isAdmin: Boolean(info.isAdmin),
    }
  }

  return { expiresAt: null, isAdmin: false }
}

function pruneExpiredSessions() {
  const now = Date.now()
  for (const [t, info] of activeSessions) {
    const session = normalizeSessionInfo(info)
    if (session.expiresAt !== null && session.expiresAt <= now) activeSessions.delete(t)
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
    const session = normalizeSessionInfo(stored[sessionToken])
    if (session.expiresAt === null || session.expiresAt > Date.now()) {
      activeSessions.set(sessionToken, session)
    }
  }
}

async function getActiveSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return false

  pruneExpiredSessions()
  await restoreSessionIfNeeded(sessionToken)

  if (!activeSessions.has(sessionToken)) return false

  const session = normalizeSessionInfo(activeSessions.get(sessionToken))
  if (session.expiresAt === null || session.expiresAt > Date.now()) return session

  activeSessions.delete(sessionToken)
  persistSessions()
  return false
}

async function isActiveSession(sessionToken) {
  return Boolean(await getActiveSession(sessionToken))
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

async function requireAdminSession(req, res) {
  const sessionToken = getSessionToken(req)
  const session = await getActiveSession(sessionToken)
  if (session && session.isAdmin) return true

  res.status(401).json({ error: 'A valid admin session is required.' })
  return false
}

setInterval(pruneExpiredSessions, 5 * 60 * 1000)

function createSessionToken() {
  return randomBytes(32).toString('hex')
}

function isMasterUnlockToken(token) {
  const submittedToken = typeof token === 'string' ? token.trim() : ''
  return Boolean(submittedToken && submittedToken === MASTER_TOKEN)
}

function isAdminUnlockToken(token) {
  const submittedToken = typeof token === 'string' ? token.trim() : ''
  return Boolean(submittedToken && (submittedToken === ADMIN_TOKEN || submittedToken === MASTER_TOKEN))
}

// ── Redis (token-gen store) persistence ───────────────────────────────────────
// Set STORE_URL and STORE_TOKEN in .env to point at the token-gen store server.
// Without these the server works as before (in-memory only, no restart survival).
const STORE_BASE = process.env.STORE_URL ? process.env.STORE_URL.replace(/\/$/, '') : null
const STORE_AUTH = process.env.STORE_TOKEN ? `Bearer ${process.env.STORE_TOKEN}` : null
const STORE_ISSUED_KEY = 'wed_issued_tokens'
const STORE_SESSIONS_KEY = 'wed_active_sessions'
const STORE_MODERATION_KEY = 'wed_media_moderation'
const MODERATION_FILE = join(__dirname, '.media-moderation.json')

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
  for (const [t, info] of activeSessions) obj[t] = normalizeSessionInfo(info)
  storeSet(STORE_SESSIONS_KEY, obj)
}

const mediaModeration = new Map()
const cloudinaryResourceCache = new Map()

function normalizeModerationInfo(info) {
  const status =
    info && typeof info === 'object' && ['pending', 'approved', 'rejected'].includes(info.status)
      ? info.status
      : 'approved'

  return {
    status,
    updatedAt:
      info && typeof info === 'object' && typeof info.updatedAt === 'string'
        ? info.updatedAt
        : new Date().toISOString(),
  }
}

function readLocalModeration() {
  try {
    if (!existsSync(MODERATION_FILE)) return null
    return JSON.parse(readFileSync(MODERATION_FILE, 'utf8'))
  } catch {
    return null
  }
}

function writeLocalModeration(value) {
  if (STORE_BASE && STORE_AUTH) return
  try {
    writeFileSync(MODERATION_FILE, JSON.stringify(value, null, 2))
  } catch {
    /* best-effort */
  }
}

function getMediaStatus(id) {
  return mediaModeration.get(id)?.status ?? 'approved'
}

function setMediaStatus(id, status) {
  mediaModeration.set(id, { status, updatedAt: new Date().toISOString() })
  persistMediaModeration()
}

function deleteMediaStatus(id) {
  mediaModeration.delete(id)
  persistMediaModeration()
}

function persistMediaModeration() {
  const obj = {}
  for (const [id, info] of mediaModeration) obj[id] = normalizeModerationInfo(info)
  writeLocalModeration(obj)
  storeSet(STORE_MODERATION_KEY, obj)
}

function clearCloudinaryResourceCache() {
  cloudinaryResourceCache.clear()
}

async function getCloudinaryResources(maxResults) {
  const cacheKey = String(maxResults)
  const cached = cloudinaryResourceCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.updatedAt < CLOUDINARY_RESOURCE_CACHE_MS) {
    return cached.resources
  }

  try {
    const resources = await Promise.all([
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

    cloudinaryResourceCache.set(cacheKey, { resources, updatedAt: now })
    return resources
  } catch (error) {
    if (cached) return cached.resources
    throw error
  }
}

async function loadPersistedState() {
  const [tokens, sessions, moderation] = await Promise.all([
    storeGet(STORE_ISSUED_KEY),
    storeGet(STORE_SESSIONS_KEY),
    STORE_BASE && STORE_AUTH ? storeGet(STORE_MODERATION_KEY) : readLocalModeration(),
  ])
  const now = Date.now()
  if (tokens && typeof tokens === 'object') {
    for (const [t, info] of Object.entries(tokens)) {
      if (info.paused || info.expiresAt > now) issuedTokens.set(t, info)
    }
  }
  if (sessions && typeof sessions === 'object') {
    for (const [t, rawSession] of Object.entries(sessions)) {
      const session = normalizeSessionInfo(rawSession)
      if (session.expiresAt === null || session.expiresAt > now) activeSessions.set(t, session)
    }
  }
  if (moderation && typeof moderation === 'object') {
    for (const [id, rawInfo] of Object.entries(moderation)) {
      mediaModeration.set(id, normalizeModerationInfo(rawInfo))
    }
  }
  if (tokens || sessions || moderation) console.log('Restored persisted tokens, sessions, and moderation state from store.')
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/live-feed-access', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ purchased: isLiveFeedPurchased() })
})

app.post('/api/issue-token', (req, res) => {
  if (!MASTER_KEY) {
    return res.status(500).json({ error: 'Token issuance not configured on server.' })
  }
  const { token, masterKey, ttlMinutes } = req.body ?? {}
  if (!masterKey || String(masterKey).trim() !== MASTER_KEY) {
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
  if (!masterKey || String(masterKey).trim() !== MASTER_KEY) {
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
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  if (!token) {
    return res.status(401).json({ error: 'Incorrect token.' })
  }
  if (isMasterUnlockToken(token)) {
    const sessionToken = createSessionToken()
    activeSessions.set(sessionToken, { expiresAt: null, isAdmin: true })
    persistSessions()
    return res.json({ sessionToken, expiresAt: null, isAdmin: true })
  }
  // Static ACCESS_TOKEN from env uses the default TTL.
  if (ACCESS_TOKEN && token === ACCESS_TOKEN) {
    const sessionToken = createSessionToken()
    const expiresAt = Date.now() + TOKEN_TTL_MS
    activeSessions.set(sessionToken, { expiresAt, isAdmin: false })
    persistSessions()
    return res.json({ sessionToken, expiresAt, isAdmin: false })
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
  activeSessions.set(sessionToken, { expiresAt: info.expiresAt, isAdmin: false })
  persistSessions()
  res.json({ sessionToken, expiresAt: info.expiresAt, isAdmin: false })
})

app.post('/api/admin/unlock', (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  if (!token || !isAdminUnlockToken(token)) {
    return res.status(401).json({ error: 'Incorrect admin token.' })
  }

  const sessionToken = createSessionToken()
  activeSessions.set(sessionToken, { expiresAt: null, isAdmin: true })
  persistSessions()
  res.json({ sessionToken, expiresAt: null, isAdmin: true })
})

app.get('/api/verify', async (req, res) => {
  const { sessionToken } = req.query
  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.json({ valid: false })
  }

  res.json({ valid: await isActiveSession(sessionToken) })
})

app.get('/api/admin/verify', async (req, res) => {
  const { sessionToken } = req.query
  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.json({ valid: false })
  }

  const session = await getActiveSession(sessionToken)
  res.json({ valid: Boolean(session && session.isAdmin) })
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
    setMediaStatus(uploadResult.public_id, 'pending')
    clearCloudinaryResourceCache()

    res.status(201).json({
      media: { ...normalizeMediaItem(uploadResult, resourceType), status: 'pending' },
    })
  } catch (error) {
    const message = getCloudinaryErrorMessage(error)

    res.status(500).json({
      error: 'Failed to upload media.',
      detail: message,
    })
  }
})

async function sendMediaList(req, res, options = {}) {
  const includeModeration = Boolean(options.includeModeration)
  const includeRejected = Boolean(options.includeRejected)
  const onlyApproved = Boolean(options.onlyApproved)
  const requestedMax = Number(req.query.max ?? 100)
  const maxResults = Number.isFinite(requestedMax)
    ? Math.min(Math.max(Math.trunc(requestedMax), 1), 500)
    : 100

  try {
    const [images, videos] = await getCloudinaryResources(maxResults)

    const media = [
      ...images.resources.map((item) => normalizeMediaItem(item, 'image')),
      ...videos.resources.map((item) => normalizeMediaItem(item, 'video')),
    ]
      .map((item) => ({ ...item, status: getMediaStatus(item.id) }))
      .filter((item) => {
        if (onlyApproved) return item.status === 'approved'
        if (!includeRejected) return item.status !== 'rejected'
        return true
      })
      .map((item) => {
        if (includeModeration) return item
        const { status: _status, ...publicItem } = item
        return publicItem
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.set('Cache-Control', 'no-store').json({ media })
  } catch (error) {
    const message = getCloudinaryErrorMessage(error)

    res.status(500).json({
      error: 'Failed to fetch media list from Cloudinary.',
      detail: message,
    })
  }
}

app.get('/api/media-list', async (req, res) => {
  if (!(await requireSession(req, res))) return
  await sendMediaList(req, res, { onlyApproved: true })
})

app.get('/api/admin/media-list', async (req, res) => {
  if (!(await requireAdminSession(req, res))) return
  await sendMediaList(req, res, { includeModeration: true, includeRejected: true })
})

app.post('/api/admin/media-moderation', async (req, res) => {
  if (!(await requireAdminSession(req, res))) return

  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : ''
  const action = typeof req.body?.action === 'string' ? req.body.action.trim() : ''

  if (!id) {
    return res.status(400).json({ error: 'Media id is required.' })
  }

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'Action must be approve or reject.' })
  }

  try {
    if (action === 'reject') {
      setMediaStatus(id, 'rejected')
      return res.json({ ok: true, status: 'rejected' })
    }

    setMediaStatus(id, 'approved')
    return res.json({ ok: true, status: 'approved' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown moderation error'

    res.status(500).json({
      error: 'Failed to update media moderation status.',
      detail: message,
    })
  }
})

app.post('/api/admin/media-delete', async (req, res) => {
  if (!(await requireAdminSession(req, res))) return

  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : ''
  const type = typeof req.body?.type === 'string' ? req.body.type.trim() : ''

  if (!id) {
    return res.status(400).json({ error: 'Media id is required.' })
  }

  if (type !== 'image' && type !== 'video') {
    return res.status(400).json({ error: 'Media type must be image or video.' })
  }

  if (getMediaStatus(id) !== 'rejected') {
    return res.status(409).json({ error: 'Only rejected media can be deleted.' })
  }

  try {
    const result = await cloudinary.uploader.destroy(id, {
      resource_type: type,
      invalidate: true,
    })

    if (result.result !== 'ok' && result.result !== 'not found') {
      return res.status(502).json({
        error: 'Cloudinary did not delete the media.',
        detail: result.result,
      })
    }

    deleteMediaStatus(id)
    clearCloudinaryResourceCache()
    res.json({ ok: true })
  } catch (error) {
    const message = getCloudinaryErrorMessage(error)

    res.status(500).json({
      error: 'Failed to delete media.',
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
