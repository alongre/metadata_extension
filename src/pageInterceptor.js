// In a new file named pageInterceptor.js

/**
 * This script is injected into the page's MAIN world to intercept
 * fetch and XHR calls. It communicates back to the content script
 * via custom DOM events.
 */
(function () {
	// --- Intercept Fetch API ---
	const originalFetch = window.fetch;
	window.fetch = async function (...args) {
		const response = await originalFetch(...args);

		const clonedResponse = response.clone();

		clonedResponse
			.text()
			.then((body) => {
				if (clonedResponse.url) {
					// Store raw text to preserve key order from server
					window.dispatchEvent(
						new CustomEvent('RESPONSE_CAPTURED', {
							detail: {
								type: 'FETCH',
								requestId: clonedResponse.url,
								url: clonedResponse.url,
								data: body, // Store as raw string
								isRawText: true, // Flag to indicate raw text
								timestamp: Date.now(),
							},
						})
					);
				}
			})
			.catch((err) => {
				/* Ignore errors for non-text responses */
			});

		return response;
	};

	// --- Intercept XMLHttpRequest ---
	const originalXhrOpen = XMLHttpRequest.prototype.open;
	const originalXhrSend = XMLHttpRequest.prototype.send;

	XMLHttpRequest.prototype.open = function (...args) {
		// Store the URL from the open call. This might be relative.
		this._requestURL = args[1];
		return originalXhrOpen.apply(this, args);
	};

	XMLHttpRequest.prototype.send = function (...args) {
		this.addEventListener('load', () => {
			let fullUrl;
			try {
				fullUrl = new URL(this._requestURL, window.location.href).href;
			} catch (error) {
				// If the URL is malformed, fallback to the original string.
				console.error(`[Interceptor] Could not parse XHR URL: ${this._requestURL}`, error);
				fullUrl = this._requestURL;
			}

			if (fullUrl) {
				// Store as raw text to preserve key order
				let responseData = this.response;
				let isRawText = false;

				// If response is already a string, use it directly
				if (typeof responseData === 'string') {
					isRawText = true;
				} else if (this.responseType === '' || this.responseType === 'text') {
					// Default responseType treats as text
					responseData = this.responseText;
					isRawText = true;
				} else if (this.responseType === 'json') {
					// If it's JSON type, get the raw text instead
					try {
						responseData = this.responseText;
						isRawText = true;
					} catch (e) {
						// Fallback to parsed response
						responseData = this.response;
					}
				}

				window.dispatchEvent(
					new CustomEvent('RESPONSE_CAPTURED', {
						detail: {
							type: 'XHR',
							requestId: fullUrl,
							url: fullUrl,
							data: responseData,
							isRawText: isRawText,
							timestamp: Date.now(),
						},
					})
				);
			}
		});
		return originalXhrSend.apply(this, args);
	};
})();
