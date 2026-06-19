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

### Compile and Hot-Reload for Development

```sh
npm run dev
```

This now runs both:

- Vite frontend
- media-list backend server at `http://localhost:8787`

### Cloudinary Server-Side Media

Uploads and the gallery list go through the Express server:

- `POST /api/media-upload` uploads images/videos to Cloudinary.
- `GET /api/media-list` lists only media inside the server-managed Cloudinary folder.

The browser no longer uploads directly to Cloudinary or needs an upload preset.

Required environment variables (server-side):

- `CLOUDINARY_URL` (preferred), or
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

Optional environment variables:

- `CLOUDINARY_MEDIA_FOLDER` or `MEDIA_FOLDER` sets the Cloudinary folder. Default: `wedding-media`.
- `MAX_UPLOAD_BYTES` sets the per-file upload limit. Default: `262144000` (250 MB).
- `MASTER_TOKEN` sets a static access token that does not need to be generated. It uses the same 30-minute session TTL as `ACCESS_TOKEN`.

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
