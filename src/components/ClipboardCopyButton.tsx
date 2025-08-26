// src/components/ClipboardCopyButton.tsx
// import React from 'react';
import { useClipboard } from '../hooks/useClipboard';
import { Copy, CheckCircle } from 'lucide-react';

interface ClipboardCopyButtonProps {
	// The text that will be copied to the clipboard
	textToCopy: string;
}

export function ClipboardCopyButton({ textToCopy }: ClipboardCopyButtonProps) {
	const { copy, isCopied, error } = useClipboard({ timeout: 2000 });

	const handleCopy = () => {
		copy(textToCopy);
	};

	return (
		<button
			onClick={handleCopy}
			disabled={isCopied}
			style={{
				display: 'inline-flex',

				alignItems: 'center',
				justifyContent: 'center',
				padding: '8px 16px',
				fontSize: '14px',
				fontWeight: '500',
				borderRadius: '6px',
				border: `1px solid ${isCopied ? '#22c55e' : '#d1d5db'}`,
				backgroundColor: isCopied ? '#f0fdf4' : '#ffffff',
				color: isCopied ? '#166534' : '#374151',
				cursor: 'pointer',
				transition: 'all 0.2s ease-in-out',
			}}
		>
			{isCopied ? (
				<CheckCircle size={16} style={{ marginRight: '8px' }} />
			) : (
				<Copy size={16} style={{ marginRight: '8px' }} />
			)}
			{isCopied ? 'Copied!' : 'Copy'}
			{error && <span style={{ marginLeft: '8px', color: '#ef4444' }}>Failed!</span>}
		</button>
	);
}
