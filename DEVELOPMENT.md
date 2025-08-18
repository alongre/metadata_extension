# Metadata Wizard - Development Guide

## 🚀 Quick Start

### Installation & Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Build the extension**

   ```bash
   npm run build
   ```

3. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder
   - The Metadata Wizard icon should appear in your toolbar

## 🔧 Development Workflow

### During Development

1. **Make code changes** in the `src/` directory
2. **Rebuild the extension**
   ```bash
   npm run build
   ```
3. **Reload the extension** in Chrome (click the refresh icon on the extension card)
4. **Test your changes** by clicking the extension icon

### Available Scripts

- `npm run dev` - Start Vite development server (for component development)
- `npm run build` - Full production build with extension packaging
- `npm run build:dev` - Development build without packaging
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🏗️ Architecture Overview

### Core Components

1. **Background Service Worker** (`src/background.ts`)

   - Intercepts webRequest events for `/rest/reports-metadata` endpoints
   - Manages request storage in Chrome's local storage
   - Handles message passing between popup and background

2. **Popup Interface** (`src/components/`)

   - `App.tsx` - Main application container with resizable layout
   - `Sidebar.tsx` - Request list with filtering and management
   - `JsonEditor.tsx` - Monaco Editor integration for JSON editing

3. **Chrome Extension APIs** (`src/utils/chrome.ts`)
   - Wrapper functions for Chrome API calls
   - Message passing utilities
   - Storage management helpers

### Request Flow

1. **Interception**: Background worker captures requests to target endpoints
2. **Storage**: Request metadata is stored in Chrome's local storage
3. **Display**: Popup loads and displays captured requests in sidebar
4. **Editing**: User selects request and edits JSON in Monaco Editor
5. **Override**: Modified data is saved and future requests are redirected

### Storage Schema

```typescript
interface CapturedRequest {
	id: string; // Unique identifier
	url: string; // Full request URL
	endpoint: string; // Extracted endpoint name
	method: string; // HTTP method
	timestamp: number; // When captured
	requestHeaders?: object; // Request headers
	responseData?: object; // Original response
	overrideData?: object; // Custom override
	isOverridden: boolean; // Override status
}
```

## 🔍 Debugging

### Extension Debugging

1. **Background Script Logs**

   - Open `chrome://extensions/`
   - Click "service worker" next to Metadata Wizard
   - Check console for background script logs

2. **Popup Debugging**

   - Right-click the extension icon
   - Select "Inspect popup"
   - Use Chrome DevTools as normal

3. **Request Interception Issues**
   - Check that target URLs contain `/rest/reports-metadata`
   - Verify extension has necessary permissions
   - Check background script console for errors

### Common Issues

1. **Extension not loading**

   - Check `manifest.json` syntax
   - Verify all required files exist in `dist/`
   - Check Chrome DevTools for errors

2. **Requests not being captured**

   - Ensure target endpoints match the filter pattern
   - Check that webRequest permissions are granted
   - Verify background script is running

3. **JSON Editor not working**
   - Check Monaco Editor bundle size limits
   - Verify Content Security Policy allows script execution
   - Check browser console for Monaco-related errors

## 🚀 Production Deployment

### Building for Distribution

1. **Create production build**

   ```bash
   npm run build
   ```

2. **Test thoroughly**

   - Load the extension from `dist/` folder
   - Test all features in various scenarios
   - Check for console errors

3. **Package for Chrome Web Store**
   - Zip the contents of the `dist/` folder
   - Upload to Chrome Web Store Developer Dashboard

### Chrome Web Store Requirements

- High-quality icons (16px, 32px, 48px, 128px)
- Comprehensive description and screenshots
- Privacy policy (if collecting user data)
- Proper categorization and metadata

## 🔧 Extension Permissions

The extension requires these permissions:

- `webRequest` - Intercept HTTP requests
- `storage` - Save captured requests and overrides
- `activeTab` - Access current tab information
- `tabs` - Tab management
- `<all_urls>` - Monitor requests on all websites

## 🎨 UI Customization

### Tailwind Configuration

The extension uses Tailwind CSS for styling. Customize colors and themes in:

- `tailwind.config.js` - Main configuration
- `src/index.css` - Global styles and custom classes

### Monaco Editor Configuration

Monaco Editor settings can be modified in:

- `src/components/JsonEditor.tsx` - Editor options and themes

## 🧪 Testing Strategy

While the current build focuses on core functionality, consider adding:

1. **Unit Tests** - Component logic and utilities
2. **Integration Tests** - Chrome API interactions
3. **E2E Tests** - Full extension workflow testing

## 📝 Code Style

- **TypeScript** - Strict type checking enabled
- **ESLint** - Code quality and consistency
- **Functional Components** - React hooks over classes
- **Clear Naming** - Descriptive variable and function names

## 🔒 Security Considerations

- **Content Security Policy** - Implemented in manifest
- **Input Validation** - JSON parsing with error handling
- **Permissions** - Principle of least privilege
- **Data Storage** - Local storage only, no external services

## 🚧 Future Enhancements

Consider implementing:

1. **Request Filtering** - Advanced search and filter options
2. **Export/Import** - Backup and share override configurations
3. **Response Recording** - Capture actual API responses
4. **Rule-based Overrides** - Pattern-based request matching
5. **Team Collaboration** - Share overrides across team members

## 📞 Support

For development questions or issues:

1. Check the browser console for errors
2. Review Chrome Extension documentation
3. Test with minimal reproduction cases
4. Document steps to reproduce issues

---

Happy coding! 🎉
