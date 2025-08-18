# Project Instructions Template

## Project Overview

### Project Name

Metadata Wizard

### Description

Chrome extension to intercept and override REST API calls to with /rest/reports-metadata endpoints using chrom webrequest. This extension allows users to capture, inspect, and override API responses with json editor.

### Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Testing**: vitest (Unit), Playwright (E2E)
- **Code Editor**: Monaco Editor
- **Extension**: Chrome Extension Manifest V3

---

## 🚀 Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn package manager
- Chrome browser for testing

## UI Guidelines

- The extension should be constructed from sidebar and main window to edit/Format JSON File
- Each item in the side bar should show as title the endpoint name(only suffix) and as sub title show the full url with the request time
- Each item in the sidebar should show tooltip
- Each item in the side bar can be deleted with delete icon
- The side bar should be resizeable, the default width should start from 200px
- The icon of the extension should be of wizard with metadata
- After making changes in The json editor window, we can click save, and it will override in the chrome overrides
