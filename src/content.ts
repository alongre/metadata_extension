/**
 * Content Script for Metadata Wizard Chrome Extension
 * Injects a page-context interceptor for fetch/XMLHttpRequest to capture response bodies
 */

// Cache for URL patterns to avoid frequent messaging
let cachedURLPatterns: Array<{ pattern: string; enabled: boolean }> = [];
let lastPatternFetch = 0;
const PATTERN_CACHE_DURATION = 5000; // 5 seconds - reduced for faster updates

// Get current URL patterns from background
async function getContentURLPatterns(): Promise<Array<{ pattern: string; enabled: boolean }>> {
	const now = Date.now();
	if (now - lastPatternFetch < PATTERN_CACHE_DURATION && cachedURLPatterns.length > 0) {
		return cachedURLPatterns;
	}

	try {
		const response = await chrome.runtime.sendMessage({ type: 'GET_URL_PATTERNS' });
		if (response.success && response.data) {
			cachedURLPatterns = response.data
				.filter((p: any) => p.enabled)
				.map((p: any) => ({
					pattern: p.pattern,
					enabled: p.enabled,
				}));
			lastPatternFetch = now;
		}
	} catch (error) {
		console.log('[Metadata Wizard Content] ❌ Failed to get URL patterns:', error);
		// Fallback to default pattern
		cachedURLPatterns = [{ pattern: '/rest/reports-metadata', enabled: true }];
	}

	return cachedURLPatterns;
}

// Force refresh of URL patterns cache
function refreshPatternCache() {
	cachedURLPatterns = [];
	lastPatternFetch = 0;
	console.log('[Metadata Wizard Content] 🔄 Pattern cache cleared');
}

// Check if URL matches any enabled patterns
async function isContentTargetEndpoint(url: string): Promise<boolean> {
	const patterns = await getContentURLPatterns();
	const isMatch = patterns.some((pattern) => pattern.enabled && url.includes(pattern.pattern));

	if (isMatch) {
		const matchedPattern = patterns.find((pattern) => pattern.enabled && url.includes(pattern.pattern));
		console.log(`[Metadata Wizard Content] ✅ Pattern matched: "${matchedPattern?.pattern}" in ${url}`);
	}

	return isMatch;
}

// Inject a page-context script that patches fetch and XHR so we can read response bodies
function injectPageInterceptorFromFile() {
	try {
		const s = document.createElement('script');
		// The file is packaged by vite into dist and is web_accessible via manifest
		s.src = chrome.runtime.getURL('pageInterceptor.js');
		s.onload = () => s.remove();
		(document.documentElement || document.head || document.body).appendChild(s);
	} catch (e) {
		console.log('[Metadata Wizard Content] ❌ Failed to inject interceptor file:', e);
	}
}

// Inject immediately to catch earliest requests
injectPageInterceptorFromFile();

// Relay captured responses from the page to the background
window.addEventListener('message', (event) => {
		if (event.source !== window) return;
		const data = event.data;
		if (data && data.type === 'MW_RESPONSE_CAPTURED') {
				chrome.runtime.sendMessage({
						type: 'RESPONSE_CAPTURED',
						url: data.url,
						data: data.data,
						timestamp: data.timestamp,
				}).catch(() => {});
		}
});

// Listen for pattern updates from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === 'PATTERNS_UPDATED') {
		console.log('[Metadata Wizard Content] 🔄 Received pattern update notification');
		refreshPatternCache();
		// Push latest patterns to the injected script
		getContentURLPatterns().then((patterns) => {
			window.postMessage({ type: 'MW_UPDATE_PATTERNS', patterns }, '*');
		});
		sendResponse({ success: true });
	}
});

// Get current tab info for logging
// Kick off initial pattern sync without delaying injection
getContentURLPatterns()
	.then((initial) => {
		window.postMessage({ type: 'MW_UPDATE_PATTERNS', patterns: initial }, '*');
	})
	.catch(() => {})
	.finally(() => {
		// Send again shortly after load to catch early requests
		setTimeout(async () => {
			const latest = await getContentURLPatterns();
			window.postMessage({ type: 'MW_UPDATE_PATTERNS', patterns: latest }, '*');
		}, 150);
		setTimeout(async () => {
			const latest = await getContentURLPatterns();
			window.postMessage({ type: 'MW_UPDATE_PATTERNS', patterns: latest }, '*');
		}, 1000);
	});

// Optional debug info request (non-blocking)
chrome.runtime.sendMessage({ type: 'DEBUG_INFO' }).catch(() => {});
