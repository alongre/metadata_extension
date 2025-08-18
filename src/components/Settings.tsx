import React, { useState, useEffect } from 'react';
import {
	Plus,
	Trash2,
	ToggleLeft,
	ToggleRight,
	Settings as SettingsIcon,
	X,
	Edit2,
	Check,
	X as CancelIcon,
} from 'lucide-react';
import { URLPattern } from '../types';

interface SettingsProps {
	onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
	const [patterns, setPatterns] = useState<URLPattern[]>([]);
	const [newPattern, setNewPattern] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [editingPattern, setEditingPattern] = useState<string | null>(null);
	const [editValue, setEditValue] = useState('');

	useEffect(() => {
		loadPatterns();
	}, []);

	const loadPatterns = async () => {
		try {
			const response = await chrome.runtime.sendMessage({ type: 'GET_URL_PATTERNS' });
			if (response.success) {
				setPatterns(response.data || []);
			}
		} catch (error) {
			console.error('Failed to load URL patterns:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleAddPattern = async () => {
		if (!newPattern.trim()) return;

		setIsSaving(true);
		try {
			const response = await chrome.runtime.sendMessage({
				type: 'ADD_URL_PATTERN',
				pattern: newPattern.trim(),
			});

			if (response.success) {
				setPatterns((prev) => [...prev, response.data]);
				setNewPattern('');
			} else {
				alert('Failed to add pattern: ' + (response.error || 'Unknown error'));
			}
		} catch (error) {
			console.error('Failed to add pattern:', error);
			alert('Failed to add pattern');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeletePattern = async (patternId: string) => {
		try {
			const response = await chrome.runtime.sendMessage({
				type: 'DELETE_URL_PATTERN',
				patternId,
			});

			if (response.success) {
				setPatterns((prev) => prev.filter((p) => p.id !== patternId));
			} else {
				alert('Failed to delete pattern: ' + (response.error || 'Unknown error'));
			}
		} catch (error) {
			console.error('Failed to delete pattern:', error);
			alert('Failed to delete pattern');
		}
	};

	const handleTogglePattern = async (patternId: string, enabled: boolean) => {
		try {
			const response = await chrome.runtime.sendMessage({
				type: 'TOGGLE_URL_PATTERN',
				patternId,
				enabled,
			});

			if (response.success) {
				setPatterns((prev) => prev.map((p) => (p.id === patternId ? { ...p, enabled } : p)));
			} else {
				alert('Failed to toggle pattern: ' + (response.error || 'Unknown error'));
			}
		} catch (error) {
			console.error('Failed to toggle pattern:', error);
			alert('Failed to toggle pattern');
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !isSaving) {
			handleAddPattern();
		}
		if (e.key === 'Escape') {
			onClose();
		}
	};

	const handleEditPattern = (pattern: URLPattern) => {
		setEditingPattern(pattern.id);
		setEditValue(pattern.pattern);
	};

	const handleSaveEdit = async () => {
		if (!editingPattern || !editValue.trim()) return;

		try {
			const response = await chrome.runtime.sendMessage({
				type: 'EDIT_URL_PATTERN',
				patternId: editingPattern,
				pattern: editValue.trim(),
			});

			if (response.success) {
				setPatterns((prev) => prev.map((p) => (p.id === editingPattern ? { ...p, pattern: editValue.trim() } : p)));
				setEditingPattern(null);
				setEditValue('');
			} else {
				alert('Failed to edit pattern: ' + (response.error || 'Unknown error'));
			}
		} catch (error) {
			console.error('Error editing pattern:', error);
			alert('Error editing pattern. See console for details.');
		}
	};

	const handleCancelEdit = () => {
		setEditingPattern(null);
		setEditValue('');
	};

	const handleEditKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			handleSaveEdit();
		} else if (e.key === 'Escape') {
			handleCancelEdit();
		}
	};

	if (isLoading) {
		return (
			<div
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
				}}
			>
				<div
					style={{
						backgroundColor: 'white',
						borderRadius: '12px',
						padding: '32px',
						boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
					}}
				>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							color: '#6b7280',
						}}
					>
						<div
							style={{
								width: '20px',
								height: '20px',
								border: '2px solid #e5e7eb',
								borderTop: '2px solid #3b82f6',
								borderRadius: '50%',
								animation: 'spin 1s linear infinite',
							}}
						/>
						Loading settings...
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0, 0, 0, 0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 1000,
			}}
		>
			<div
				style={{
					backgroundColor: 'white',
					borderRadius: '12px',
					width: '500px',
					maxHeight: '80vh',
					overflow: 'hidden',
					boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{/* Header */}
				<div
					style={{
						backgroundColor: '#f8fafc',
						borderBottom: '1px solid #e2e8f0',
						padding: '20px 24px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<SettingsIcon size={24} style={{ color: '#3b82f6' }} />
						<h2
							style={{
								fontSize: '20px',
								fontWeight: 'bold',
								color: '#1e293b',
								margin: 0,
							}}
						>
							URL Pattern Settings
						</h2>
					</div>
					<button
						onClick={onClose}
						style={{
							padding: '8px',
							backgroundColor: 'transparent',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							color: '#64748b',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#f1f5f9';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent';
						}}
					>
						<X size={20} />
					</button>
				</div>

				{/* Content */}
				<div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
					{/* Add Pattern Section */}
					<div style={{ marginBottom: '24px' }}>
						<h3
							style={{
								fontSize: '16px',
								fontWeight: '600',
								color: '#374151',
								margin: '0 0 12px 0',
							}}
						>
							Add URL Pattern
						</h3>
						<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
							<input
								type='text'
								value={newPattern}
								onChange={(e) => setNewPattern(e.target.value)}
								onKeyDown={handleKeyPress}
								placeholder='e.g., /api/users, /rest/reports-metadata'
								style={{
									flex: 1,
									padding: '12px',
									border: '2px solid #e5e7eb',
									borderRadius: '8px',
									fontSize: '14px',
									outline: 'none',
									transition: 'border-color 0.2s',
								}}
								onFocus={(e) => {
									e.currentTarget.style.borderColor = '#3b82f6';
								}}
								onBlur={(e) => {
									e.currentTarget.style.borderColor = '#e5e7eb';
								}}
							/>
							<button
								onClick={handleAddPattern}
								disabled={!newPattern.trim() || isSaving}
								style={{
									padding: '12px',
									backgroundColor: newPattern.trim() && !isSaving ? '#3b82f6' : '#9ca3af',
									color: 'white',
									border: 'none',
									borderRadius: '8px',
									cursor: newPattern.trim() && !isSaving ? 'pointer' : 'not-allowed',
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									transition: 'background-color 0.2s',
								}}
								onMouseEnter={(e) => {
									if (newPattern.trim() && !isSaving) {
										e.currentTarget.style.backgroundColor = '#2563eb';
									}
								}}
								onMouseLeave={(e) => {
									if (newPattern.trim() && !isSaving) {
										e.currentTarget.style.backgroundColor = '#3b82f6';
									}
								}}
							>
								{isSaving ? (
									<div
										style={{
											width: '16px',
											height: '16px',
											border: '2px solid white',
											borderTop: '2px solid transparent',
											borderRadius: '50%',
											animation: 'spin 1s linear infinite',
										}}
									/>
								) : (
									<Plus size={16} />
								)}
								Add
							</button>
						</div>
						<p
							style={{
								fontSize: '12px',
								color: '#6b7280',
								margin: '8px 0 0 0',
							}}
						>
							Enter URL patterns to intercept (e.g., "/api/users" will match any URL containing that pattern)
						</p>
					</div>

					{/* Pattern List */}
					<div>
						<h3
							style={{
								fontSize: '16px',
								fontWeight: '600',
								color: '#374151',
								margin: '0 0 12px 0',
							}}
						>
							Current Patterns ({patterns.length})
						</h3>

						{patterns.length === 0 ? (
							<div
								style={{
									textAlign: 'center',
									padding: '32px',
									color: '#6b7280',
									backgroundColor: '#f9fafb',
									borderRadius: '8px',
									border: '2px dashed #d1d5db',
								}}
							>
								<p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>No URL patterns configured</p>
								<p style={{ margin: 0, fontSize: '14px' }}>Add a pattern above to start intercepting requests</p>
							</div>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
								{patterns.map((pattern) => (
									<div
										key={pattern.id}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '12px',
											padding: '16px',
											backgroundColor: pattern.enabled ? '#f0fdf4' : '#f9fafb',
											border: `2px solid ${pattern.enabled ? '#bbf7d0' : '#e5e7eb'}`,
											borderRadius: '8px',
											transition: 'all 0.2s',
										}}
									>
										<div style={{ flex: 1 }}>
											{editingPattern === pattern.id ? (
												<input
													type='text'
													value={editValue}
													onChange={(e) => setEditValue(e.target.value)}
													onKeyDown={handleEditKeyPress}
													autoFocus
													style={{
														width: '100%',
														padding: '8px 12px',
														border: '2px solid #3b82f6',
														borderRadius: '6px',
														fontSize: '14px',
														fontFamily: 'Monaco, Consolas, monospace',
														outline: 'none',
														backgroundColor: '#ffffff',
													}}
												/>
											) : (
												<>
													<code
														style={{
															backgroundColor: pattern.enabled ? '#dcfce7' : '#f3f4f6',
															color: pattern.enabled ? '#166534' : '#6b7280',
															padding: '4px 8px',
															borderRadius: '4px',
															fontSize: '14px',
															fontFamily: 'Monaco, Consolas, monospace',
														}}
													>
														{pattern.pattern}
													</code>
													<div
														style={{
															fontSize: '12px',
															color: '#6b7280',
															marginTop: '4px',
														}}
													>
														Added {new Date(pattern.createdAt).toLocaleDateString()}
													</div>
												</>
											)}
										</div>

										{editingPattern === pattern.id ? (
											<>
												<button
													onClick={handleSaveEdit}
													disabled={!editValue.trim()}
													style={{
														padding: '8px',
														backgroundColor: !editValue.trim() ? '#e5e7eb' : '#22c55e',
														color: !editValue.trim() ? '#9ca3af' : 'white',
														border: 'none',
														borderRadius: '6px',
														cursor: !editValue.trim() ? 'not-allowed' : 'pointer',
														transition: 'all 0.2s',
													}}
													onMouseEnter={(e) => {
														if (editValue.trim()) {
															e.currentTarget.style.backgroundColor = '#16a34a';
														}
													}}
													onMouseLeave={(e) => {
														if (editValue.trim()) {
															e.currentTarget.style.backgroundColor = '#22c55e';
														}
													}}
													title='Save changes'
												>
													<Check size={16} />
												</button>
												<button
													onClick={handleCancelEdit}
													style={{
														padding: '8px',
														backgroundColor: 'transparent',
														color: '#6b7280',
														border: 'none',
														borderRadius: '6px',
														cursor: 'pointer',
														transition: 'all 0.2s',
													}}
													onMouseEnter={(e) => {
														e.currentTarget.style.backgroundColor = '#f3f4f6';
														e.currentTarget.style.color = '#374151';
													}}
													onMouseLeave={(e) => {
														e.currentTarget.style.backgroundColor = 'transparent';
														e.currentTarget.style.color = '#6b7280';
													}}
													title='Cancel editing'
												>
													<CancelIcon size={16} />
												</button>
											</>
										) : (
											<>
												<button
													onClick={() => handleEditPattern(pattern)}
													style={{
														padding: '8px',
														backgroundColor: 'transparent',
														border: 'none',
														borderRadius: '6px',
														cursor: 'pointer',
														color: '#6b7280',
														transition: 'all 0.2s',
													}}
													onMouseEnter={(e) => {
														e.currentTarget.style.backgroundColor = '#f3f4f6';
														e.currentTarget.style.color = '#3b82f6';
													}}
													onMouseLeave={(e) => {
														e.currentTarget.style.backgroundColor = 'transparent';
														e.currentTarget.style.color = '#6b7280';
													}}
													title='Edit pattern'
												>
													<Edit2 size={16} />
												</button>
												<button
													onClick={() => handleTogglePattern(pattern.id, !pattern.enabled)}
													style={{
														padding: '8px',
														backgroundColor: 'transparent',
														border: 'none',
														borderRadius: '6px',
														cursor: 'pointer',
														color: pattern.enabled ? '#22c55e' : '#6b7280',
														transition: 'all 0.2s',
													}}
													onMouseEnter={(e) => {
														e.currentTarget.style.backgroundColor = pattern.enabled ? '#f0fdf4' : '#f3f4f6';
													}}
													onMouseLeave={(e) => {
														e.currentTarget.style.backgroundColor = 'transparent';
													}}
													title={pattern.enabled ? 'Disable pattern' : 'Enable pattern'}
												>
													{pattern.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
												</button>
											</>
										)}

										<button
											onClick={() => handleDeletePattern(pattern.id)}
											style={{
												padding: '8px',
												backgroundColor: 'transparent',
												border: 'none',
												borderRadius: '6px',
												cursor: 'pointer',
												color: '#ef4444',
												transition: 'all 0.2s',
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.backgroundColor = '#fef2f2';
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.backgroundColor = 'transparent';
											}}
											title='Delete pattern'
										>
											<Trash2 size={16} />
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div
					style={{
						backgroundColor: '#f8fafc',
						borderTop: '1px solid #e2e8f0',
						padding: '16px 24px',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
					}}
				>
					<div style={{ fontSize: '12px', color: '#6b7280' }}>Changes are saved automatically</div>
					<button
						onClick={onClose}
						style={{
							padding: '8px 16px',
							backgroundColor: '#3b82f6',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							fontSize: '14px',
							fontWeight: '500',
							transition: 'background-color 0.2s',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#2563eb';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#3b82f6';
						}}
					>
						Done
					</button>
				</div>
			</div>
		</div>
	);
};

export default Settings;
