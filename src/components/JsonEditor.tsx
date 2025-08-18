import React, { useState, useEffect, useRef } from 'react';
import JsonView from '@uiw/react-json-view';
import { Save, RotateCcw, FileJson, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { CapturedRequest } from '../types';

interface JsonEditorProps {
	selectedRequest: CapturedRequest | null;
	onSaveOverride: (requestId: string, data: any) => void;
	onClearOverride: (requestId: string) => void;
}

// Ensure MonacoEnvironment is configured before any Monaco Editor usage
if (typeof window !== 'undefined') {
	(window as any).MonacoEnvironment = {
		getWorker: () => {
			// Return null to disable web workers completely
			return null;
		},
	};
}

const JsonEditor: React.FC<JsonEditorProps> = ({ selectedRequest, onSaveOverride, onClearOverride }) => {
	const [editorValue, setEditorValue] = useState('');
	const [isValidJson, setIsValidJson] = useState(true);
	const [hasChanges, setHasChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [jsonError, setJsonError] = useState('');
	const [jsonObject, setJsonObject] = useState<any>(null);
	const [useJsonView, setUseJsonView] = useState(true);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (selectedRequest) {
			const dataToShow = selectedRequest.overrideData ||
				selectedRequest.responseData || {
					message: 'No response data captured yet',
					endpoint: selectedRequest.endpoint,
					timestamp: selectedRequest.timestamp,
					note: 'This request was captured but no response data is available.',
					captured_at: new Date(selectedRequest.timestamp).toISOString(),
				};

			const formattedJson = JSON.stringify(dataToShow, null, 2);
			setEditorValue(formattedJson);
			setJsonObject(dataToShow);
			setHasChanges(false);
			validateJson(formattedJson);
		} else {
			setEditorValue('');
			setHasChanges(false);
		}
	}, [selectedRequest]);

	const validateJson = (value: string) => {
		if (!value.trim()) {
			setIsValidJson(true);
			setJsonError('');
			return;
		}

		try {
			JSON.parse(value);
			setIsValidJson(true);
			setJsonError('');
		} catch (error) {
			setIsValidJson(false);
			setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
		}
	};

	const handleEditorChange = (value: string | undefined) => {
		if (value !== undefined) {
			setEditorValue(value);
			setHasChanges(true);
			validateJson(value);

			// Try to parse and update JSON object for JsonView
			try {
				const parsed = JSON.parse(value);
				setJsonObject(parsed);
			} catch (error) {
				// Keep the previous object if parsing fails
			}
		}
	};

	// Handle tab key for proper indentation
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Tab') {
			e.preventDefault();
			const textarea = e.currentTarget;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;

			if (e.shiftKey) {
				// Remove tab (unindent)
				const beforeSelection = editorValue.substring(0, start);
				const afterSelection = editorValue.substring(end);
				const lines = beforeSelection.split('\n');
				const currentLineStart = beforeSelection.lastIndexOf('\n') + 1;
				const currentLine = lines[lines.length - 1];

				if (currentLine.startsWith('\t')) {
					const newValue = beforeSelection.substring(0, currentLineStart) + currentLine.substring(1) + afterSelection;
					setEditorValue(newValue);
					setHasChanges(true);

					setTimeout(() => {
						textarea.selectionStart = start - 1;
						textarea.selectionEnd = end - 1;
					}, 0);
				}
			} else {
				// Add tab (indent)
				const newValue = editorValue.substring(0, start) + '\t' + editorValue.substring(end);
				setEditorValue(newValue);
				setHasChanges(true);
				validateJson(newValue);

				setTimeout(() => {
					textarea.selectionStart = start + 1;
					textarea.selectionEnd = start + 1;
				}, 0);
			}
		}
	};

	const handleSave = async () => {
		if (!selectedRequest || !isValidJson || !hasChanges) return;

		setIsSaving(true);
		try {
			const data = JSON.parse(editorValue);
			await onSaveOverride(selectedRequest.id, data);
			setHasChanges(false);
		} catch (error) {
			console.error('Failed to save override:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleClearOverride = async () => {
		if (!selectedRequest) return;
		await onClearOverride(selectedRequest.id);
	};

	const formatJson = () => {
		if (!isValidJson) return;

		try {
			const parsed = JSON.parse(editorValue);
			const formatted = JSON.stringify(parsed, null, 2);
			setEditorValue(formatted);
		} catch (error) {
			console.error('Failed to format JSON:', error);
		}
	};

	if (!selectedRequest) {
		return (
			<div
				style={{
					height: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: '#f9fafb',
				}}
			>
				<div style={{ textAlign: 'center', padding: '48px' }}>
					<div
						style={{
							width: '96px',
							height: '96px',
							backgroundColor: '#dbeafe',
							borderRadius: '50%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							margin: '0 auto 24px',
						}}
					>
						<FileJson size={40} style={{ color: '#2563eb' }} />
					</div>
					<h2
						style={{
							fontSize: '24px',
							fontWeight: 'bold',
							color: '#111827',
							margin: '0 0 12px 0',
						}}
					>
						Select a Request
					</h2>
					<p
						style={{
							color: '#6b7280',
							margin: '0 0 24px 0',
							maxWidth: '384px',
							lineHeight: '1.5',
						}}
					>
						Choose a captured request from the sidebar to view and edit its JSON response data
					</p>
					<div
						style={{
							backgroundColor: '#eff6ff',
							border: '1px solid #bfdbfe',
							borderRadius: '8px',
							padding: '16px',
							maxWidth: '384px',
							margin: '0 auto',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center' }}>
							<Zap style={{ color: '#2563eb', marginRight: '8px' }} size={20} />
							<div style={{ textAlign: 'left' }}>
								<p style={{ fontWeight: '500', color: '#1e3a8a', margin: '0 0 4px 0' }}>Pro Tip</p>
								<p style={{ fontSize: '14px', color: '#1d4ed8', margin: 0 }}>
									Navigate to pages with{' '}
									<code
										style={{
											backgroundColor: '#dbeafe',
											padding: '2px 4px',
											borderRadius: '3px',
											fontFamily: 'monospace',
										}}
									>
										Matching URL patterns
									</code>{' '}
									endpoints to start capturing
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			{/* Header */}
			<div
				style={{
					backgroundColor: '#f9fafb',
					borderBottom: '1px solid #e5e7eb',
					padding: '16px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<div>
						<h2
							style={{
								fontSize: '20px',
								fontWeight: 'bold',
								color: '#111827',
								display: 'flex',
								alignItems: 'center',
								margin: 0,
							}}
						>
							<FileJson style={{ marginRight: '8px', color: '#2563eb' }} size={24} />
							{selectedRequest.endpoint}
						</h2>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '16px',
								marginTop: '8px',
								fontSize: '14px',
								color: '#6b7280',
							}}
						>
							<span style={{ fontWeight: '500' }}>{selectedRequest.method}</span>
							<span>•</span>
							<span>{new Date(selectedRequest.timestamp).toLocaleString()}</span>
							{selectedRequest.isOverridden && (
								<span
									style={{
										backgroundColor: '#fed7aa',
										color: '#9a3412',
										padding: '4px 8px',
										borderRadius: '9999px',
										fontSize: '12px',
										fontWeight: '500',
									}}
								>
									🔄 Overridden
								</span>
							)}
						</div>
						<p
							style={{
								fontSize: '12px',
								color: '#6b7280',
								marginTop: '4px',
								margin: '4px 0 0 0',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{selectedRequest.url}
						</p>
					</div>
				</div>

				{/* Status Messages */}
				{!isValidJson && (
					<div
						style={{
							marginTop: '12px',
							padding: '12px',
							backgroundColor: '#fef2f2',
							border: '1px solid #fecaca',
							borderRadius: '8px',
							display: 'flex',
							alignItems: 'center',
						}}
					>
						<AlertTriangle style={{ color: '#ef4444', marginRight: '8px' }} size={16} />
						<span style={{ fontSize: '14px', color: '#991b1b' }}>
							<strong>Invalid JSON:</strong> {jsonError}
						</span>
					</div>
				)}

				{hasChanges && isValidJson && (
					<div
						style={{
							marginTop: '12px',
							padding: '12px',
							backgroundColor: '#f0fdf4',
							border: '1px solid #bbf7d0',
							borderRadius: '8px',
							display: 'flex',
							alignItems: 'center',
						}}
					>
						<CheckCircle style={{ color: '#22c55e', marginRight: '8px' }} size={16} />
						<span style={{ fontSize: '14px', color: '#166534' }}>Ready to save your changes</span>
					</div>
				)}
			</div>

			{/* Editor Area - Flex Row Layout */}
			<div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', paddingRight: '16px' }}>
				{/* Left Side - Action Buttons */}

				{/* Right Side - JSON Editor Container */}
				<div style={{ flex: 1, gap: '16px', marginBottom: '16px', marginRight: '40px' }}>
					{useJsonView && jsonObject ? (
						// JSON Tree View
						<div
							style={{
								width: '100%',
								height: '100%',
								border: '2px solid #d1d5db',
								borderRadius: '12px',
								overflow: 'auto',
								backgroundColor: '#ffffff',
								boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
								padding: '16px',
							}}
						>
							<JsonView
								value={jsonObject}
								enableClipboard={false}
								displayDataTypes={false}
								displayObjectSize={false}
								style={{
									backgroundColor: '#ffffff',
									fontSize: '14px',
									fontFamily: 'Monaco, Consolas, "Courier New", monospace',
								}}
							/>
						</div>
					) : (
						// Text Editor
						<div style={{ width: '100%', height: '100%' }}>
							<textarea
								ref={textareaRef}
								value={editorValue}
								onChange={(e) => handleEditorChange(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder='JSON data will appear here...'
								spellCheck={false}
								style={{
									width: '100%',
									height: '100%',
									padding: '16px',
									border: '2px solid #d1d5db',
									borderRadius: '12px',
									fontFamily: 'Monaco, Consolas, "Courier New", monospace',
									fontSize: '14px',
									lineHeight: '1.6',
									resize: 'none',
									outline: 'none',
									backgroundColor: '#ffffff',
									boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
									transition: 'border-color 0.2s, box-shadow 0.2s',
								}}
								onFocus={(e) => {
									e.currentTarget.style.borderColor = '#3b82f6';
									e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
								}}
								onBlur={(e) => {
									e.currentTarget.style.borderColor = '#d1d5db';
									e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
								}}
							/>
						</div>
					)}
				</div>

				{/* Bottom Right Action Buttons */}
				<div
					style={{
						display: 'flex',
						justifyContent: 'flex-end',
						marginTop: '40px',

						gap: '12px',
						height: '40px',
					}}
				>
					{/* View Toggle */}
					<button
						onClick={() => setUseJsonView(!useJsonView)}
						style={{
							padding: '8px 16px',
							fontSize: '14px',
							fontWeight: '500',
							color: '#2563eb',
							backgroundColor: useJsonView ? '#eff6ff' : '#f9fafb',
							border: `1px solid ${useJsonView ? '#3b82f6' : '#d1d5db'}`,
							borderRadius: '8px',
							cursor: 'pointer',
							transition: 'all 0.2s',
							height: '40px',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = useJsonView ? '#dbeafe' : '#f3f4f6';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = useJsonView ? '#eff6ff' : '#f9fafb';
						}}
					>
						{useJsonView ? '📝 Edit' : '🌳 View'}
					</button>

					{/* Format Button */}
					<button
						onClick={formatJson}
						disabled={!isValidJson}
						style={{
							padding: '8px 16px',
							fontSize: '14px',
							fontWeight: '500',
							color: isValidJson ? '#374151' : '#9ca3af',
							backgroundColor: '#ffffff',
							border: '1px solid #d1d5db',
							borderRadius: '8px',
							cursor: isValidJson ? 'pointer' : 'not-allowed',
							opacity: isValidJson ? 1 : 0.5,
							transition: 'all 0.2s',
							height: '40px',
						}}
						onMouseEnter={(e) => {
							if (isValidJson) {
								e.currentTarget.style.backgroundColor = '#f9fafb';
							}
						}}
						onMouseLeave={(e) => {
							if (isValidJson) {
								e.currentTarget.style.backgroundColor = '#ffffff';
							}
						}}
					>
						Format
					</button>

					{/* Clear Override */}
					{selectedRequest?.isOverridden && (
						<button
							onClick={handleClearOverride}
							style={{
								padding: '8px 16px',
								fontSize: '14px',
								fontWeight: '500',
								color: '#c2410c',
								backgroundColor: '#fff7ed',
								border: '1px solid #fed7aa',
								borderRadius: '8px',
								cursor: 'pointer',
								transition: 'all 0.2s',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								height: '40px',
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#ffedd5';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = '#fff7ed';
							}}
						>
							<RotateCcw size={16} style={{ marginRight: '8px' }} />
							Reset
						</button>
					)}

					{/* Save Button */}
					<button
						onClick={handleSave}
						disabled={!hasChanges || !isValidJson || isSaving}
						style={{
							padding: '8px 16px',
							backgroundColor: hasChanges && isValidJson && !isSaving ? '#2563eb' : '#9ca3af',
							color: 'white',
							fontWeight: '600',
							borderRadius: '8px',
							border: 'none',
							cursor: hasChanges && isValidJson && !isSaving ? 'pointer' : 'not-allowed',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
							transition: 'all 0.2s',
							height: '40px',
						}}
						onMouseEnter={(e) => {
							if (hasChanges && isValidJson && !isSaving) {
								e.currentTarget.style.backgroundColor = '#1d4ed8';
							}
						}}
						onMouseLeave={(e) => {
							if (hasChanges && isValidJson && !isSaving) {
								e.currentTarget.style.backgroundColor = '#2563eb';
							}
						}}
					>
						{isSaving ? (
							<>
								<div
									style={{
										width: '16px',
										height: '16px',
										border: '2px solid white',
										borderTop: '2px solid transparent',
										borderRadius: '50%',
										marginRight: '8px',
										animation: 'spin 1s linear infinite',
									}}
								/>
								Saving...
							</>
						) : (
							<>
								<Save size={16} style={{ marginRight: '8px' }} />
								Save
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};

export default JsonEditor;
