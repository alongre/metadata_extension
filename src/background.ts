/**
 * Background Service Worker for Metadata Wizard Chrome Extension
 * Handles webRequest interception and storage of API calls with configurable URL patterns
 * Intercepts requests in all tabs that match user URL patterns
 */

// Track the active tab
let activeTabId: number | null = null;

interface CapturedRequest {
	id: string;
	url: string;
	endpoint: string;
	method: string;
	timestamp: number;
	requestBody?: any;
	requestHeaders?: chrome.webRequest.HttpHeader[];
	responseHeaders?: chrome.webRequest.HttpHeader[];
	responseStatus?: number;
	responseData?: any;
	overrideData?: any;
	isOverridden: boolean;
	completed?: boolean;
	completedAt?: number;
	overrideUpdatedAt?: number;
}

interface StoredRequests {
	[key: string]: CapturedRequest;
}

interface URLPattern {
	id: string;
	pattern: string;
	enabled: boolean;
	createdAt: number;
}

// Keys for persisted override state
const ACTIVE_OVERRIDES_KEY = 'activeOverrides'; // Record<string /* urlKey */ , any /* payload */>
const OVERRIDE_RULE_IDS_KEY = 'overrideRuleIds'; // Record<string /* urlKey */ , number /* ruleId */>

// Storage helper functions
async function getStoredRequests(): Promise<StoredRequests> {
	const result = await chrome.storage.local.get('capturedRequests');
	return result.capturedRequests || {};
}

async function storeRequest(request: CapturedRequest): Promise<void> {
	const stored = await getStoredRequests();
	stored[request.id] = request;
	await chrome.storage.local.set({ capturedRequests: stored });
}

// URL Pattern storage functions - using chrome.storage.local with separate key
async function getURLPatterns(): Promise<URLPattern[]> {
	try {
		const result = await chrome.storage.local.get('persistentUrlPatterns');
		if (result.persistentUrlPatterns) {
			return result.persistentUrlPatterns;
		}
		// Initialize with default patterns if none exist
		const defaultPatterns = getDefaultPatterns();
		await chrome.storage.local.set({ persistentUrlPatterns: defaultPatterns });
		debugLog(`🔧 Initialized default URL patterns:`, defaultPatterns);
		return defaultPatterns;
	} catch (error) {
		debugLog(`❌ Error reading URL patterns from storage: ${error}`);
		return getDefaultPatterns();
	}
}

async function storeURLPatterns(patterns: URLPattern[]): Promise<void> {
	try {
		await chrome.storage.local.set({ persistentUrlPatterns: patterns });
		debugLog(`💾 Stored ${patterns.length} URL patterns to persistent storage`);
		// Notify all content scripts about pattern updates
		notifyPatternsUpdated();
	} catch (error) {
		debugLog(`❌ Error storing URL patterns to storage: ${error}`);
	}
}

// Notify all content scripts that patterns have been updated
async function notifyPatternsUpdated() {
	try {
		// Get all tabs
		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			if (tab.id) {
				try {
					await chrome.tabs.sendMessage(tab.id, { type: 'PATTERNS_UPDATED' });
				} catch (error) {
					// Tab might not have content script loaded, that's okay
					debugLog(`📨 Could not notify tab ${tab.id}: ${error}`);
				}
			}
		}
		debugLog(`📨 Notified ${tabs.length} tabs about pattern updates`);
	} catch (error) {
		debugLog(`❌ Error notifying pattern updates: ${error}`);
	}
}

function getDefaultPatterns(): URLPattern[] {
	return [];
}

// Generate unique ID for requests
function generateRequestId(url: string, timestamp: number): string {
	return `${url.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
}

// Extract endpoint name from URL - get the last segment of the URL path
function extractEndpointName(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathParts = urlObj.pathname.split('/').filter((part) => part.length > 0); // Remove empty parts

		if (pathParts.length > 0) {
			// Return the last non-empty segment
			return pathParts[pathParts.length - 1];
		}

		// Fallback if no path segments
		return 'root';
	} catch (error) {
		// If URL parsing fails, try basic string manipulation
		const pathParts = url.split('/').filter((part) => part.length > 0 && !part.includes('://'));
		return pathParts.length > 0 ? pathParts[pathParts.length - 1].split('?')[0] : 'unknown-endpoint';
	}
}

// Check if URL matches any enabled patterns
async function isTargetEndpoint(url: string): Promise<{ isMatch: boolean; matchedPattern?: string }> {
	const patterns = await getURLPatterns();
	const enabledPatterns = patterns.filter((p) => p.enabled);

	debugLog(
		`🔍 Checking URL: ${url} against ${enabledPatterns.length} enabled patterns`,
		enabledPatterns.map((p) => p.pattern)
	);

	for (const pattern of enabledPatterns) {
		if (url.includes(pattern.pattern)) {
			debugLog(`✅ Pattern matched: "${pattern.pattern}" in ${url}`);
			return { isMatch: true, matchedPattern: pattern.pattern };
		}
	}

	return { isMatch: false };
}

// Debug logging function
function debugLog(message: string, data?: any) {
	console.log(`[Metadata Wizard] ${message}`, data || '');
}

// ===============================
// Override + DNR helper functions
// ===============================

// Normalize a URL to a stable key (origin + pathname, ignore query/hash)
function normalizeUrlKey(url: string): string {
	try {
		const u = new URL(url);
		return `${u.origin}${u.pathname}`;
	} catch {
		return url.split('?')[0].split('#')[0];
	}
}

// Build a regex that matches the same origin+pathname regardless of query
function buildRegexFilterForUrl(url: string): string {
	try {
		const u = new URL(url);
		const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const origin = escape(u.origin);
		const path = escape(u.pathname);
		return `^${origin}${path}(\\?.*)?$`;
	} catch {
		const base = url.split('?')[0];
		const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return `^${escape(base)}(\\?.*)?$`;
	}
}

// UTF-8 safe base64 encoder
function toBase64(str: string): string {
	try {
		// btoa handles ASCII; encodeURIComponent handles UTF-8
		return btoa(unescape(encodeURIComponent(str)));
	} catch {
		// As a fallback, strip non-ASCII (rare)
		return btoa(str);
	}
}

function toDataUrl(payload: any): string {
	const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
	const b64 = toBase64(text);
	return `data:application/json;base64,${b64}`;
}

async function getActiveOverrides(): Promise<Record<string, any>> {
	const res = await chrome.storage.local.get(ACTIVE_OVERRIDES_KEY);
	return res[ACTIVE_OVERRIDES_KEY] || {};
}

async function setActiveOverrides(map: Record<string, any>): Promise<void> {
	await chrome.storage.local.set({ [ACTIVE_OVERRIDES_KEY]: map });
}

async function getOverrideRuleIds(): Promise<Record<string, number>> {
	const res = await chrome.storage.local.get(OVERRIDE_RULE_IDS_KEY);
	return res[OVERRIDE_RULE_IDS_KEY] || {};
}

async function setOverrideRuleIds(map: Record<string, number>): Promise<void> {
	await chrome.storage.local.set({ [OVERRIDE_RULE_IDS_KEY]: map });
}

// Deterministic rule id from key; kept within a safe numeric range
function ruleIdFromKey(key: string): number {
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = (hash * 31 + key.charCodeAt(i)) | 0;
	}
	// Keep positive and within 1..2^31-1 range
	const id = Math.abs(hash) % 2000000000 || 1;
	return id;
}

async function applyOverrideRule(url: string, payload: any): Promise<number> {
	const urlKey = normalizeUrlKey(url);
	const id = ruleIdFromKey(urlKey);
	const regexFilter = buildRegexFilterForUrl(url);
	const redirectUrl = toDataUrl(payload);

	const rule: chrome.declarativeNetRequest.Rule = {
		id,
		priority: 1,
		action: {
			type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
			redirect: { url: redirectUrl },
		},
		condition: {
			regexFilter,
			resourceTypes: [
				chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
				chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
				chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
				chrome.declarativeNetRequest.ResourceType.OTHER,
			],
		},
	};

	await chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: [id],
		addRules: [rule],
	});

	// Persist maps
	const active = await getActiveOverrides();
	active[urlKey] = payload;
	await setActiveOverrides(active);

	const ids = await getOverrideRuleIds();
	ids[urlKey] = id;
	await setOverrideRuleIds(ids);

	debugLog(`🧩 Applied DNR override`, { urlKey, id, regexFilter, size: typeof payload === 'string' ? payload.length : undefined });
	return id;
}

async function removeOverrideRuleByUrl(url: string): Promise<void> {
	const urlKey = normalizeUrlKey(url);
	const ids = await getOverrideRuleIds();
	const id = ids[urlKey];
	if (id) {
		await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [id], addRules: [] });
		delete ids[urlKey];
		await setOverrideRuleIds(ids);
	}
	const active = await getActiveOverrides();
	if (urlKey in active) {
		delete active[urlKey];
		await setActiveOverrides(active);
	}
	debugLog(`🧹 Removed DNR override`, { urlKey, id });
}

// Tab tracking functions
async function updateActiveTab() {
	try {
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tabs.length > 0) {
			activeTabId = tabs[0].id || null;
			debugLog(`📋 Active tab updated: ${activeTabId}`);
		}
	} catch (error) {
		debugLog(`❌ Error getting active tab: ${error}`);
		activeTabId = null;
	}
}

// Note: We no longer restrict to the active tab. Keep tab tracking for future UX, but intercept across all tabs.

// Helper to decode request bodies when available
function decodeRequestBody(body?: chrome.webRequest.WebRequestBody): any | undefined {
	if (!body) return undefined;
	try {
		if (body.formData) {
			return body.formData;
		}
		if (body.raw && body.raw.length > 0 && body.raw[0].bytes) {
			const decoder = new TextDecoder('utf-8');
			const text = decoder.decode(body.raw[0].bytes);
			try {
				return JSON.parse(text);
			} catch {
				return text;
			}
		}
	} catch (e) {
		debugLog(`❌ Failed to decode request body: ${e}`);
	}
	return undefined;
}

// Set up webRequest listeners with enhanced debugging
chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
	// Process requests from all tabs
	debugLog(`🔍 Checking request: ${details.url}`);

		// Handle async pattern matching
		isTargetEndpoint(details.url)
			.then((matchResult) => {
				if (!matchResult.isMatch) {
					return; // Skip non-matching requests silently
				}

				debugLog(`✅ Target endpoint detected: ${details.url} (pattern: ${matchResult.matchedPattern})`);

				const requestId = generateRequestId(details.url, details.timeStamp);
				const endpoint = extractEndpointName(details.url);

				const capturedRequest: CapturedRequest = {
					id: requestId,
					url: details.url,
					endpoint,
					method: details.method,
					timestamp: details.timeStamp,
					isOverridden: false,
					// Attempt to capture request body when present
					requestBody: decodeRequestBody(details.requestBody ?? undefined),
				};

				// Store request asynchronously
				storeRequest(capturedRequest)
					.then(() => {
						debugLog(`💾 Stored request: ${endpoint}`, capturedRequest);
					})
					.catch((error) => {
						debugLog(`❌ Failed to store request: ${error.message}`);
					});
			})
			.catch((error) => {
				debugLog(`❌ Error checking endpoint: ${error.message}`);
			});
	},
	{ urls: ['<all_urls>'] },
	['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
	(details) => {
		isTargetEndpoint(details.url)
			.then((matchResult) => {
				if (!matchResult.isMatch) {
					return;
				}

				const requestId = generateRequestId(details.url, details.timeStamp);

				// Store headers asynchronously
				getStoredRequests()
					.then((stored) => {
						if (stored[requestId]) {
							stored[requestId].requestHeaders = details.requestHeaders;
							storeRequest(stored[requestId])
								.then(() => {
									debugLog(`📋 Updated headers for: ${stored[requestId].endpoint}`);
								})
								.catch(console.error);
						}
					})
					.catch(console.error);
			})
			.catch(console.error);
	},
	{ urls: ['<all_urls>'] },
	['requestHeaders']
);

// Enhanced response monitoring
chrome.webRequest.onResponseStarted.addListener(
	(details) => {
		isTargetEndpoint(details.url)
			.then(async (matchResult) => {
				if (!matchResult.isMatch) {
					return;
				}

				const requestId = generateRequestId(details.url, details.timeStamp);
				const stored = await getStoredRequests();

				if (stored[requestId]) {
					debugLog(`📡 Response started for: ${stored[requestId].endpoint}`, {
						status: details.statusCode,
						responseHeaders: details.responseHeaders?.slice(0, 3), // Log first 3 headers
					});

					// Store response metadata
					stored[requestId].responseStatus = details.statusCode;
					stored[requestId].responseHeaders = details.responseHeaders;
					await storeRequest(stored[requestId]);
				}
			})
			.catch(console.error);
	},
	{ urls: ['<all_urls>'] },
	['responseHeaders']
);

chrome.webRequest.onCompleted.addListener(
	(details) => {
		isTargetEndpoint(details.url)
			.then(async (matchResult) => {
				if (!matchResult.isMatch) {
					return;
				}

				const requestId = generateRequestId(details.url, details.timeStamp);
				const stored = await getStoredRequests();

				if (stored[requestId]) {
					debugLog(`✅ Request completed: ${stored[requestId].endpoint}`, {
						status: details.statusCode,
						fromCache: details.fromCache,
					});

					// Update completion status
					stored[requestId].completed = true;
					stored[requestId].completedAt = Date.now();
					await storeRequest(stored[requestId]);

					// Notify popup about new request (if popup is open)
					try {
						chrome.runtime.sendMessage({
							type: 'REQUEST_COMPLETED',
							requestId: requestId,
							request: stored[requestId],
						});
					} catch (error) {
						// Popup might not be open, that's okay
						debugLog(`📨 Could not notify popup: ${error}`);
					}
				}
			})
			.catch(console.error);
	},
	{ urls: ['<all_urls>'] }
);

// Enhanced message handling for communication with popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	debugLog(`📨 Received message: ${message.type}`);

	switch (message.type) {
		case 'GET_REQUESTS':
			getStoredRequests()
				.then((requests) => {
					debugLog(`📋 Sending ${Object.keys(requests).length} requests to popup`);
					sendResponse(requests);
				})
				.catch((error) => {
					debugLog(`❌ Error getting requests: ${error.message}`);
					sendResponse({});
				});
			return true; // Keep message channel open for async response

		case 'DELETE_REQUEST':
			(async () => {
				try {
					const stored = await getStoredRequests();
					delete stored[message.requestId];
					await chrome.storage.local.set({ capturedRequests: stored });
					debugLog(`🗑️ Deleted request: ${message.requestId}`);
					sendResponse({ success: true });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error deleting request: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'SAVE_OVERRIDE':
			(async () => {
				try {
					const stored = await getStoredRequests();
					if (stored[message.requestId]) {
						stored[message.requestId].overrideData = message.data;
						stored[message.requestId].isOverridden = true;
						stored[message.requestId].overrideUpdatedAt = Date.now();
						await storeRequest(stored[message.requestId]);
						// Apply a persistent DNR redirect for this URL
						try {
							await applyOverrideRule(stored[message.requestId].url, message.data);
						} catch (e) {
							debugLog(`❌ Failed to apply DNR override: ${e}`);
						}
						debugLog(`💾 Saved override for: ${stored[message.requestId].endpoint}`);
						sendResponse({ success: true });
					} else {
						debugLog(`❌ Request not found: ${message.requestId}`);
						sendResponse({ success: false, error: 'Request not found' });
					}
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error saving override: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'CLEAR_OVERRIDE':
			(async () => {
				try {
					const stored = await getStoredRequests();
					if (stored[message.requestId]) {
						delete stored[message.requestId].overrideData;
						stored[message.requestId].isOverridden = false;
						stored[message.requestId].overrideUpdatedAt = Date.now();
						await storeRequest(stored[message.requestId]);
						// Remove any DNR override rule for this URL
						try {
							await removeOverrideRuleByUrl(stored[message.requestId].url);
						} catch (e) {
							debugLog(`❌ Failed to remove DNR override: ${e}`);
						}
						debugLog(`🧹 Cleared override for: ${stored[message.requestId].endpoint}`);
						sendResponse({ success: true });
					} else {
						debugLog(`❌ Request not found: ${message.requestId}`);
						sendResponse({ success: false, error: 'Request not found' });
					}
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error clearing override: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'CHECK_OVERRIDE_STATUS':
			(async () => {
				try {
					const url = message.url as string;
					const key = normalizeUrlKey(url);
					const active = await getActiveOverrides();
					const ids = await getOverrideRuleIds();
					sendResponse({ success: true, data: { active: key in active, ruleId: ids[key] || null } });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'RESPONSE_CAPTURED':
			(async () => {
				try {
					const stored = await getStoredRequests();
					// Better matching: prefer the most recent request for the same URL (ignoring query)
					const urlNoQuery = (message.url || '').split('?')[0];
					const candidates = Object.values(stored).filter(
						(r: CapturedRequest) => r.url === message.url || r.url.split('?')[0] === urlNoQuery
					);

					let matchingRequest: CapturedRequest | undefined = undefined;
					if (candidates.length > 0) {
						// Prefer one without responseData yet
						const pending = candidates.filter((r) => r.responseData === undefined);
						const pool = pending.length > 0 ? pending : candidates;
						// If a timestamp from the page is provided, pick the closest earlier request
						if (message.timestamp) {
							pool.sort((a, b) => Math.abs((message.timestamp as number) - a.timestamp) - Math.abs((message.timestamp as number) - b.timestamp));
							matchingRequest = pool[0];
						} else {
							// Fallback to most recent
							pool.sort((a, b) => b.timestamp - a.timestamp);
							matchingRequest = pool[0];
						}
					}

					if (matchingRequest) {
						matchingRequest.responseData = message.data;
						await storeRequest(matchingRequest);
						debugLog(`📡 Captured response data for: ${matchingRequest.endpoint}`, {
							url: matchingRequest.url,
							size: typeof message.data === 'string' ? (message.data as string).length : undefined,
						});
					} else {
						debugLog(`❌ No matching request found for response: ${message.url}`);
					}
					sendResponse({ success: true });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error storing response data: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'DEBUG_INFO':
			(async () => {
				const stored = await getStoredRequests();
				const patterns = await getURLPatterns();
				const debugInfo = {
					totalRequests: Object.keys(stored).length,
					overriddenRequests: Object.values(stored).filter((r: CapturedRequest) => r.isOverridden).length,
					urlPatterns: patterns.length,
					enabledPatterns: patterns.filter((p) => p.enabled).length,
					recentRequests: Object.values(stored)
						.sort((a: CapturedRequest, b: CapturedRequest) => b.timestamp - a.timestamp)
						.slice(0, 5)
						.map((r: CapturedRequest) => ({ endpoint: r.endpoint, url: r.url, timestamp: r.timestamp })),
				};
				debugLog(`🔍 Debug info requested`, debugInfo);
				sendResponse(debugInfo);
			})();
			return true;

		case 'GET_URL_PATTERNS':
			(async () => {
				try {
					const patterns = await getURLPatterns();
					sendResponse({ success: true, data: patterns });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'ADD_URL_PATTERN':
			(async () => {
				try {
					if (!message.pattern) {
						sendResponse({ success: false, error: 'Pattern is required' });
						return;
					}

					const patterns = await getURLPatterns();
					const newPattern: URLPattern = {
						id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						pattern: message.pattern,
						enabled: true,
						createdAt: Date.now(),
					};

					patterns.push(newPattern);
					await storeURLPatterns(patterns);

					debugLog(`➕ Added URL pattern: ${message.pattern}`);
					sendResponse({ success: true, data: newPattern });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error adding pattern: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'DELETE_URL_PATTERN':
			(async () => {
				try {
					if (!message.patternId) {
						sendResponse({ success: false, error: 'Pattern ID is required' });
						return;
					}

					const patterns = await getURLPatterns();
					const filteredPatterns = patterns.filter((p) => p.id !== message.patternId);

					if (filteredPatterns.length === patterns.length) {
						sendResponse({ success: false, error: 'Pattern not found' });
						return;
					}

					await storeURLPatterns(filteredPatterns);
					debugLog(`🗑️ Deleted URL pattern: ${message.patternId}`);
					sendResponse({ success: true });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error deleting pattern: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'TOGGLE_URL_PATTERN':
			(async () => {
				try {
					if (!message.patternId) {
						sendResponse({ success: false, error: 'Pattern ID is required' });
						return;
					}

					const patterns = await getURLPatterns();
					const pattern = patterns.find((p) => p.id === message.patternId);

					if (!pattern) {
						sendResponse({ success: false, error: 'Pattern not found' });
						return;
					}

					pattern.enabled = message.enabled !== undefined ? message.enabled : !pattern.enabled;
					await storeURLPatterns(patterns);

					debugLog(`🔄 Toggled URL pattern: ${pattern.pattern} -> ${pattern.enabled}`);
					sendResponse({ success: true, data: pattern });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error toggling pattern: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'CLEAR_ALL_REQUESTS':
			(async () => {
				try {
					await chrome.storage.local.set({ capturedRequests: {} });
					debugLog(`🧹 Cleared all requests`);
					sendResponse({ success: true });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error clearing all requests: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'EDIT_URL_PATTERN':
			(async () => {
				try {
					if (!message.patternId || !message.pattern) {
						sendResponse({ success: false, error: 'Pattern ID and pattern are required' });
						return;
					}

					const patterns = await getURLPatterns();
					const patternIndex = patterns.findIndex((p) => p.id === message.patternId);

					if (patternIndex === -1) {
						sendResponse({ success: false, error: 'Pattern not found' });
						return;
					}

					patterns[patternIndex].pattern = message.pattern;
					await storeURLPatterns(patterns);

					debugLog(`✏️ Edited URL pattern: ${message.patternId} -> ${message.pattern}`);
					sendResponse({ success: true, data: patterns[patternIndex] });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error editing pattern: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		default:
			debugLog(`❌ Unknown message type: ${message.type}`);
			sendResponse({ error: 'Unknown message type' });
	}
});

// Set up tab tracking listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	activeTabId = activeInfo.tabId;
	debugLog(`📋 Tab activated: ${activeTabId}`);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete' && tab.active) {
		activeTabId = tabId;
		debugLog(`📋 Tab updated and active: ${activeTabId}`);
	}
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
	if (windowId !== chrome.windows.WINDOW_ID_NONE) {
		// Update active tab when window focus changes
		await updateActiveTab();
	}
});

// Initialize extension with enhanced logging
chrome.runtime.onInstalled.addListener((details) => {
	debugLog(`🚀 Metadata Wizard extension ${details.reason}`, {
		version: chrome.runtime.getManifest().version,
		reason: details.reason,
	});

	// Initialize active tab tracking
	updateActiveTab();

	// Clear captured requests but keep URL patterns on install/update
	if (details.reason === 'install' || details.reason === 'update') {
		// Only clear captured requests, preserve URL patterns
		chrome.storage.local.set({ capturedRequests: {} }).then(async () => {
			debugLog(`🧹 Cleared captured requests for fresh start`);
			// Ensure URL patterns are initialized (but don't overwrite existing ones)
			const patterns = await getURLPatterns();
			debugLog(`🔧 URL patterns loaded: ${patterns.length} patterns available`);
		});
	}
});

// Add startup logging
chrome.runtime.onStartup.addListener(() => {
	debugLog(`🔄 Extension service worker started`);
	// Initialize active tab tracking on startup
	updateActiveTab();
	// Re-apply any persisted DNR override rules
	(async () => {
		try {
			const active = await getActiveOverrides();
			const entries = Object.entries(active);
			if (entries.length === 0) return;
			debugLog(`♻️ Re-applying ${entries.length} override rule(s) at startup`);
			const addRules: chrome.declarativeNetRequest.Rule[] = entries.map(([key, payload]) => {
				const id = ruleIdFromKey(key);
				const regexFilter = buildRegexFilterForUrl(key);
				return {
					id,
					priority: 1,
					action: { type: chrome.declarativeNetRequest.RuleActionType.REDIRECT, redirect: { url: toDataUrl(payload) } },
					condition: {
						regexFilter,
						resourceTypes: [
							chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
							chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
							chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
							chrome.declarativeNetRequest.ResourceType.OTHER,
						],
					},
				};
			});
			// First remove any rules with those ids to avoid duplicates
			const removeRuleIds = addRules.map((r) => r.id);
			await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
			// Ensure ids map is up to date
			const ids: Record<string, number> = {};
			for (const [key] of entries) ids[key] = ruleIdFromKey(key);
			await setOverrideRuleIds(ids);
		} catch (e) {
			debugLog(`❌ Failed to re-apply override rules at startup: ${e}`);
		}
	})();
});

// Test the webRequest API on startup
debugLog(`🔧 Background script loaded. Testing webRequest API...`);
debugLog(`📋 Available chrome APIs:`, {
	webRequest: !!chrome.webRequest,
	storage: !!chrome.storage,
	runtime: !!chrome.runtime,
});
