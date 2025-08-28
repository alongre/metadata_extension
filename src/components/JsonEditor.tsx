import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, FileJson, CheckCircle, AlertTriangle, Zap, Edit3, Pencil, Trash2 } from 'lucide-react';
import { CapturedRequest } from '../types';
import { ClipboardCopyButton } from './ClipboardCopyButton';

interface JsonEditorProps {
	selectedRequest: CapturedRequest | null;
	onSaveOverride: (requestId: string, data: any) => void;
	onClearOverride: (requestId: string) => void;
	shouldLoadData?: boolean; // New prop to control when to load data
	onRequestUpdate?: (request: CapturedRequest) => void; // For updating request when override status changes
}

// React JSON Viewer component with editing capabilities

// Custom JSON renderer with inline edit icons
interface JsonEditorLineProps {
	value: any;
	keyName: string;
	path: string[];
	depth: number;
	isLast: boolean;
	onEdit: (path: string[], newValue: any) => void;
	onDelete: (path: string[]) => void;
	collapsed: boolean;
	collapsedPaths: Set<string>;
	onToggleCollapse: (path: string[]) => void;
}

const JsonEditorLine: React.FC<JsonEditorLineProps> = ({
	value,
	keyName,
	path,
	depth,
	isLast,
	onEdit,
	onDelete,
	collapsed,
	collapsedPaths,
	onToggleCollapse,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState('');
	const indent = Array(depth)
		.fill(null)
		.map((_, i) => (
			<span
				key={i}
				style={{
					display: 'inline-block',
					width: '16px',
					borderLeft: depth > 0 ? '1px solid #e5e7eb' : 'none',
					marginLeft: '2px',
					paddingLeft: '2px',
				}}
			/>
		)); // Use visual indentation with guide lines

	const startEdit = () => {
		setEditValue(typeof value === 'string' ? value : JSON.stringify(value));
		setIsEditing(true);
	};

	const saveEdit = () => {
		try {
			let newValue: any;
			if (typeof value === 'string') {
				newValue = editValue;
			} else if (typeof value === 'number') {
				newValue = Number(editValue);
			} else if (typeof value === 'boolean') {
				newValue = editValue === 'true';
			} else {
				newValue = JSON.parse(editValue);
			}
			onEdit(path, newValue);
			setIsEditing(false);
		} catch (error) {
			// Invalid JSON, don't save
			console.error('Invalid edit value:', error);
		}
	};

	const cancelEdit = () => {
		setIsEditing(false);
		setEditValue('');
	};

	const isLink = (value: string): boolean => {
		if (typeof value !== 'string') return false;
		return (value.includes('http://') || value.includes	('https://'))
	}


	const renderValue = () => {
		if (isEditing) {
			return (
				<input
					type='text'
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onBlur={saveEdit}
					onKeyDown={(e) => {
						if (e.key === 'Enter') saveEdit();
						if (e.key === 'Escape') cancelEdit();
					}}
					autoFocus
					style={{
						border: '1px solid #3b82f6',
						borderRadius: '4px',
						padding: '2px 6px',
						fontSize: '14px',
						fontFamily: 'inherit',
						backgroundColor: '#ffffff',
						color: '#1e293b',
						minWidth: '100px',
					}}
				/>
			);
		}

		if (isLink(value)) {
			return (
				<a href={value} target='_blank' rel='noopener noreferrer' style={{ color: '#3b82f6' }}>
					"{value}"
				</a>
			);
		}

		if (typeof value === 'string') {
			return <span style={{ color: '#059669' }}>"{value}"</span>;
		} else if (typeof value === 'number') {
			return <span style={{ color: '#dc2626' }}>{value}</span>;
		} else if (typeof value === 'boolean') {
			return <span style={{ color: '#7c3aed' }}>{String(value)}</span>;
		} else if (value === null) {
			return <span style={{ color: '#6b7280' }}>null</span>;
		}

		return null;
	};

	const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
	const isArray = Array.isArray(value);
	const isPrimitive = !isObject && !isArray;

	if (isPrimitive) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
				{indent}
				<span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
					"{keyName}": {renderValue()}
					{!isLast ? ',' : ''}
				</span>
				{!isEditing && (
					<div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
						<button
							onClick={startEdit}
							style={{
								padding: '2px 4px',
								backgroundColor: 'transparent',
								border: '1px solid #d1d5db',
								borderRadius: '4px',
								cursor: 'pointer',
								opacity: 0.6,
								transition: 'opacity 0.2s',
							}}
							onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
							onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
						>
							<Pencil size={12} style={{ color: '#6b7280' }} />
						</button>
						<button
							onClick={() => onDelete(path)}
							style={{
								padding: '2px 4px',
								backgroundColor: 'transparent',
								border: '1px solid #fca5a5',
								borderRadius: '4px',
								cursor: 'pointer',
								opacity: 0.6,
								transition: 'opacity 0.2s',
							}}
							onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
							onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
						>
							<Trash2 size={12} style={{ color: '#dc2626' }} />
						</button>
					</div>
				)}
			</div>
		);
	}

	// For objects and arrays - simplified view
	if (isObject || isArray) {
		const entries = isArray ? value.map((v: any, i: number) => [i, v]) : Object.entries(value);
		const bracket = isArray ? ['[', ']'] : ['{', '}'];

		if (collapsed) {
			// Show collapsed state with proper indentation and summary
			const itemCount = entries.length;
			const summary = isArray
				? `[${itemCount} item${itemCount !== 1 ? 's' : ''}]`
				: `{${itemCount} item${itemCount !== 1 ? 's' : ''}}`;

			return (
				<div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
					{indent}
					<button
						onClick={() => onToggleCollapse(path)}
						style={{
							marginRight: '6px',
							padding: '2px 6px',
							backgroundColor: '#f3f4f6',
							border: '1px solid #d1d5db',
							borderRadius: '4px',
							cursor: 'pointer',
							fontSize: '12px',
							color: '#374151',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							minWidth: '20px',
							height: '20px',
							transition: 'all 0.2s',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#e5e7eb';
							e.currentTarget.style.borderColor = '#9ca3af';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#f3f4f6';
							e.currentTarget.style.borderColor = '#d1d5db';
						}}
					>
						▶
					</button>
					<span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
						"{keyName}": <span style={{ color: '#6b7280', fontStyle: 'italic' }}>{summary}</span>
						{!isLast ? ',' : ''}
					</span>
					<div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
						<button
							onClick={() => onDelete(path)}
							style={{
								padding: '2px 4px',
								backgroundColor: 'transparent',
								border: '1px solid #fca5a5',
								borderRadius: '4px',
								cursor: 'pointer',
								opacity: 0.6,
								transition: 'opacity 0.2s',
							}}
							onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
							onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
						>
							<Trash2 size={12} style={{ color: '#dc2626' }} />
						</button>
					</div>
				</div>
			);
		}

		return (
			<div>
				<div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
					{indent}
					<button
						onClick={() => onToggleCollapse(path)}
						style={{
							marginRight: '6px',
							padding: '2px 6px',
							backgroundColor: '#f3f4f6',
							border: '1px solid #d1d5db',
							borderRadius: '4px',
							cursor: 'pointer',
							fontSize: '12px',
							color: '#374151',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							minWidth: '20px',
							height: '20px',
							transition: 'all 0.2s',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#e5e7eb';
							e.currentTarget.style.borderColor = '#9ca3af';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#f3f4f6';
							e.currentTarget.style.borderColor = '#d1d5db';
						}}
					>
						▼
					</button>
					<span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
						"{keyName}": {bracket[0]}
					</span>
				</div>
				{entries.map(([key, val], index) => {
					const childPath = [...path, String(key)];
					const childPathKey = childPath.join('.');
					const isChildCollapsed = collapsedPaths ? collapsedPaths.has(childPathKey) : false;
					return (
						<JsonEditorLine
							key={key}
							value={val}
							keyName={String(key)}
							path={childPath}
							depth={depth + 1}
							isLast={index === entries.length - 1}
							onEdit={onEdit}
							onDelete={onDelete}
							collapsed={isChildCollapsed}
							collapsedPaths={collapsedPaths}
							onToggleCollapse={onToggleCollapse}
						/>
					);
				})}
				<div style={{ display: 'flex', alignItems: 'center', fontFamily: 'monospace', fontSize: '14px' }}>
					{indent}
					{bracket[1]}
					{!isLast ? ',' : ''}
				</div>
			</div>
		);
	}

	return null;
};

const JsonEditor: React.FC<JsonEditorProps> = ({
	selectedRequest,
	onSaveOverride,
	onClearOverride,
	shouldLoadData = false,
	onRequestUpdate,
}) => {
	const [jsonData, setJsonData] = useState<any>(null);
	const [editedData, setEditedData] = useState<any>(null);
	const [hasChanges, setHasChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [parseError, setParseError] = useState<string | null>(null);
	const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

	// Helper function to update nested values
	const updateNestedValue = (obj: any, path: string[], newValue: any): any => {
		if (path.length === 0) return newValue;

		const result = Array.isArray(obj) ? [...obj] : { ...obj };
		const key = path[0];

		if (path.length === 1) {
			result[key] = newValue;
		} else {
			result[key] = updateNestedValue(result[key], path.slice(1), newValue);
		}

		return result;
	};

	// Handle inline editing
	const handleInlineEdit = (path: string[], newValue: any) => {
		const updated = updateNestedValue(editedData, path, newValue);
		handleJsonChange(updated);
	};

	// Handle delete property
	const handleDelete = (path: string[]) => {
		const updated = deleteNestedValue(editedData, path);
		handleJsonChange(updated);
	};

	// Helper function to delete nested values
	const deleteNestedValue = (obj: any, path: string[]): any => {
		if (path.length === 0) return obj;

		const result = Array.isArray(obj) ? [...obj] : { ...obj };

		if (path.length === 1) {
			if (Array.isArray(result)) {
				result.splice(Number(path[0]), 1);
			} else {
				delete result[path[0]];
			}
		} else {
			result[path[0]] = deleteNestedValue(result[path[0]], path.slice(1));
		}

		return result;
	};

	// Handle collapse/expand
	const handleToggleCollapse = (path: string[]) => {
		const pathKey = path.join('.');
		const newCollapsed = new Set(collapsedPaths);
		if (newCollapsed.has(pathKey)) {
			newCollapsed.delete(pathKey);
		} else {
			newCollapsed.add(pathKey);
		}
		setCollapsedPaths(newCollapsed);
	};

	// Helper function to create default collapsed paths (collapse ALL nested nodes)
	const createDefaultCollapsedPaths = (
		obj: any,
		currentPath: string[] = [],
		collapsedSet: Set<string> = new Set()
	): Set<string> => {
		if (typeof obj !== 'object' || obj === null) {
			return collapsedSet;
		}

		// Always collapse any node that has children (except the root)
		if (currentPath.length >= 1) {
			collapsedSet.add(currentPath.join('.'));
		}

		// Recurse into object/array properties to find all nested structures
		if (Array.isArray(obj)) {
			obj.forEach((item, index) => {
				createDefaultCollapsedPaths(item, [...currentPath, String(index)], collapsedSet);
			});
		} else {
			Object.entries(obj).forEach(([key, value]) => {
				createDefaultCollapsedPaths(value, [...currentPath, key], collapsedSet);
			});
		}

		return collapsedSet;
	};

	useEffect(() => {
		// Only load data when shouldLoadData is true (sidebar item clicked)
		if (!shouldLoadData) {
			return;
		}

		setLoadError(null);
		setParseError(null);
		setHasChanges(false);
		setIsEditing(false);

		if (selectedRequest) {
			try {
				const hasResponse = selectedRequest.responseData !== undefined;
				const dataToShow = selectedRequest.overrideData ?? (hasResponse ? selectedRequest.responseData : undefined);

				if (dataToShow === undefined) {
					setJsonData(null);
					setEditedData(null);
					setLoadError('No response data captured yet');
					return;
				}

				// Parse data if it's a string
				let parsedData = dataToShow;
				if (typeof dataToShow === 'string') {
					try {
						parsedData = JSON.parse(dataToShow);
					} catch (e) {
						// If parsing fails, treat as plain string
						parsedData = dataToShow;
					}
				}

				setJsonData(parsedData);
				setEditedData(parsedData);

				// Set default collapsed paths for level 2 and deeper
				const defaultCollapsed = createDefaultCollapsedPaths(parsedData);
				setCollapsedPaths(defaultCollapsed);
			} catch (e) {
				console.error('JsonEditor: Error loading data', e);
				setLoadError('Failed to load JSON data');
			}
		} else {
			setJsonData(null);
			setEditedData(null);
		}
	}, [selectedRequest, shouldLoadData]);

	const handleEditToggle = () => {
		setIsEditing(!isEditing);
	};

	const handleJsonChange = (newValue: any) => {
		setEditedData(newValue);
		setHasChanges(JSON.stringify(newValue) !== JSON.stringify(jsonData));
		setParseError(null);
	};

	const handleSave = async () => {
		if (!selectedRequest || !hasChanges) return;
		setIsSaving(true);
		try {
			await onSaveOverride(selectedRequest.id, editedData);
			setJsonData(editedData);
			setHasChanges(false);
			setParseError(null);
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
		try {
			// JsonView handles formatting automatically, but we can reset to original formatted state
			setEditedData({ ...editedData });
			setParseError(null);
		} catch (e) {
			setParseError('Cannot format: Data is not valid JSON.');
		}
	};

	const handleClearChanges = () => {
		setEditedData(jsonData);
		setHasChanges(false);
		setParseError(null);
	};

	const handleRefreshAndCheckOverrides = async () => {
		if (!selectedRequest) return;

		try {
			// Check for DevTools network overrides
			const response = await chrome.runtime.sendMessage({
				type: 'CHECK_OVERRIDE_STATUS',
				url: selectedRequest.url,
			});

			if (response.success) {
				// Refresh the request data from background
				const refreshResponse = await chrome.runtime.sendMessage({ type: 'GET_REQUESTS' });
				const requests = Object.values(refreshResponse || {}) as CapturedRequest[];
				const updatedRequest = requests.find((r) => r.id === selectedRequest.id);

				if (updatedRequest && onRequestUpdate) {
					// Update the selected request if it has been modified
					onRequestUpdate(updatedRequest);
				}
			}

			// Also format the JSON
			formatJson();
		} catch (error) {
			console.error('Failed to check override status:', error);
			// Fallback to just formatting
			formatJson();
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
					<h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '0 0 12px 0' }}>
						Select a Request
					</h2>
					<p style={{ color: '#6b7280', margin: '0 0 24px 0', maxWidth: '384px', lineHeight: '1.5' }}>
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
			<div style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '16px' }}>
				<div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
					<div style={{ width: '100%' }}>
						<div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', justifyContent: 'space-between' }}>
							<h2
								style={{
									fontSize: '20px',
									fontWeight: 'bold',
									color: '#111827',
									display: 'flex',
									alignItems: 'center',
									margin: 0,
									paddingBottom: '8px',
								}}
							>
								<FileJson style={{ marginRight: '8px', color: '#2563eb' }} size={24} />
								{selectedRequest.endpoint}
							</h2>

							<ClipboardCopyButton textToCopy={JSON.stringify(editedData, null, 2)} />
						</div>

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
				{loadError && (
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
						<span style={{ fontSize: '14px', color: '#991b1b' }}>{loadError}</span>
					</div>
				)}

				{hasChanges && (
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

				{parseError && (
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
						<span style={{ fontSize: '14px', color: '#991b1b' }}>{parseError}</span>
					</div>
				)}
			</div>

			{/* JSON Viewer/Editor Area */}
			<div style={{ position: 'relative', flex: 1, padding: '16px' }}>
				<div style={{ position: 'absolute', inset: '16px 16px 72px 16px' }}>
					<div
						style={{
							width: '100%',
							height: '100%',
							border: '2px solid #d1d5db',
							borderRadius: '12px',
							overflow: 'hidden',
							backgroundColor: '#ffffff',
							boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
							display: 'flex',
							flexDirection: 'column',
						}}
					>
						{shouldLoadData && jsonData !== null ? (
							<div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
								{isEditing ? (
									<div style={{ position: 'relative', paddingRight: '32px' }}>
										{/* Editable JSON overlay */}
										<div
											contentEditable
											suppressContentEditableWarning
											onInput={(e) => {
												try {
													const text = e.currentTarget.textContent || '';
													const parsed = JSON.parse(text);
													handleJsonChange(parsed);
													setParseError(null);
												} catch (error) {
													setParseError('Invalid JSON format');
												}
											}}
											style={{
												width: '100%',
												minHeight: '400px',
												padding: '16px',

												border: '2px solid #3b82f6',
												borderRadius: '8px',
												fontFamily:
													'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
												fontSize: '14px',
												lineHeight: '1.6',
												backgroundColor: '#f8fafc',
												color: '#1e293b',
												outline: 'none',
												whiteSpace: 'pre-wrap',
												overflowWrap: 'break-word',
											}}
											dangerouslySetInnerHTML={{
												__html: JSON.stringify(editedData, null, 2)
													.replace(/&/g, '&amp;')
													.replace(/</g, '&lt;')
													.replace(/>/g, '&gt;')
													.replace(/"/g, '&quot;')
													.replace(/'/g, '&#39;'),
											}}
										/>
										{parseError && (
											<div
												style={{
													marginTop: '8px',
													padding: '8px 12px',
													backgroundColor: '#fef2f2',
													border: '1px solid #fecaca',
													borderRadius: '6px',
													color: '#dc2626',
													fontSize: '14px',
													display: 'flex',
													alignItems: 'center',
												}}
											>
												<AlertTriangle size={16} style={{ marginRight: '8px' }} />
												{parseError}
											</div>
										)}
									</div>
								) : (
									<div
										style={{
											fontFamily:
												'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
											fontSize: '14px',
											lineHeight: '1.5',
											backgroundColor: '#ffffff',
											border: '1px solid #e5e7eb',
											borderRadius: '8px',
											padding: '16px',
										}}
									>
										{/* Custom inline editable JSON tree */}
										<div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#374151' }}>{'{'}</div>
										{Object.entries(editedData).map(([key, value], index, array) => (
											<JsonEditorLine
												key={key}
												value={value}
												keyName={key}
												path={[key]}
												depth={1}
												isLast={index === array.length - 1}
												onEdit={handleInlineEdit}
												onDelete={handleDelete}
												collapsed={collapsedPaths.has(key)}
												collapsedPaths={collapsedPaths}
												onToggleCollapse={handleToggleCollapse}
											/>
										))}
										<div style={{ fontWeight: 'bold', color: '#374151' }}>{'}'}</div>
									</div>
								)}
							</div>
						) : shouldLoadData ? (
							<div
								style={{
									padding: '16px',
									color: '#6b7280',
									textAlign: 'center',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									height: '100%',
								}}
							>
								No response data available
							</div>
						) : (
							<div
								style={{
									padding: '16px',
									color: '#6b7280',
									textAlign: 'center',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									height: '100%',
								}}
							>
								Click on a request in the sidebar to load and view its JSON response
							</div>
						)}
					</div>
				</div>

				{/* Bottom Action Bar */}
				<div
					style={{
						position: 'absolute',
						left: '16px',
						bottom: '16px',
						display: 'flex',
						justifyContent: 'flex-start',
						gap: '12px',
						height: '40px',
					}}
				>
					{/* Edit/Done Button */}
					<button
						onClick={handleEditToggle}
						disabled={!jsonData}
						style={{
							padding: '8px 16px',
							backgroundColor: isEditing ? '#059669' : '#6366f1',
							color: 'white',
							fontWeight: '600',
							borderRadius: '8px',
							border: 'none',
							cursor: jsonData ? 'pointer' : 'not-allowed',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
							transition: 'all 0.2s',
							height: '40px',
							opacity: jsonData ? 1 : 0.5,
						}}
					>
						<Edit3 size={16} style={{ marginRight: '8px' }} />
						{isEditing ? 'Done' : 'Edit'}
					</button>

					{/* Save Button */}
					<button
						onClick={handleSave}
						disabled={!hasChanges || isSaving || !!parseError}
						style={{
							padding: '8px 16px',
							backgroundColor: hasChanges && !isSaving && !parseError ? '#2563eb' : '#9ca3af',
							color: 'white',
							fontWeight: '600',
							borderRadius: '8px',
							border: 'none',
							cursor: hasChanges && !isSaving && !parseError ? 'pointer' : 'not-allowed',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
							transition: 'all 0.2s',
							height: '40px',
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
								Save & Override
							</>
						)}
					</button>

					{/* Format Button - Only show in edit mode if needed */}
					{isEditing && (
						<button
							onClick={handleRefreshAndCheckOverrides}
							style={{
								padding: '8px 16px',
								fontSize: '14px',
								fontWeight: '500',
								color: '#374151',
								backgroundColor: '#ffffff',
								border: '1px solid #d1d5db',
								borderRadius: '8px',
								cursor: 'pointer',
								transition: 'all 0.2s',
								height: '40px',
							}}
						>
							Refresh
						</button>
					)}

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
						>
							<RotateCcw size={16} style={{ marginRight: '8px' }} />
							Reset
						</button>
					)}
					{hasChanges && (
						<button
							onClick={handleClearChanges}
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
						>
							<RotateCcw size={16} style={{ marginRight: '8px' }} />
							Clear Changes
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default JsonEditor;
