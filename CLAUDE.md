# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Metadata Wizard is a Chrome Extension (Manifest V3) that intercepts and overrides REST API calls with a built-in JSON editor. It allows users to capture API responses, edit them, and redirect future requests to use the modified data.

**Tech Stack**: React 18 + TypeScript, Vite, Tailwind CSS, CodeMirror 6 (JSON editor)

## Common Commands

```bash
# Build for production (creates dist/ folder ready for Chrome)
npm run build

# Build without post-processing (faster for dev iteration, skips copying static files)
npm run build:dev

# Type checking
npm run type-check

# Linting
npm run lint

# Run unit tests (vitest)
npm test

# Run E2E tests (playwright)
npm run test:e2e
```

After building, load in Chrome: `chrome://extensions/` → Developer mode → Load unpacked → select `dist/`. After code changes, `npm run build` then click refresh on the extension card.

## Architecture

### Extension Components & Data Flow

The extension has four execution contexts that communicate via message passing:

1. **Background Service Worker** (`src/background.ts`) — The central hub. Listens to `chrome.webRequest` events for all tabs, stores captured requests in `chrome.storage.local`, manages URL patterns, and applies overrides via DNR (Declarative Net Request) redirect rules to data URLs.

2. **Content Script** (`src/content.ts`) — Bridge between page and background. Injects `pageInterceptor.js` into page context, relays captured responses to background via `chrome.runtime.sendMessage`. Caches URL patterns for 5 seconds to reduce messaging.

3. **Page Interceptor** (`src/pageInterceptor.js`) — Plain JS that runs in page context (not content script context). Monkey-patches `fetch()` and `XMLHttpRequest` to capture response bodies, which the webRequest API cannot access in MV3. Posts data to content script via `window.postMessage`.

4. **Content Script Loader** (`src/content-script.js`) — Plain JS entry point declared in manifest.json's `content_scripts`. Separate from the Vite-bundled `content.ts`.

5. **React UI** (`src/components/`) — Popup window (not browser action popup) with resizable sidebar, CodeMirror JSON editor, and settings panel.

### Request Flow

1. Background worker detects request matching URL pattern
2. `generateRequestId(url)` normalizes URL (removes trailing slash) to create ID
3. Request saved to `chrome.storage.local.capturedRequests[id]`
4. Page interceptor captures response body → content script → background worker
5. When user saves override, DNR rule redirects matching requests to a data URL containing the override payload
6. Overrides persist across sessions via `activeOverrides` and `overrideRuleIds` storage keys

### Key Implementation Details

- **Request ID = normalized URL**: Multiple requests to the same URL (different query params) share one ID. Overrides apply to all matching origin+pathname combinations.
- **DNR rule IDs**: Deterministic hashes of URL key (`ruleIdFromKey`), kept within 0-2 billion range. Regex filters escape special chars and match query string variations.
- **Storage locking**: Background worker uses `acquireLock`/`releaseLock` with a queue to prevent race conditions on concurrent storage writes.
- **Pattern matching**: Background uses string `.includes()` check. Content script caches patterns for 5 seconds, synced via `PATTERNS_UPDATED` messages.
- **Popup lifecycle**: Single popup window tracked by `popupWindowId`. Extension icon click focuses existing or creates new window.

### Storage Schema (`chrome.storage.local`)

- `capturedRequests`: `Record<string, CapturedRequest>` — All captured requests indexed by normalized URL
- `persistentUrlPatterns`: `WizardURLPattern[]` — User-configured URL patterns to intercept
- `activeOverrides`: `Record<string, any>` — Currently active override payloads
- `overrideRuleIds`: `Record<string, number>` — Maps URLs to DNR rule IDs

See `src/types.ts` for `CapturedRequest`, `WizardURLPattern`, and `BackgroundMessage` type definitions.

### Build System

- Vite bundles three entry points: `popup.tsx`, `background.ts`, `content.ts` → output as `popup.js`, `background.js`, `content.js` (no hashes for manifest stability)
- `scripts/build-extension.js` post-build copies static files to `dist/`: `manifest.json`, `popup.html`, `content-script.js`, `pageInterceptor.js`, icons
- Path alias: `@` → `src/`

### Code Style

- Functional programming patterns; avoid classes
- Types defined in `src/types.ts`; message types use discriminated unions on `type` field
- Follow Manifest V3 specifications (service worker background, `chrome.declarativeNetRequest` for request modification, Promises for async)
