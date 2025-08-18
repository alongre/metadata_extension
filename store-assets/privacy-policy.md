# Privacy Policy for Metadata Wizard Chrome Extension

**Last Updated**: December 18, 2024

## Overview

Metadata Wizard is a Chrome extension designed to intercept and modify REST API responses for development and testing purposes. This privacy policy explains how we handle your data.

## Data Collection and Usage

### What We Collect

- **Network Requests**: The extension captures HTTP requests and responses from URLs containing `/rest/reports-metadata`
- **User Modifications**: JSON data modifications you make within the extension
- **Local Storage**: Settings and captured data stored locally in your browser

### What We Don't Collect

- **Personal Information**: We do not collect names, emails, or personal identifiers
- **External Transmission**: No data is sent to external servers or third parties
- **Browsing History**: We do not track your general browsing activity
- **Cross-Site Data**: We only monitor the specific API endpoints mentioned above

## Data Storage and Security

### Local Storage Only

- All captured requests and modifications are stored locally in Chrome's extension storage
- Data never leaves your device
- No cloud storage or external databases are used

### Data Retention

- Data persists until you manually clear it or uninstall the extension
- You can delete individual requests or clear all data at any time

## Permissions Explanation

### Required Permissions

- **webRequest**: To intercept and monitor network requests to specified endpoints
- **storage**: To save captured requests and user modifications locally
- **activeTab**: To inject content scripts for response capture
- **declarativeNetRequest**: To implement request blocking/modification features
- **host_permissions**: To access network requests across all domains (limited to target endpoints)

### Why These Permissions Are Necessary

These permissions are essential for the extension's core functionality of intercepting, displaying, and overriding API responses. Without these permissions, the extension cannot perform its intended purpose.

## Third-Party Services

This extension does not integrate with any third-party services, analytics platforms, or external APIs.

## User Rights

### Data Control

- View all captured data within the extension interface
- Delete individual requests or clear all data
- Export captured data (functionality available in extension)
- Disable or uninstall the extension at any time

### Data Deletion

Uninstalling the extension will remove all locally stored data associated with it.

## Changes to This Policy

We may update this privacy policy occasionally. Significant changes will be communicated through extension updates. Continued use of the extension after policy updates constitutes acceptance of the new terms.

## Contact Information

For questions about this privacy policy or the extension's data practices, please:

- Create an issue on our GitHub repository
- Contact us through the Chrome Web Store developer contact information

## Compliance

This extension is designed to comply with:

- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) guidelines

## Age Restrictions

This extension is intended for developers and technical professionals. It is not designed for use by children under 13.

---

**Note**: This extension is designed for development and testing environments. Use responsibly and in accordance with your organization's policies and applicable laws.
