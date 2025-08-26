// src/hooks/useClipboard.ts
import { useState, useCallback, useEffect } from 'react';

interface UseClipboardOptions {
	// Timeout in milliseconds to reset the 'copied' state
	timeout?: number;
}

export function useClipboard({ timeout = 2000 }: UseClipboardOptions = {}) {
	const [isCopied, setIsCopied] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const copy = useCallback(async (text: string) => {
		if (!navigator?.clipboard) {
			const err = new Error('Clipboard API not supported');
			console.error(err);
			setError(err);
			return;
		}

		try {
			await navigator.clipboard.writeText(text);
			setIsCopied(true);
			setError(null);
		} catch (e) {
			console.error('Failed to copy text:', e);
			setError(e as Error);
		}
	}, []);

	useEffect(() => {
		let timeoutId: number | null = null;

		if (isCopied) {
			timeoutId = window.setTimeout(() => {
				setIsCopied(false);
			}, timeout);
		}

		// Cleanup timeout on unmount or if isCopied changes
		return () => {
			if (timeoutId) {
				window.clearTimeout(timeoutId);
			}
		};
	}, [isCopied, timeout]);

	return { copy, isCopied, error };
}
