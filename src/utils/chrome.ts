/**
 * Chrome extension utility functions
 */
import { BackgroundMessage, BackgroundResponse } from '../types';

/**
 * Send a message to the background script
 */
export async function sendMessageToBackground(message: BackgroundMessage): Promise<BackgroundResponse> {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(message, (response) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(response);
			}
		});
	});
}

/**
 * Get stored requests from chrome storage
 */
export async function getStoredRequests(): Promise<any> {
	try {
		const response = await sendMessageToBackground({ type: 'GET_REQUESTS' });
		return response;
	} catch (error) {
		console.error('Failed to get stored requests:', error);
		return {};
	}
}

/**
 * Delete a request
 */
export async function deleteRequest(requestId: string): Promise<boolean> {
	try {
		const response = await sendMessageToBackground({
			type: 'DELETE_REQUEST',
			requestId,
		});
		return response.success || false;
	} catch (error) {
		console.error('Failed to delete request:', error);
		return false;
	}
}

/**
 * Save override data for a request
 */
export async function saveOverride(requestId: string, data: any): Promise<boolean> {
	try {
		const response = await sendMessageToBackground({
			type: 'SAVE_OVERRIDE',
			requestId,
			data,
		});
		return response.success || false;
	} catch (error) {
		console.error('Failed to save override:', error);
		return false;
	}
}

/**
 * Clear override for a request
 */
export async function clearOverride(requestId: string): Promise<boolean> {
	try {
		const response = await sendMessageToBackground({
			type: 'CLEAR_OVERRIDE',
			requestId,
		});
		return response.success || false;
	} catch (error) {
		console.error('Failed to clear override:', error);
		return false;
	}
}

/**
 * Get active overrides
 */
export async function getOverrides(): Promise<string[]> {
	try {
		const response = await sendMessageToBackground({ type: 'GET_OVERRIDES' });
		return response as string[];
	} catch (error) {
		console.error('Failed to get overrides:', error);
		return [];
	}
}
