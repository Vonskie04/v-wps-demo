# sageee

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

Copy `.env.example` to `.env` for a new setup and fill in the server credentials.
The local `.env` is ignored by Git. Keep credential values in server-only variables;
Vite exposes variables beginning with `VITE_` to browser builds.

### Compile and Hot-Reload for Development

```sh
npm run dev
```

This now runs both:

- Vite frontend
- media-list backend server at `http://localhost:8788` with the provided environment

Vite reads `MEDIA_LIST_PORT` from `.env` for its API proxy. `API_SERVER` can override
the proxy target. Restart development processes after changing environment settings.

### Cloudinary Server-Side Media

Uploads and the gallery list go through the Express server:

- `POST /api/media-upload` uploads images/videos to Cloudinary.
- `GET /api/media-list` lists only media inside the server-managed Cloudinary folder.
- `POST /api/admin/auto-approve` accepts `{ "enabled": true }` or `{ "enabled": false }`
  with a valid admin session. The setting persists with moderation state and applies
  to new uploads. Admin media-list responses include the current `autoApprove` value.

The browser no longer uploads directly to Cloudinary or needs an upload preset.

Required environment variables (server-side):

- `CLOUDINARY_URL` (preferred), or
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

Optional environment variables:

- `CLOUDINARY_MEDIA_FOLDER` or `MEDIA_FOLDER` sets the Cloudinary folder. The provided
  environment uses `ems-sage`, matching the reference project; the code fallback is `wedding-media`.
- `CLOUDINARY_RESOURCE_CACHE_MS` sets media-list caching. Default: `0` (disabled).
- `MAX_UPLOAD_BYTES` sets the per-file upload limit. Default: `262144000` (250 MB).
- `ACCESS_TOKEN` grants a guest session for 30 minutes.
- `ADMIN_TOKEN` grants an admin session through the admin unlock endpoint.
- `MASTER_TOKEN` grants a reusable admin session without expiration.
- `MASTER_KEY` authorizes token issuance and pause/resume requests.
- `PURCHASED=FALSE` disables purchased live-feed access.
- `STORE_URL` and `STORE_TOKEN` enable remote token, session, and moderation persistence.

Compatibility fallback:

- If your project currently only has `VITE_*` Cloudinary vars, the media-list server can read those as fallback values.

Run only the media-list server:

```sh
npm run server
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
