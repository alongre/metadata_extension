# Plan: Add Save to File & Load from File for JSON Editor

## Context
The JSON editor currently supports copy-to-clipboard but has no file I/O. Users want to save JSON to disk and load JSON files to replace the editor content. This is useful for sharing overrides, backing up configurations, and importing pre-prepared mock data.

## Approach
Add two buttons to the editor header (next to the existing clipboard copy button) for **Download JSON** and **Load JSON**. Since this is a Chrome extension popup, we'll use standard browser APIs (`Blob` + download link for save, `<input type="file">` for load).

## Changes

### `src/components/JsonEditor.tsx`
1. **Add `Download` and `Upload` icon imports** from `lucide-react`
2. **Add a hidden file input** (`<input type="file" accept=".json">`) ref near the top of the component
3. **Add "Save to File" button** in the header next to `ClipboardCopyButton` (line ~1136):
   - Creates a `Blob` from `JSON.stringify(editedData, null, 2)`
   - Creates a temporary `<a>` element with `URL.createObjectURL`, triggers download
   - Filename: `{endpoint}.json` (from `selectedRequest.endpoint`)
4. **Add "Load from File" button** in the header next to Save to File:
   - Clicks the hidden file input on button press
   - `onChange` handler reads the file via `FileReader`, parses JSON
   - Sets `editedData` with the parsed content, enables editing mode, marks `hasChanges = true`
   - Shows error if file is not valid JSON

### Button Placement
Header area, same row as the endpoint name and copy button — keeps file operations grouped with other data actions and separate from the bottom action bar (which handles override logic).

## Verification
1. `npm run build` — confirm no build errors
2. Load extension in Chrome, select a captured request
3. Click "Save to File" — verify a `.json` file downloads with correct content
4. Click "Load from File" — pick a JSON file, verify editor updates with file content and shows as having changes
5. Load an invalid file — verify error message appears
 