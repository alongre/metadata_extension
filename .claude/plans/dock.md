# Plan: Add Dock/Undock Mode for Extension Popup

## Context
Currently the extension always opens as a standalone popup window (`chrome.windows.create` with `type: 'popup'`). The user wants the **default** behavior to be a standard action popup (small dropdown attached to the extension icon), with a menu option to switch between docked (action popup) and undocked (standalone window) modes.

## Approach

### 1. Add `default_popup` to manifest.json
- Set `"action": { "default_popup": "popup.html" }` so the popup opens as a standard dropdown by default
- This replaces the current empty `"action": {}`

**File:** `manifest.json`

### 2. Track display mode in storage
- Store a `displayMode` value (`"docked"` | `"undocked"`) in `chrome.storage.local`
- Default to `"docked"`

### 3. Modify background.ts popup logic
- Remove the `chrome.action.onClicked` listener (it won't fire when `default_popup` is set)
- Add a new message type `TOGGLE_DISPLAY_MODE` that the popup UI can send
- When switching to undocked: remove the `default_popup` via `chrome.action.setPopup({ popup: '' })`, then open a standalone window with `chrome.windows.create`
- When switching to docked: set `chrome.action.setPopup({ popup: 'popup.html' })`, close the standalone window if open
- On startup, read `displayMode` from storage and configure `chrome.action.setPopup` accordingly. If undocked, register the `chrome.action.onClicked` listener

**File:** `src/background.ts`

### 4. Add message type to types.ts
- Add `{ type: 'TOGGLE_DISPLAY_MODE' }` and `{ type: 'GET_DISPLAY_MODE' }` to `BackgroundMessage` union

**File:** `src/types.ts`

### 5. Add dock/undock button to Sidebar header
- Add a new button in the Sidebar header (next to Settings/Clear/Refresh buttons)
- Use an appropriate icon from lucide-react (e.g., `Maximize2` for undock, `Minimize2` for dock, or `PanelTop`/`ExternalLink`)
- The button sends a `TOGGLE_DISPLAY_MODE` message to the background script
- When in docked mode, clicking "undock" will: send the message, and the background will open a standalone window (the action popup will close automatically)
- When in undocked mode, clicking "dock" will: send the message, the background will set the default_popup back, and close the current window

**File:** `src/components/Sidebar.tsx`

### 6. Pass display mode to Sidebar
- In App.tsx, fetch the current display mode on mount via `GET_DISPLAY_MODE` message
- Pass it down to Sidebar as a prop so the button shows the correct icon/tooltip

**File:** `src/components/App.tsx`

### 7. Adjust popup.html / CSS for docked mode
- The action popup has a fixed max size (~800x600 but typically smaller). Set a reasonable default size via CSS (e.g., `width: 780px; height: 580px` on body/root) so the popup is large enough to be usable
- The current `100%` sizing will work, but we need explicit dimensions for the action popup since it sizes to content

**File:** `popup.html`

## Files to Modify
1. `manifest.json` — add `default_popup`
2. `src/types.ts` — add new message types
3. `src/background.ts` — handle mode switching, startup config
4. `src/components/App.tsx` — fetch and pass display mode
5. `src/components/Sidebar.tsx` — add dock/undock button
6. `popup.html` — set explicit dimensions for docked mode

## Verification
1. `npm run build` — ensure clean build
2. Load extension in Chrome, click icon — should open as action popup (docked, default)
3. Click undock button — popup closes, standalone window opens
4. Click extension icon again — standalone window focuses
5. Click dock button in standalone window — window closes, next icon click opens action popup
6. Reload extension — mode persists from storage
