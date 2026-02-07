/**
 * Type definitions for Metadata Wizard Chrome Extension
 */

export interface CapturedRequest {
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
	overrideUpdatedAt?: number; // timestamp when override was last saved
}

export interface StoredRequests {
	[key: string]: CapturedRequest;
}

export interface WizardURLPattern {
	id: string;
	pattern: string;
	enabled: boolean;
	createdAt: number;
}

export type BackgroundMessage =
	| { type: 'GET_REQUESTS' }
	| { type: 'GET_OVERRIDES' }
	| { type: 'DELETE_REQUEST'; requestId: string }
	| { type: 'SAVE_OVERRIDE'; requestId: string; data: any }
	| { type: 'CLEAR_OVERRIDE'; requestId: string }
	| { type: 'RESPONSE_CAPTURED'; requestId: string }
	| { type: 'REQUEST_COMPLETED'; requestId: string; request: CapturedRequest }
	| { type: 'DEBUG_INFO'; data: any }
	| { type: 'GET_URL_PATTERNS' }
	| { type: 'ADD_URL_PATTERN'; pattern: string }
	| { type: 'UPDATE_URL_PATTERN'; pattern: WizardURLPattern }
	| { type: 'DELETE_URL_PATTERN'; patternId: string }
	| { type: 'TOGGLE_URL_PATTERN'; patternId: string; enabled: boolean }
	| { type: 'CLEAR_ALL_REQUESTS' }
	| { type: 'PATTERNS_UPDATED' }
	| { type: 'EDIT_URL_PATTERN'; patternId: string; pattern: string; enabled: boolean }
	| { type: 'CHECK_OVERRIDE_STATUS'; url: string }
	| { type: 'TOGGLE_DISPLAY_MODE' }
	| { type: 'GET_DISPLAY_MODE' };

export interface BackgroundResponse {
	success?: boolean;
	error?: string;
	data?: any;
}
