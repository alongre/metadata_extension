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
		// alert('--------------fetch captured for---------' + response.url);
		const clonedResponse = response.clone();
		console.log('--------------fetch captured for---------', clonedResponse.url);
		// const requestId = generateRequestId(clonedResponse.url, Date.now());

		clonedResponse
			.text()
			.then((body) => {
				if (clonedResponse.url) {
					console.log('------dispatching custum event for---------', clonedResponse.url);
					// Dispatch a custom event with the captured data
					window.dispatchEvent(
						new CustomEvent('RESPONSE_CAPTURED', {
							detail: {
								type: 'FETCH',
								requestId: clonedResponse.url,
								url: clonedResponse.url,
								data: body,
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
		this._requestURL = args[1];
		return originalXhrOpen.apply(this, args);
	};

	XMLHttpRequest.prototype.send = function (...args) {
		this.addEventListener('load', () => {
			console.log('--------------xhr captured for---------', this._requestURL);
			if (this._requestURL) {
				// Dispatch a custom event with the captured data
				window.dispatchEvent(
					new CustomEvent('RESPONSE_CAPTURED', {
						detail: {
							type: 'XHR',
							url: this._requestURL,
							data: this.responseText,
							timestamp: Date.now(),
						},
					})
				);
			}
		});
		return originalXhrSend.apply(this, args);
	};
})();
