# Metadata Wizard - Troubleshooting Guide

## Extension Not Loading Issues

### ✅ **Step 1: Check Extension Files**

Verify that the `dist/` folder contains all required files:

```
dist/
├── manifest.json        ✅ Main extension manifest
├── popup.html          ✅ Extension popup
├── popup.js            ✅ React app bundle
├── popup.css           ✅ Styles
├── background.js       ✅ Service worker
└── icons/              ✅ Extension icons
    ├── wizard-16.png
    ├── wizard-32.png
    ├── wizard-48.png
    └── wizard-128.png
```

### ✅ **Step 2: Load Extension in Chrome**

1. **Open Chrome Extensions Page**

   - Go to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer Mode**

   - Toggle "Developer mode" ON (top right corner)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `dist` folder (NOT the root project folder)
   - The extension should appear in the list

### ✅ **Step 3: Check for Errors**

If the extension doesn't load, check for errors:

#### **A. Manifest Errors**

- Look for red error text under the extension
- Common issues:
  - Invalid JSON syntax
  - Missing required fields
  - Incorrect file paths

#### **B. Service Worker Errors**

- Click "service worker" next to the extension name
- Check console for JavaScript errors
- Common issues:
  - Chrome API permissions
  - Syntax errors in background.js

#### **C. Popup Errors**

- Right-click extension icon → "Inspect popup"
- Check console for React/JavaScript errors
- Common issues:
  - Missing CSS/JS files
  - Content Security Policy violations

### 🔧 **Common Fixes**

#### **Issue: "Manifest file is missing or unreadable"**

**Solution:** Make sure you're selecting the `dist` folder, not the root project folder.

#### **Issue: "Invalid manifest"**

**Solution:** Check `dist/manifest.json` for syntax errors:

```bash
# Validate JSON syntax
cat dist/manifest.json | python -m json.tool
```

#### **Issue: "Service worker registration failed"**

**Solution:** Check that `background.js` exists and has no syntax errors.

#### **Issue: Extension loads but popup is blank**

**Solution:**

1. Check that `popup.html` has correct relative paths:
   ```html
   <script src="./popup.js"></script>
   <link rel="stylesheet" href="./popup.css" />
   ```
2. Rebuild the extension: `npm run build`

#### **Issue: "Refused to execute script" CSP error**

**Solution:** The extension needs `'wasm-unsafe-eval'` for Monaco Editor:

```json
{
	"content_security_policy": {
		"extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
	}
}
```

### 🚀 **Quick Reset**

If nothing works, try a complete rebuild:

```bash
# Clean and rebuild everything
rm -rf dist/
npm run build

# Reload extension in Chrome
# 1. Go to chrome://extensions/
# 2. Click refresh icon on Metadata Wizard
# 3. Test the extension
```

### 📋 **Testing Checklist**

Once loaded successfully:

- [ ] Extension appears in toolbar
- [ ] Clicking icon opens popup (800x600 window)
- [ ] Popup shows "Captured Requests" sidebar
- [ ] Main area shows "No Request Selected" message
- [ ] No console errors in popup or background script

### 🔍 **Getting Help**

If you're still having issues:

1. **Check Console Logs**

   - Background script: Extensions page → "service worker"
   - Popup: Right-click icon → "Inspect popup"

2. **Verify Permissions**

   - Extension should request: webRequest, storage, activeTab, tabs
   - Host permissions: `<all_urls>`

3. **Test on Target Site**
   - Navigate to a site with `/rest/reports-metadata` endpoints
   - Check if requests appear in sidebar

### 📞 **Debug Commands**

```bash
# Check if all files exist
ls -la dist/

# Validate manifest JSON
cat dist/manifest.json | python -m json.tool

# Check file sizes
du -sh dist/*

# Rebuild extension
npm run build
```

### ⚡ **Quick Start Checklist**

For a completely fresh start:

1. ✅ `npm install`
2. ✅ `npm run build`
3. ✅ Open `chrome://extensions/`
4. ✅ Enable "Developer mode"
5. ✅ Click "Load unpacked"
6. ✅ Select the `dist` folder
7. ✅ Look for "Metadata Wizard" in toolbar
8. ✅ Click to test popup

---

**Need more help?** Check the browser console for specific error messages and search for Chrome extension development troubleshooting guides.
