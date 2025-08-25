// In content-script.js (replace everything)

/**
 * This script uses the chrome.scripting API to inject the
 * interceptor directly into the page's MAIN world, which is
 * more reliable than creating a <script> tag.
 */

// 1. Tell the background script to inject the interceptor
//    We have to do this via a message because content scripts
//    cannot directly call executeScript with the 'files' property.
chrome.runtime.sendMessage({ type: 'INJECT_SCRIPT' });

// 2. Listen for the custom event from the interceptor
window.addEventListener('RESPONSE_CAPTURED', function (event) {
	// 3. Relay the captured data back to the background script
	chrome.runtime.sendMessage({
		type: 'RESPONSE_CAPTURED',
		payload: event.detail,
	});
});
