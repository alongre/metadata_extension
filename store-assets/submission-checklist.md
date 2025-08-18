# Chrome Web Store Submission Checklist

## ✅ Pre-Submission Requirements

### Extension Files

- [x] Extension built and tested (`npm run build`)
- [x] All icons created (16x16, 32x32, 48x48, 128x128)
- [x] Manifest v3 compliant
- [x] Content Security Policy configured
- [x] No hardcoded URLs or sensitive data

### Store Listing Materials

- [x] Extension name: "Metadata Wizard"
- [x] Short description (under 132 characters)
- [x] Detailed description
- [x] Privacy policy document
- [ ] Screenshots (3-5 recommended)
- [ ] Promotional images (optional but recommended)

### Required Documentation

- [x] Privacy policy created
- [ ] Terms of service (if applicable)
- [ ] Support email/contact method

## 📸 Screenshots Needed

**Recommended Screenshots** (1280x800 or 640x400 pixels):

1. **Main Interface**: Extension popup showing captured requests
2. **JSON Editor**: Tree view with expanded JSON data
3. **Edit Mode**: Text editor with JSON modification
4. **Override Active**: Request with override indicator
5. **Empty State**: Extension when no requests captured

## 🚀 Submission Steps

### 1. Create Developer Account

- Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- Pay one-time $5 registration fee
- Verify your identity

### 2. Package Extension

```bash
# Create submission package
cd dist
zip -r metadata-wizard-v1.0.0.zip .
```

### 3. Upload and Configure

- Upload ZIP file to Chrome Web Store
- Fill in store listing details
- Upload screenshots and promotional images
- Set privacy policy URL
- Configure pricing (free)

### 4. Review and Submit

- Review all information
- Submit for review
- Typical review time: 1-3 business days

## ⚠️ Common Rejection Reasons to Avoid

### Permissions

- [x] Only request necessary permissions
- [x] Justify broad permissions in description
- [x] Follow principle of least privilege

### Content Policy

- [x] Clear purpose and functionality description
- [x] No misleading claims
- [x] Appropriate for all audiences
- [x] No trademark violations

### Technical Requirements

- [x] Extension functions as described
- [x] No crashes or errors
- [x] Clean, professional UI
- [x] Proper error handling

## 📋 Post-Submission

### Monitor Status

- Check Developer Dashboard regularly
- Respond to any reviewer feedback promptly
- Address any issues quickly

### After Approval

- Extension will be live within a few hours
- Monitor user reviews and ratings
- Plan for future updates and improvements

## 🔗 Useful Links

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Store Listing Guidelines](https://developer.chrome.com/docs/webstore/best-practices/)
- [Review Process](https://developer.chrome.com/docs/webstore/review-process/)

---

**Next Steps**: Take screenshots of the extension and package it for submission!
