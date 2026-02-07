/**
 * Background Service Worker for Metadata Wizard Chrome Extension
 * Handles webRequest interception and storage of API calls with configurable URL patterns
 * Intercepts requests in all tabs that match user URL patterns
 */

console.log('SUCCESS: background.js service worker has started!');

type ResolveFunction = () => void;

const storageLock = {
	isLocked: false,
	queue: [] as ResolveFunction[],
};

function acquireLock(): Promise<void> {
	return new Promise<void>((resolve) => {
		if (!storageLock.isLocked) {
			storageLock.isLocked = true;
			resolve();
		} else {
			storageLock.queue.push(resolve);
		}
	});
}

function releaseLock(): void {
	if (storageLock.queue.length > 0) {
		const nextResolve = storageLock.queue.shift();
		if (nextResolve) {
			nextResolve();
		}
	} else {
		storageLock.isLocked = false;
	}
}

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
	responseDataRaw?: string; // Raw response text to preserve key order
	originalResponseData?: any; // Snapshot of responseData before first override
	originalResponseDataRaw?: string; // Snapshot of responseDataRaw before first override
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

async function getStoredRequests(): Promise<StoredRequests> {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('capturedRequests', (result) => {
			if (chrome.runtime.lastError) {
				return reject(chrome.runtime.lastError);
			}
			resolve(result.capturedRequests || {});
		});
	});
}

async function saveRequest(requestId: string, data: any) {
	if (!requestId) {
		console.error('❌ saveRequest called with no requestId.');
		return;
	}
	await acquireLock();
	try {
		const stored = await getStoredRequests();
		const existingRequest = stored[requestId];

		if (existingRequest) {
			// It exists, so we MERGE the new data in.
			Object.assign(existingRequest, data);
		} else {
			// It's a new request, so we ADD it.
			stored[requestId] = data;
		}

		// Now, save the entire updated map back to storage
		await chrome.storage.local.set({ capturedRequests: stored });
		console.log(`✅ Request ${requestId} saved/updated with:`, data);
	} catch (error) {
		console.error(`❌ Failed to save request ${requestId}:`, error);
	} finally {
		releaseLock();
	}
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
//remove the last / if it exists
function generateRequestId(url: string): string {
	// remove the last / if it exists
	url = url.endsWith('/') ? url.slice(0, -1) : url;
	return url;
}

// Extract endpoint name from URL - get the last segment of the URL path
function extractEndpointName(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathParts = urlObj.pathname.split('/').filter((part) => part.length > 0); // Remove empty parts
		if (pathParts.length > 0) {
			// Return the last non-empty segment
			// if the last string is / remove it
			const lastSegment = pathParts[pathParts.length - 1];
			return lastSegment.endsWith('/') ? lastSegment.slice(0, -1) : lastSegment;
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
	console.log({ patterns });
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

// --- DNR Helper Functions ---
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
	const b64 = btoa(unescape(encodeURIComponent(text)));
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
	return Math.abs(hash) % 2000000000 || 1;
}

// --- DNR Rule Application/Removal (Refactored) ---
async function applyDnrRule(url: string, payload: any): Promise<void> {
	const urlKey = normalizeUrlKey(url);
	const id = ruleIdFromKey(urlKey);
	const rule: chrome.declarativeNetRequest.Rule = {
		id,
		priority: 1,
		action: {
			type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
			redirect: { url: toDataUrl(payload) },
		},
		condition: {
			regexFilter: `^${urlKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?.*)?$`,
			resourceTypes: [
				chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
				chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
				chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
				chrome.declarativeNetRequest.ResourceType.OTHER,
			],
		},
	};
	await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [id], addRules: [rule] });
	const ids = await getOverrideRuleIds();
	ids[urlKey] = id;
	await chrome.storage.local.set({ [OVERRIDE_RULE_IDS_KEY]: ids });
	console.log(`🧩 Applied DNR rule for ${urlKey}`);
}

async function removeDnrRuleByUrl(url: string): Promise<void> {
	const urlKey = normalizeUrlKey(url);
	const ids = await getOverrideRuleIds();
	const id = ids[urlKey];
	if (id) {
		await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [id], addRules: [] });
		delete ids[urlKey];
		await chrome.storage.local.set({ [OVERRIDE_RULE_IDS_KEY]: ids });
		console.log(`🧹 Removed DNR rule for ${urlKey}`);
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

let currentListener: (details: chrome.webRequest.WebRequestDetails) => void;

// In background.js

chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
		// Use an IIFE to handle the async logic without blocking the listener
		(async () => {
			try {
				const matchResult = await isTargetEndpoint(details.url);
				if (!matchResult.isMatch) {
					return;
				}
				// 1. First, check if an override is already active for this URL.
				const capturedRequests = await getStoredRequests();
				const requestId = generateRequestId(details.url); // Assuming URL is the ID

				// 2. If an override is active, DO NOTHING.
				// This prevents us from overwriting the stored request that contains the valuable overrideData.
				// The DNR rule will handle the redirect.
				if (capturedRequests[requestId]) {
					console.log(`[onBeforeRequest] Ignored request for already-captured URL: ${requestId}`);
					return;
				}

				// 3. If no override is active, proceed as normal.
				const endpoint = extractEndpointName(details.url);

				const newRequest: CapturedRequest = {
					id: requestId,
					url: details.url,
					endpoint: endpoint,
					method: details.method,
					timestamp: details.timeStamp,
					requestBody: details.requestBody ? new TextDecoder().decode(details.requestBody.raw?.[0]?.bytes) : undefined,
					isOverridden: false,
					completed: false,
					responseData: undefined,
					overrideData: undefined,
				};

				await saveRequest(requestId, newRequest);
			} catch (e) {
				console.error(`[onBeforeRequest] Error processing request:`, e);
			}
		})();

		return {}; // Non-blocking
	},
	{ urls: ['<all_urls>'] },
	['requestBody']
);

/**
 * Removes all active DNR rules created by this extension and clears
 * the corresponding override flags and indexes from storage.
 */
async function clearAllDnrOverrides() {
	// 1. Get all currently active DNR rules from Chrome.
	const allActiveRules = await chrome.declarativeNetRequest.getDynamicRules();

	if (allActiveRules.length === 0) {
		console.log('No active DNR rules to clear.');
	} else {
		// 2. Create a list of all the rule IDs to be removed.
		const ruleIdsToRemove = allActiveRules.map((rule) => rule.id);
		console.log(`🧹 Clearing all ${ruleIdsToRemove.length} DNR rules...`);

		// 3. Command Chrome to remove all of them in one go.
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: ruleIdsToRemove,
			addRules: [],
		});
	}

	// 4. Wipe your own internal records related to overrides.
	await chrome.storage.local.set({
		[ACTIVE_OVERRIDES_KEY]: {},
		[OVERRIDE_RULE_IDS_KEY]: {},
	});

	console.log('✅ All overrides and DNR rules have been cleared.');
}

chrome.webRequest.onCompleted.addListener(
	(details) => {
		return (async () => {
			try {
				const matchResult = await isTargetEndpoint(details.url);
				if (!matchResult.isMatch) {
					return;
				}

				// the requestId is the url after the domain
				const requestId = generateRequestId(details.url);
				const endpoint = extractEndpointName(details.url);
				const stored = await getStoredRequests();

				if (stored[requestId]) {
					debugLog(`✅ Request completed: ${endpoint}`, {
						status: details.statusCode,
						fromCache: details.fromCache,
					});

					// Update completion status
					stored[requestId].completed = true;
					stored[requestId].completedAt = Date.now();
					await saveRequest(requestId, {
						completed: true,
						completedAt: Date.now(),
						responseStatus: details.statusCode,
					});

					// Notify popup about new request (if popup is open)
					try {
						chrome.runtime.sendMessage({
							type: 'REQUEST_COMPLETED',
							endpoint,
							request: stored[requestId],
						});
					} catch (error) {
						// Popup might not be open, that's okay
						debugLog(`📨 Could not notify popup: ${error}`);
					}
				}
			} catch (error) {
				console.error(`❌ Error processing request: ${error instanceof Error ? error.message : String(error)}`);
			}
		})();

		// Return an empty object to ensure the listener does not block the request
		return {};
	},
	{ urls: ['<all_urls>'] },
	['responseHeaders']
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
					// Also remove from pinned list
					const pinResult = await chrome.storage.local.get('pinnedRequestIds');
					const pinned: string[] = pinResult.pinnedRequestIds || [];
					const filteredPinned = pinned.filter((id: string) => id !== message.requestId);
					if (filteredPinned.length !== pinned.length) {
						await chrome.storage.local.set({ pinnedRequestIds: filteredPinned });
					}
					debugLog(`🗑️ Deleted request: ${message.requestId}`);
					sendResponse({ success: true });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error deleting request: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;
		case 'INJECT_SCRIPT':
			if (_sender.tab?.id) {
				chrome.scripting.executeScript({
					target: { tabId: _sender.tab.id, allFrames: true },
					files: ['pageInterceptor.js'],
					injectImmediately: true, // Attempts to run before page scripts
					world: 'MAIN',
				});
			}
			break;

		case 'SAVE_OVERRIDE':
			(async () => {
				try {
					const stored = await getStoredRequests();
					const requestToUpdate = stored[message.requestId];
					if (stored[message.requestId]) {
						// Snapshot the original response data before the first override
						// so we can restore it when the override is cleared
						if (!stored[message.requestId].isOverridden) {
							stored[message.requestId].originalResponseData = stored[message.requestId].responseData;
							stored[message.requestId].originalResponseDataRaw = stored[message.requestId].responseDataRaw;
						}
						stored[message.requestId].overrideData = message.data;
						stored[message.requestId].isOverridden = true;
						stored[message.requestId].overrideUpdatedAt = Date.now();
						await saveRequest(message.requestId, stored[message.requestId]);
						// Apply a persistent DNR redirect for this URL
						try {
							const active = await getActiveOverrides();
							active[message.requestId] = true;
							await chrome.storage.local.set({ [ACTIVE_OVERRIDES_KEY]: active });

							// 3. Apply the DNR rule using the stored URL and new data
							await applyDnrRule(requestToUpdate.url, message.data);
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
					await acquireLock();
					let stored: StoredRequests;
					let requestToUpdate: CapturedRequest | undefined;
					try {
						stored = await getStoredRequests();
						requestToUpdate = stored[message.requestId];
						if (stored[message.requestId]) {
							delete stored[message.requestId].overrideData;
							stored[message.requestId].isOverridden = false;
							stored[message.requestId].overrideUpdatedAt = Date.now();
							// Restore the original response data if we have a snapshot
							if (stored[message.requestId].originalResponseData !== undefined) {
								stored[message.requestId].responseData = stored[message.requestId].originalResponseData;
								stored[message.requestId].responseDataRaw = stored[message.requestId].originalResponseDataRaw;
								delete stored[message.requestId].originalResponseData;
								delete stored[message.requestId].originalResponseDataRaw;
							}
							// Write directly to storage (not via saveRequest which merges
							// and won't remove deleted properties like overrideData)
							await chrome.storage.local.set({ capturedRequests: stored });
						}
					} finally {
						releaseLock();
					}
					if (requestToUpdate) {
						// Remove any DNR override rule for this URL
						try {
							const active = await getActiveOverrides();
							delete active[message.requestId];
							await chrome.storage.local.set({ [ACTIVE_OVERRIDES_KEY]: active });
							await removeDnrRuleByUrl(requestToUpdate.url);
						} catch (e) {
							debugLog(`❌ Failed to remove DNR override: ${e}`);
						}
						debugLog(`🧹 Cleared override for: ${stored![message.requestId]?.endpoint}`);
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
		case 'CLEAR_ALL_OVERRIDES':
			(async () => {
				try {
					await clearAllDnrOverrides();
					sendResponse({ success: true });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					console.error('Failed to clear all overrides:', errorMsg);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true; // Keep channel open for async response

		case 'CHECK_OVERRIDE_STATUS':
			(async () => {
				try {
					const url = message.url as string;
					const requestId = generateRequestId(url);
					const stored = await getStoredRequests();
					if (stored[requestId]) {
						sendResponse({ success: true, data: { active: stored[requestId].isOverridden } });
					} else {
						sendResponse({ success: false, error: 'Request not found' });
					}
					// const key = normalizeUrlKey(url);
					// const active = await getActiveOverrides();
					// const ids = await getOverrideRuleIds();
					// sendResponse({ success: true, data: { active: key in active, ruleId: ids[key] || null } });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'GET_OVERRIDES':
			(async () => {
				const active = await getActiveOverrides();
				sendResponse({ success: true, data: Object.keys(active) });
			})();
			return true;
		case 'RESPONSE_CAPTURED':
			(async () => {
				try {
					const { url, data } = message.payload;
					const requestId = generateRequestId(url);

					const stored = await getStoredRequests();
					debugLog(`📡 RESPONSE_CAPTURED 👉 Captured response body for: ${requestId}`);

					// Store the raw response text to preserve key order
					let responseDataRaw = '';
					let responseData = data;

					if (typeof data === 'string') {
						// Data is already a string - perfect for preserving key order
						responseDataRaw = data;
						responseData = data;
					} else {
						// If it's already an object, stringify it
						responseDataRaw = JSON.stringify(data);
						responseData = data;
						debugLog(`⚠️ Response data was an object, converting to string`);
					}

					if (stored[requestId]) {
						// If the request has an active override, don't overwrite the
						// original responseData — the interceptor may have captured the
						// redirected override payload instead of the real server response.
						if (stored[requestId].isOverridden) {
							debugLog(`⏭️ Skipping response update for overridden request: ${requestId}`);
						} else {
							stored[requestId].responseData = responseData;
							stored[requestId].responseDataRaw = responseDataRaw;
							await saveRequest(requestId, {
								responseData: responseData,
								responseDataRaw: responseDataRaw,
							});
							debugLog(`📡 Captured response body for: ${requestId} (raw preserved: ${responseDataRaw.length} chars)`);
						}
					} else {
						debugLog(`❌ No matching request found in storage for response: ${url}`);
					}
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error storing response data: ${errorMsg}`);
				}
			})();
			sendResponse({ success: true });
			return true; // Indicate

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
					await chrome.storage.local.set({ capturedRequests: {}, pinnedRequestIds: [] });
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

		case 'GET_DISPLAY_MODE':
			(async () => {
				try {
					const mode = await getDisplayMode();
					sendResponse({ success: true, data: mode });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'TOGGLE_DISPLAY_MODE':
			(async () => {
				try {
					await toggleDisplayMode();
					const newMode = await getDisplayMode();
					sendResponse({ success: true, data: newMode });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					debugLog(`❌ Error toggling display mode: ${errorMsg}`);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'GET_PINNED_REQUESTS':
			(async () => {
				try {
					const result = await chrome.storage.local.get('pinnedRequestIds');
					sendResponse({ success: true, data: result.pinnedRequestIds || [] });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		case 'SET_PINNED_REQUESTS':
			(async () => {
				try {
					await chrome.storage.local.set({ pinnedRequestIds: message.pinnedRequestIds });
					sendResponse({ success: true });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					sendResponse({ success: false, error: errorMsg });
				}
			})();
			return true;

		default:
			debugLog(`❌ Unknown message type: ${message.type}`);
			sendResponse({ error: 'Unknown message type' });
	}
});

// Test the webRequest API on startup
debugLog(`🔧 Background script loaded. Testing webRequest API...`);
debugLog(`📋 Available chrome APIs:`, {
	webRequest: !!chrome.webRequest,
	storage: !!chrome.storage,
	runtime: !!chrome.runtime,
});

// Track the popup window
let popupWindowId: number | null = null;

// Display mode storage key
const DISPLAY_MODE_KEY = 'displayMode';

// Get current display mode from storage
async function getDisplayMode(): Promise<'docked' | 'undocked'> {
	const result = await chrome.storage.local.get(DISPLAY_MODE_KEY);
	return result[DISPLAY_MODE_KEY] || 'docked';
}

// Set display mode in storage
async function setDisplayMode(mode: 'docked' | 'undocked'): Promise<void> {
	await chrome.storage.local.set({ [DISPLAY_MODE_KEY]: mode });
}

// Configure display mode on startup
async function configureDisplayMode() {
	const mode = await getDisplayMode();
	if (mode === 'undocked') {
		// Remove default popup and register click listener
		await chrome.action.setPopup({ popup: '' });
	} else {
		// Set default popup for docked mode
		await chrome.action.setPopup({ popup: 'popup.html' });
	}
	debugLog(`🔧 Configured display mode: ${mode}`);
}

// Initialize display mode on startup
configureDisplayMode();

// Handle display mode toggle
async function toggleDisplayMode() {
	const currentMode = await getDisplayMode();
	const newMode = currentMode === 'docked' ? 'undocked' : 'docked';

	if (newMode === 'undocked') {
		// Switch to undocked mode
		await chrome.action.setPopup({ popup: '' });
		await setDisplayMode('undocked');

		// Close any existing popup window first
		if (popupWindowId !== null) {
			try {
				await chrome.windows.remove(popupWindowId);
				popupWindowId = null;
			} catch (error) {
				// Window might not exist
				popupWindowId = null;
			}
		}

		// Open standalone window
		const window = await chrome.windows.create({
			url: 'popup.html',
			type: 'popup',
			width: 800,
			height: 600,
			left: 100,
			top: 100,
			focused: true,
		});

		if (window.id) {
			popupWindowId = window.id;
			// Force the window size after creation
			setTimeout(() => {
				if (popupWindowId) {
					chrome.windows.update(popupWindowId, {
						width: 800,
						height: 600,
						left: 100,
						top: 100,
					});
				}
			}, 100);
		}
	} else {
		// Switch to docked mode
		await chrome.action.setPopup({ popup: 'popup.html' });
		await setDisplayMode('docked');

		// Close standalone window if it exists
		if (popupWindowId !== null) {
			try {
				await chrome.windows.remove(popupWindowId);
			} catch (error) {
				// Window might not exist
			}
			popupWindowId = null;
		}
	}

	debugLog(`🔄 Toggled display mode to: ${newMode}`);
}

// Open the popup when the extension icon is clicked (only fires when popup is not set)
chrome.action.onClicked.addListener(async () => {
	try {
		// This listener only fires when in undocked mode
		// Check if popup window already exists
		if (popupWindowId !== null) {
			try {
				const existingWindow = await chrome.windows.get(popupWindowId);
				if (existingWindow) {
					// Focus the existing window
					await chrome.windows.update(popupWindowId, { focused: true });
					return;
				}
			} catch (error) {
				// Window doesn't exist anymore, clear the reference
				popupWindowId = null;
			}
		}

		// Create new popup window
		const window = await chrome.windows.create({
			url: 'popup.html',
			type: 'popup',
			width: 800,
			height: 600,
			left: 100,
			top: 100,
			focused: true,
		});

		if (window.id) {
			popupWindowId = window.id;
			// Force the window size after creation
			setTimeout(() => {
				if (popupWindowId) {
					chrome.windows.update(popupWindowId, {
						width: 800,
						height: 600,
						left: 100,
						top: 100,
					});
				}
			}, 100);
		}
	} catch (error) {
		console.error('Failed to create popup window:', error);
	}
});

// Clean up window reference when closed
chrome.windows.onRemoved.addListener((windowId) => {
	if (windowId === popupWindowId) {
		popupWindowId = null;
	}
});
