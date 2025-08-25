# Chrome Web Store Submission Guide for Metadata Wizard

## 🎉 Ready for Submission!

Your **Metadata Wizard** extension is packaged and ready for Chrome Web Store submission. Here's everything you need to complete the process:

## 📦 Package Information

- **Package File**: `metadata-wizard-v1.0.0.zip` (created in project root)
- **Package Size**: ~0.08 MB
- **Version**: 1.0.0
- **Manifest**: Version 3 (fully compliant)

## 🔗 Quick Start

1. **Go to Chrome Web Store Developer Dashboard**: https://chrome.google.com/webstore/devconsole/
2. **Upload** the `metadata-wizard-v1.0.0.zip` file
3. **Fill in the store listing** using the details below
4. **Submit for review**

## 📝 Store Listing Details

### Basic Information

- **Extension Name**: Metadata Wizard
- **Summary** (132 chars max):
  ```
  Intercept and override REST API responses from configurable endpoints with a powerful JSON editor interface.
  ```

### Description (Use from store-assets/description.md)

```markdown
**Metadata Wizard** is a powerful Chrome extension designed for developers and QA engineers who need to intercept, inspect, and override REST API responses from configurable endpoints.

### ✨ Key Features:

🔍 **Smart Request Interception**

- Configurable URL patterns for flexible endpoint targeting
- Real-time monitoring with live status indicators
- Active tab filtering to reduce noise
- Complete request/response metadata tracking

📝 **Advanced JSON Editor**

- Dual-mode viewing: Tree view for exploration, text editor for modifications
- Syntax highlighting and validation
- One-click JSON formatting
- Real-time error detection

🎯 **Response Override System**

- Save custom JSON responses for any captured endpoint
- Instantly override API responses for testing scenarios
- Clear visual indicators for modified requests
- Easy reset to original responses

🚀 **Professional Interface**

- Clean, intuitive sidebar with captured requests
- Resizable panels for optimal workflow
- Configurable URL pattern management
- Individual request deletion and bulk clearing
- Responsive design optimized for developer productivity

### 🛠️ Perfect For:

- **Frontend Developers**: Test different API response scenarios
- **QA Engineers**: Simulate edge cases and error conditions
- **Backend Developers**: Mock API responses during development
- **Product Managers**: Validate features with different data sets

### 🔒 Privacy & Security:

- All data processed locally - nothing sent to external servers
- Minimal permissions following Chrome's security best practices
- Open source architecture for transparency

### 🎮 How to Use:

1. Install the extension
2. Configure URL patterns in Settings to target your specific endpoints
3. Navigate to any website using your configured endpoints
4. Open the extension popup to see captured requests
5. Click any request to view and edit its JSON response
6. Save overrides to test different scenarios
7. Reset when you're done testing

Transform your API development workflow with Metadata Wizard today!

**Developer Note**: This extension targets configurable API endpoints (default includes `/rest/reports-metadata`) and requires appropriate permissions to intercept network requests. Perfect for development and testing environments.
```

### Category

- **Primary Category**: Developer Tools
- **Secondary Category**: Productivity

### Language

- **Default Language**: English
- **Supported Languages**: English (can be expanded later)

### Privacy

- **Privacy Policy URL**: You'll need to host the privacy policy online. You can:
  1. Create a GitHub Pages site with the privacy policy
  2. Host it on your personal website
  3. Use Google Sites or similar free hosting

### Pricing and Distribution

- **Pricing**: Free
- **Visibility**: Public
- **Regions**: All regions (recommended)

## 📸 Screenshots Required

You need to take **3-5 screenshots** (1280x800 or 640x400 pixels) showing:

### 1. Main Interface

- Extension popup with captured requests visible
- Show the sidebar with a few captured API calls
- Display the "Live" indicator and request list

### 2. JSON Editor - Tree View

- A request selected with JSON data displayed in tree format
- Show the expandable/collapsible JSON structure
- Include the Edit/Format/Save buttons

### 3. JSON Editor - Text Mode

- Same request but in text editing mode
- Show formatted JSON with syntax highlighting
- Display the editing interface

### 4. Settings/Configuration

- The URL pattern configuration screen
- Show how users can add/edit URL patterns
- Display the settings interface with some example patterns

### 5. Override Active (Optional)

- A request with an override applied
- Show the "Modified" indicator
- Demonstrate the override functionality in action

### Screenshot Tips:

- Use a clean, realistic API endpoint
- Ensure good contrast and readability
- Keep sensitive data out of screenshots
- Show the extension in action on a real website

## 🔒 Permissions Justification

When asked about permissions, use this explanation:

```
This extension requires broad permissions to fulfill its core functionality of intercepting and modifying API responses for development purposes:

- webRequest: Essential for capturing HTTP requests to target endpoints
- declarativeNetRequest: Required for implementing request blocking/modification
- storage: Needed to save captured requests and user overrides locally
- activeTab: Required to inject content scripts for response capture
- host_permissions (<all_urls>): Necessary as API endpoints can be on any domain

All data is processed and stored locally only. No data is transmitted to external servers.
```

## 🚀 Developer Account Setup

If you don't have one already:

1. **Go to**: https://chrome.google.com/webstore/devconsole/
2. **Pay**: One-time $5 registration fee
3. **Verify**: Complete identity verification
4. **Accept**: Developer agreement terms

## ⏱️ Review Timeline

- **Typical Review Time**: 1-3 business days
- **First Submission**: May take longer (up to 7 days)
- **Status Updates**: Check the Developer Dashboard regularly

## 🎯 Submission Checklist

- [ ] Chrome Web Store Developer account created and verified
- [ ] Privacy policy hosted online (URL ready)
- [ ] Screenshots taken (3-5 images)
- [ ] `metadata-wizard-v1.0.0.zip` package ready
- [ ] Store listing content copied and ready
- [ ] Payment method set up for developer account

## 📞 Support Information

- **Developer Email**: [Your email address]
- **Support URL**: [Your support page or GitHub repo]
- **Homepage URL**: [Your project website or GitHub repo]

## 🚨 Common Issues to Avoid

1. **Permissions**: Be ready to justify the broad permissions
2. **Screenshots**: Ensure they clearly show the extension's functionality
3. **Description**: Make sure it's clear what the extension does
4. **Privacy Policy**: Must be publicly accessible and comprehensive

## 🎉 After Approval

Once approved:

- Extension goes live within a few hours
- Monitor user reviews and feedback
- Plan for updates and improvements
- Respond to user questions promptly

## 📞 Need Help?

If you encounter issues:

1. Check the Chrome Web Store Developer Documentation
2. Review the Developer Program Policies
3. Contact Chrome Web Store Developer Support

**Good luck with your submission!** 🚀

---

**Next Steps**:

1. Take screenshots of the extension in action
2. Host your privacy policy online
3. Go to the Chrome Web Store Developer Dashboard
4. Upload and submit!
