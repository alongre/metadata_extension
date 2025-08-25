/**
 * Background Service Worker for Metadata Wizard Chrome Extension
 * Handles webRequest interception and storage of API calls with configurable URL patterns
 * Intercepts requests in all tabs that match user URL patterns
 */

console.log('SUCCESS: background.js service worker has started!');

// Track the active tab
let activeTabId: number = 0;

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

// Storage helper functions
// async function getStoredRequests(): Promise<StoredRequests> {
// 	const result = await chrome.storage.local.get('capturedRequests');
// 	return result.capturedRequests || {};
// }

// async function storeRequest(request: CapturedRequest): Promise<void> {
// 	const stored = await getStoredRequests();
// 	console.log('--------stored requests------', stored);
// 	if (!stored[request.id]) {
// 		stored[request.id] = request;
// 		await chrome.storage.local.set({ capturedRequests: stored });
// 	} else {
// 		console.log(`already stored ${request.id}`);
// 	}
// }

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
	// const parts = url.split('/').filter((part) => part.length > 0);

	// 2. Take all parts after the domain (i.e., from the 4th part onwards)
	//    The first three parts are the protocol and the domain.
	//    Gives: ["rest", "reports-metadata"]
	// const pathParts = parts.slice(3);

	// 3. Join the parts back together with '/' and add the leading slash
	//    Gives: "/rest/reports-metadata"
	// return '/' + pathParts.join('/');
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

// Tab tracking functions
async function updateActiveTab() {
	try {
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tabs.length > 0) {
			activeTabId = tabs[0].id || 0;
			debugLog(`📋 Active tab updated: ${activeTabId}`);
			// addWebRequestListener(activeTabId);
		}
	} catch (error) {
		debugLog(`❌ Error getting active tab: ${error}`);
		activeTabId = 0;
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

// function addWebRequestListener(tabId: number) {
// 	// 	// Remove any existing listener
// 	if (currentListener) {
// 		chrome.webRequest.onBeforeRequest.removeListener(currentListener);
// 	}

// 	// Define the new listener
// 	currentListener = function (details) {
// 		console.log(`Request made by active tab ${tabId}:`, details);
// 		// You can modify the request here if needed
// 		return { cancel: false }; // or {cancel: true} to block
// 	};

// 	// Add the listener
// 	chrome.webRequest.onBeforeRequest.addListener(
// 		(details) => {
// 			// Process requests from all tabs
// 			debugLog(`🔍 Checking request: ${details.url}`);

// 			// Handle async pattern matching
// 			isTargetEndpoint(details.url)
// 				.then((matchResult) => {
// 					if (!matchResult.isMatch) {
// 						return; // Skip non-matching requests silently
// 					}

// 					debugLog(`✅ Target endpoint detected: ${details.url} (pattern: ${matchResult.matchedPattern})`);

// 					const requestId = generateRequestId(details.url, details.timeStamp);
// 					const endpoint = extractEndpointName(details.url);

// 					const capturedRequest: CapturedRequest = {
// 						id: requestId,
// 						url: details.url,
// 						endpoint,
// 						method: details.method,
// 						timestamp: details.timeStamp,
// 						isOverridden: false,
// 						// Attempt to capture request body when present
// 						requestBody: decodeRequestBody(details.requestBody ?? undefined),
// 					};

// 					// Store request asynchronously
// 					storeRequest(capturedRequest)
// 						.then(() => {
// 							debugLog(`💾 Stored request: ${endpoint}`, capturedRequest);
// 						})
// 						.catch((error) => {
// 							debugLog(`❌ Failed to store request: ${error.message}`);
// 						});
// 				})
// 				.catch((error) => {
// 					debugLog(`❌ Error checking endpoint: ${error.message}`);
// 				});
// 		},
// 		{ urls: ['<all_urls>'], tabId },
// 		['blocking', 'requestBody']
// 	);
// }

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

	// 5. (Optional but recommended) Reset the override state on all historical requests.
	// await acquireLock();
	// try {
	//     const stored = await getStoredRequests();
	//     let updated = false;
	//     for (const requestId in stored) {
	//         if (stored[requestId].isOverridden) {
	//             stored[requestId].isOverridden = false;
	//             stored[requestId].overrideData = undefined;
	//             updated = true;
	//         }
	//     }
	//     if (updated) {
	//         await chrome.storage.local.set({ [CAPTURED_REQUESTS_KEY]: stored });
	//     }
	// } finally {
	//     releaseLock();
	// }

	console.log('✅ All overrides and DNR rules have been cleared.');
}

// Set up webRequest listeners with enhanced debugging

// chrome.webRequest.onBeforeSendHeaders.addListener(
// 	(details) => {
// 		isTargetEndpoint(details.url)
// 			.then((matchResult) => {
// 				if (!matchResult.isMatch) {
// 					return;
// 				}

// 				const requestId = generateRequestId(details.url, details.timeStamp);

// 				// Store headers asynchronously
// 				getStoredRequests()
// 					.then((stored) => {
// 						if (stored[requestId]) {
// 							stored[requestId].requestHeaders = details.requestHeaders;
// 							storeRequest(stored[requestId])
// 								.then(() => {
// 									debugLog(`📋 Updated headers for: ${stored[requestId].endpoint}`);
// 								})
// 								.catch(console.error);
// 						}
// 					})
// 					.catch(console.error);
// 			})
// 			.catch(console.error);
// 	},
// 	{ urls: ['<all_urls>'] },
// 	['requestHeaders']
// );

// Enhanced response monitoring
// chrome.webRequest.onResponseStarted.addListener(
// 	(details) => {
// 		isTargetEndpoint(details.url)
// 			.then(async (matchResult) => {
// 				if (!matchResult.isMatch) {
// 					return;
// 				}

// 				const requestId = generateRequestId(details.url, details.timeStamp);
// 				const stored = await getStoredRequests();

// 				if (stored[requestId]) {
// 					debugLog(`📡 Response started for: ${stored[requestId].endpoint}`, {
// 						status: details.statusCode,
// 						responseHeaders: details.responseHeaders?.slice(0, 3), // Log first 3 headers
// 					});

// 					// Store response metadata
// 					stored[requestId].responseStatus = details.statusCode;
// 					stored[requestId].responseHeaders = details.responseHeaders;
// 					await storeRequest(stored[requestId]);
// 				}
// 			})
// 			.catch(console.error);
// 	},
// 	{ urls: ['<all_urls>'] },
// 	['responseHeaders']
// );

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
// chrome.webRequest.onCompleted.addListener(
// 	(details) => {
// 		(async () => {
// 			try {
// 				const matchResult = await isTargetEndpoint(details.url);
// 				if (!matchResult.isMatch) {
// 					return;
// 				}

// 				// const requestId (= generateRequestId(details.url, details.timeStamp);
// 				const endpoint = extractEndpointName(details.url);
// 				const stored = await getStoredRequests();

// 				if (stored[endpoint]) {
// 					debugLog(`✅ Request completed: ${endpoint}`, {
// 						status: details.statusCode,
// 						fromCache: details.fromCache,
// 					});

// 					const requestId = generateRequestId(details.url, details.timeStamp);
// 					const stored = await getStoredRequests();

// 					if (stored[requestId]) {
// 						debugLog(`✅ Request completed: ${stored[requestId].endpoint}`, {
// 							status: details.statusCode,
// 							fromCache: details.fromCache,
// 						});

// 						// Update completion status
// 						stored[requestId].completed = true;
// 						stored[requestId].completedAt = Date.now();
// 						// Notify popup about new request (if popup is open)
// 						try {
// 							chrome.runtime.sendMessage({
// 								type: 'REQUEST_COMPLETED',
// 								requestId: requestId,
// 								request: stored[requestId],
// 							});
// 						} catch (error) {
// 							// Popup might not be open, that's okay
// 							debugLog(`📨 Could not notify popup: ${error}`);
// 						}
// 					}
// 				}
// 			} catch (error) {
// 				console.error(`❌ Error processing request: ${error instanceof Error ? error.message : String(error)}`);
// 			}
// 		})();
// 		return {};
// 	},
// 	{ urls: ['<all_urls>'] }
// );
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
					const stored = await getStoredRequests();
					const requestToUpdate = stored[message.requestId];
					if (stored[message.requestId]) {
						delete stored[message.requestId].overrideData;
						stored[message.requestId].isOverridden = false;
						stored[message.requestId].overrideUpdatedAt = Date.now();
						await saveRequest(message.requestId, stored[message.requestId]);
						// Remove any DNR override rule for this URL
						try {
							// 2. Remove the ID from the active overrides index
							const active = await getActiveOverrides();
							delete active[message.requestId];
							await chrome.storage.local.set({ [ACTIVE_OVERRIDES_KEY]: active });

							// 3. Remove the DNR rule
							await removeDnrRuleByUrl(requestToUpdate.url);
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
					// const requestId = generateRequestId(details.url, details.timeStamp);
					// const requestId = extractEndpointName(url); // Use the same ID logic
					// Check if the requestId contains in the stored requests

					if (stored[requestId]) {
						stored[requestId].responseData = data;
						await saveRequest(requestId, {
							responseData: data,
						});
						// Here's the body!
						// await storeRequest(stored[requestId]);
						console.log('RESPONSE_CAPTURED stored', stored[requestId]);
						debugLog(`📡 Captured response body for: ${requestId}`);
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
	// addWebRequestListener(activeTabId);
});

// chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
// 	if (changeInfo.status === 'complete' && tab.active) {
// 		activeTabId = tabId;
// 		debugLog(`📋 Tab updated and active: ${activeTabId}`);
// 	}
// });

// chrome.windows.onFocusChanged.addListener(async (windowId) => {
// 	if (windowId !== chrome.windows.WINDOW_ID_NONE) {
// 		// Update active tab when window focus changes
// 		await updateActiveTab();
// 	}
// });

// Initialize extension with enhanced logging
// chrome.runtime.onInstalled.addListener((details) => {
// 	debugLog(`🚀 Metadata Wizard extension ${details.reason}`, {
// 		version: chrome.runtime.getManifest().version,
// 		reason: details.reason,
// 	});

// 	// Initialize active tab tracking
// 	updateActiveTab();

// 	// Clear captured requests but keep URL patterns on install/update
// 	if (details.reason === 'install' || details.reason === 'update') {
// 		// Only clear captured requests, preserve URL patterns
// 		chrome.storage.local.set({ capturedRequests: {} }).then(async () => {
// 			debugLog(`🧹 Cleared captured requests for fresh start`);
// 			// Ensure URL patterns are initialized (but don't overwrite existing ones)
// 			const patterns = await getURLPatterns();
// 			debugLog(`🔧 URL patterns loaded: ${patterns.length} patterns available`);
// 		});
// 	}
// });

// Add startup logging
// --- Startup Listener (Rewritten for Normalized Data) ---
// chrome.runtime.onStartup.addListener(() => {
// 	console.log('🔄 Extension starting up. Re-applying active DNR rules...');
// 	(async () => {
// 		try {
// 			// 1. Get the map of active override IDs
// 			const activeOverrideIds = await getActiveOverrides();

// 			if (Object.keys(activeOverrideIds).length === 0) {
// 				console.log('No active overrides to apply.');
// 				return;
// 			}

// 			// 2. Get the full log of all requests to find the payloads
// 			const allRequests = await getStoredRequests();

// 			const rulesToAdd: chrome.declarativeNetRequest.Rule[] = [];

// 			// 3. Loop through ONLY the active IDs
// 			for (const requestId in activeOverrideIds) {
// 				const request = allRequests[requestId];
// 				// Find the corresponding request and ensure it has override data
// 				if (request && request.isOverridden && request.overrideData) {
// 					const urlKey = normalizeUrlKey(request.url);
// 					const rule: chrome.declarativeNetRequest.Rule = {
// 						id: ruleIdFromKey(urlKey),
// 						priority: 1,
// 						action: {
// 							type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
// 							redirect: { url: toDataUrl(request.overrideData) },
// 						},
// 						condition: {
// 							regexFilter: `^${urlKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?.*)?$`,
// 							resourceTypes: [
// 								chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
// 								chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
// 								chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
// 								chrome.declarativeNetRequest.ResourceType.OTHER,
// 							],
// 						},
// 					};
// 					rulesToAdd.push(rule);
// 				}
// 			}

// 			if (rulesToAdd.length > 0) {
// 				const ruleIdsToRemove = rulesToAdd.map((rule) => rule.id);
// 				console.log(`♻️ Re-applying ${rulesToAdd.length} override rule(s)...`);
// 				// Atomically update the DNR rules
// 				await chrome.declarativeNetRequest.updateDynamicRules({
// 					removeRuleIds: ruleIdsToRemove,
// 					addRules: rulesToAdd,
// 				});
// 			}
// 		} catch (e) {
// 			console.error(`❌ Failed to re-apply override rules at startup:`, e);
// 		}
// 	})();
// });

// Test the webRequest API on startup
debugLog(`🔧 Background script loaded. Testing webRequest API...`);
debugLog(`📋 Available chrome APIs:`, {
	webRequest: !!chrome.webRequest,
	storage: !!chrome.storage,
	runtime: !!chrome.runtime,
});
