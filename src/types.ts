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
	overrideData?: any;
	isOverridden: boolean;
	completed?: boolean;
	completedAt?: number;
}

export interface StoredRequests {
	[key: string]: CapturedRequest;
}

export interface URLPattern {
	id: string;
	pattern: string;
	enabled: boolean;
	createdAt: number;
}

export interface BackgroundMessage {
	type:
		| 'GET_REQUESTS'
		| 'DELETE_REQUEST'
		| 'SAVE_OVERRIDE'
		| 'CLEAR_OVERRIDE'
		| 'RESPONSE_CAPTURED'
		| 'REQUEST_COMPLETED'
		| 'DEBUG_INFO'
		| 'GET_URL_PATTERNS'
		| 'ADD_URL_PATTERN'
		| 'DELETE_URL_PATTERN'
		| 'TOGGLE_URL_PATTERN'
		| 'CLEAR_ALL_REQUESTS'
		| 'PATTERNS_UPDATED'
		| 'EDIT_URL_PATTERN';
	requestId?: string;
	data?: any;
	url?: string; // Added for RESPONSE_CAPTURED
	timestamp?: number; // Added for RESPONSE_CAPTURED
	request?: CapturedRequest; // Added for REQUEST_COMPLETED
	// URL Pattern management
	patternId?: string;
	pattern?: string;
	enabled?: boolean;
}

export interface BackgroundResponse {
	success?: boolean;
	error?: string;
	data?: any;
}
