# Metadata Wizard Chrome Extension

A Chrome extension to intercept and override REST API calls to `/rest/reports-metadata` endpoints with a built-in JSON editor.

## Features

- 🔍 **Request Interception**: Automatically captures REST API calls to `/rest/reports-metadata` endpoints
- ✏️ **JSON Editor**: Built-in Monaco Editor for editing response data with syntax highlighting
- 💾 **Override System**: Save custom responses that will be returned instead of the original API response
- 📊 **Request Management**: View, organize, and delete captured requests in an intuitive sidebar
- 🎯 **Real-time Updates**: See which requests are overridden vs. live
- 📱 **Responsive UI**: Resizable sidebar and modern, clean interface

## Installation

### Development Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd metadata-wizard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the extension**

   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

### Production Build

```bash
npm run build
```

The built extension will be in the `dist` folder, ready for packaging and distribution.

## Usage

1. **Install the extension** in Chrome
2. **Navigate to a website** that makes calls to `/rest/reports-metadata` endpoints
3. **Click the Metadata Wizard icon** in the Chrome toolbar to open the extension
4. **View captured requests** in the sidebar - they'll appear automatically as they're intercepted
5. **Select a request** to view its details and response data
6. **Edit the JSON** in the Monaco Editor on the right side
7. **Click "Save Override"** to apply your changes - future requests to the same endpoint will return your custom data
8. **Clear overrides** anytime by clicking "Clear Override" to return to live data

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Code Editor**: Monaco Editor (VS Code editor)
- **Extension**: Chrome Extension Manifest V3
- **Testing**: Vitest (Unit), Playwright (E2E)

## Project Structure

```
metadata-wizard/
├── src/
│   ├── components/          # React components
│   │   ├── App.tsx         # Main application component
│   │   ├── Sidebar.tsx     # Request list sidebar
│   │   └── JsonEditor.tsx  # Monaco Editor wrapper
│   ├── utils/              # Utility functions
│   │   └── chrome.ts       # Chrome extension utilities
│   ├── background.ts       # Service Worker for request interception
│   ├── popup.tsx          # Extension popup entry point
│   ├── types.ts           # TypeScript type definitions
│   └── index.css          # Global styles
├── icons/                 # Extension icons
├── manifest.json          # Chrome extension manifest
└── dist/                  # Built extension files
```

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Hot Reload During Development

When developing, you'll need to reload the extension in Chrome after making changes:

1. Make your code changes
2. Run `npm run build`
3. Go to `chrome://extensions/`
4. Click the refresh icon on the Metadata Wizard extension
5. Test your changes

## Architecture

### Request Interception Flow

1. **Background Service Worker** listens for webRequest events
2. **Filters requests** to `/rest/reports-metadata` endpoints
3. **Stores request data** in Chrome's local storage
4. **Checks for overrides** and redirects to custom data if available
5. **Popup UI** displays captured requests and allows editing

### Storage Schema

Requests are stored in Chrome's local storage with the following structure:

```typescript
interface CapturedRequest {
	id: string; // Unique identifier
	url: string; // Full request URL
	endpoint: string; // Extracted endpoint name
	method: string; // HTTP method (GET, POST, etc.)
	timestamp: number; // Request timestamp
	requestHeaders?: object; // Request headers
	responseData?: object; // Original response data
	overrideData?: object; // Custom override data
	isOverridden: boolean; // Override status
}
```

## Permissions

The extension requires the following permissions:

- `webRequest` - To intercept and modify HTTP requests
- `storage` - To save captured requests and overrides
- `activeTab` - To interact with the current tab
- `tabs` - To access tab information
- `<all_urls>` - To intercept requests on all websites

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting

### Extension not intercepting requests

- Ensure the website is making requests to URLs containing `/rest/reports-metadata`
- Check that the extension has the necessary permissions
- Reload the extension after making changes

### JSON editor not working

- Check browser console for errors
- Ensure Monaco Editor dependencies are properly loaded
- Try refreshing the extension popup

### Overrides not applying

- Verify that the JSON is valid
- Check that the request ID matches the stored request
- Ensure the override was saved successfully (check for success message)

For more help, please open an issue on the repository.
