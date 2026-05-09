# duo plans — Claude notes

## Framework override gotcha (read this before touching HTML, meta tags, or static assets)

This app uses **Expo Router with React Native Web**, which generates its own HTML shell at build time. This means:

**If you edit a "standard" web file and the change doesn't show up, the framework is probably overriding it.**

### The two confirmed cases

1. **Viewport meta tag (iOS zoom prevention)**
   - Editing `public/index.html` alone was not enough — Expo's build replaces the HTML with output from `app/+html.tsx`.
   - The fix lived in **`app/+html.tsx`** (the Expo HTML template), not `public/index.html`.
   - Always edit `app/+html.tsx` for `<head>` changes, and mirror to `public/index.html` as a fallback for local dev.

2. **Favicon / manifest**
   - Same issue — `public/index.html` is not the file Expo serves in production.
   - `<link>` tags for favicon, manifest, OG tags, etc. must go in **`app/+html.tsx`**.
   - `public/manifest.json` is served as a static file and is fine, but the `<link rel="manifest">` tag referencing it must be in `app/+html.tsx`.

### Rule of thumb for this project

Before making any change to HTML `<head>` content, static file references, or meta tags:
1. Check **`app/+html.tsx`** first — this is what Expo actually uses for the production build.
2. Make the change there, then mirror it to `public/index.html` so local dev stays consistent.
3. If a change isn't showing up after deploy, suspect a framework override before anything else.

### Files that matter for web shell config

| What you want to change | File to edit |
|---|---|
| `<head>` meta tags, viewport, favicon links | `app/+html.tsx` |
| PWA manifest content | `public/manifest.json` |
| Global CSS reset | `app/+html.tsx` (via `<style>`) |
| Vercel routing / rewrites | `vercel.json` |
| App name, icons, splash (native + web) | `app.json` |
