/**
 * Content Script for Metadata Wizard Chrome Extension
 * Intercepts fetch requests and XMLHttpRequests to capture response data
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

// Override fetch to capture responses
const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const url = input instanceof Request ? input.url : input.toString();

	// Check if this is a target endpoint
	if (await isContentTargetEndpoint(url)) {
		console.log('[Metadata Wizard Content] 🔍 Intercepting fetch request:', url);

		try {
			const response = await originalFetch(input, init);

			// Clone response to read it without consuming the original
			const clonedResponse = response.clone();

			// Try to read response data
			try {
				const responseData = await clonedResponse.json();

				// Send response data to background script
				chrome.runtime
					.sendMessage({
						type: 'RESPONSE_CAPTURED',
						url: url,
						data: responseData,
						timestamp: Date.now(),
					})
					.catch(console.error);

				console.log('[Metadata Wizard Content] ✅ Captured response data for:', url);
			} catch (error) {
				console.log('[Metadata Wizard Content] ❌ Failed to parse response as JSON:', error);
			}

			return response;
		} catch (error) {
			console.log('[Metadata Wizard Content] ❌ Fetch error:', error);
			throw error;
		}
	}

	// For non-target requests, use original fetch
	return originalFetch(input, init);
};

// Override XMLHttpRequest to capture responses
const originalXMLHttpRequest = window.XMLHttpRequest;
window.XMLHttpRequest = function () {
	const xhr = new originalXMLHttpRequest();
	const originalOpen = xhr.open;
	const originalSend = xhr.send;

	let requestUrl = '';

	xhr.open = function (
		method: string,
		url: string | URL,
		async: boolean = true,
		username?: string | null,
		password?: string | null
	) {
		requestUrl = url.toString();
		return originalOpen.call(this, method, url, async, username, password);
	};

	xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
		// Check if this is a target endpoint asynchronously
		isContentTargetEndpoint(requestUrl).then((isTarget) => {
			if (isTarget) {
				console.log('[Metadata Wizard Content] 🔍 Intercepting XHR request:', requestUrl);

				// Add response handler
				xhr.addEventListener('load', function () {
					if (xhr.status >= 200 && xhr.status < 300) {
						try {
							const responseData = JSON.parse(xhr.responseText);

							// Send response data to background script
							chrome.runtime
								.sendMessage({
									type: 'RESPONSE_CAPTURED',
									url: requestUrl,
									data: responseData,
									timestamp: Date.now(),
								})
								.catch(console.error);

							console.log('[Metadata Wizard Content] ✅ Captured XHR response data for:', requestUrl);
						} catch (error) {
							console.log('[Metadata Wizard Content] ❌ Failed to parse XHR response as JSON:', error);
						}
					}
				});
			}
		});

		return originalSend.apply(this, [body]);
	};

	return xhr;
} as any;

// Preserve the original constructor properties
Object.setPrototypeOf(window.XMLHttpRequest, originalXMLHttpRequest);
Object.setPrototypeOf(window.XMLHttpRequest.prototype, originalXMLHttpRequest.prototype);

// Listen for pattern updates from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === 'PATTERNS_UPDATED') {
		console.log('[Metadata Wizard Content] 🔄 Received pattern update notification');
		refreshPatternCache();
		sendResponse({ success: true });
	}
});

// Get current tab info for logging
chrome.runtime
	.sendMessage({ type: 'DEBUG_INFO' })
	.then(() => {
		console.log('[Metadata Wizard Content] 🚀 Content script loaded and request interceptors installed');
		console.log('[Metadata Wizard Content] 📋 Active tab ID tracking initialized');
	})
	.catch(() => {
		console.log('[Metadata Wizard Content] 🚀 Content script loaded and request interceptors installed');
	});
