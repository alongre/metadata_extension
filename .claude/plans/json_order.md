# Preserve JSON Key Order (Match Chrome Network Response Tab)

## Context
JSON keys displayed in the extension sometimes appear in a different order than the original HTTP response (Chrome Network > Response tab). The current code has key-order preservation logic, but it has two critical gaps:

1. **Only top-level keys are ordered** — `getOrderedEntries()` extracts key order only at depth 1 of the original JSON text. Nested objects fall back to `JSON.stringify(value)`, which uses JS engine key ordering (insertion order, but numeric keys first).
2. **Several code paths use plain `JSON.stringify()` instead of `stringifyWithOrder()`**, losing key order for clear-changes, save-to-file, and clipboard copy.

The fix needs `stringifyWithOrder` to recursively preserve key order at all nesting levels, using the raw response text (`responseDataRaw`) as the source of truth.

## Files to Modify

- **`src/components/JsonEditor.tsx`** — Main changes (key ordering logic + fix call sites)

## Changes

### 1. Make `getOrderedEntries()` work for nested objects (not just root level)
Currently the function manually parses the `originalResponseText` to find top-level key order. For nested objects, it falls back to `Object.entries()`.

**Change**: Accept a `path` parameter so it can extract key order for any nested object by navigating to the correct position in the reference JSON text. Alternatively, parse the entire reference text once into an ordered key map (a recursive structure like `Map<string, OrderedKeyMap>`) and look up any path.

**Recommended approach**: Parse the raw response text once into a `keyOrderMap` that maps JSON paths to their key ordering. Store this in a `useRef` and rebuild it whenever `originalResponseText` changes. Then `getOrderedEntries(obj, path)` simply looks up the path in the map.

### 2. Make `stringifyWithOrder()` recursive
Currently it orders root-level keys but calls `JSON.stringify(value, null, indent)` for nested values.

**Change**: When a value is a non-array object, recursively call `stringifyWithOrder()` with the correct path context, applying proper indentation at each level.

### 3. Fix call sites that bypass `stringifyWithOrder()`

| Line | Current Code | Fix |
|------|-------------|-----|
| ~1194 | `handleClearChanges`: `JSON.stringify(jsonData, null, 2)` | Use `stringifyWithOrder(jsonData, 2)` |
| ~1235 | `handleSaveToFile`: `JSON.stringify(editedData, null, 2)` | Use `stringifyWithOrder(editedData, 2)` |
| ~1463 | `ClipboardCopyButton`: `JSON.stringify(editedData, null, 2)` | Use `stringifyWithOrder(editedData, 2)` |

### 4. Ensure key order survives reload
`responseDataRaw` is already persisted to `chrome.storage.local` (confirmed in `background.ts` RESPONSE_CAPTURED handler, line 674-677). On reload, `originalResponseText` is set from `selectedRequest.responseDataRaw` (line 1093-1095). **This already works** — no changes needed for persistence, as long as the `keyOrderMap` is rebuilt from `originalResponseText` each time a request is selected.

## Implementation Detail: Key Order Map

```typescript
// Build once per originalResponseText change
type KeyOrderMap = { keys: string[]; children: Record<string, KeyOrderMap> };

function buildKeyOrderMap(jsonText: string): KeyOrderMap {
  // Parse the JSON text manually (or use JSON.parse with a reviver
  // that tracks key insertion order — but reviver doesn't help here)
  // Walk the text character by character, tracking depth and building
  // nested key order arrays
}
```

The existing character-walking logic in `getOrderedEntries()` will be extracted and generalized to build a recursive map.

## Verification
1. `npm run build` — confirm no build errors
2. Load extension in Chrome, navigate to a page with API calls
3. Compare key order in the extension's JSON editor vs Chrome DevTools Network > Response tab — should match exactly at all nesting levels
4. Save an override, close and reopen the extension popup — key order should be preserved
5. Test "Clear Changes", "Save to File", and "Copy to Clipboard" — all should maintain original key order
