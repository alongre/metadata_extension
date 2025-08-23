import React from 'react';
import { RefreshCw, Trash2, Calendar, Globe, Settings } from 'lucide-react';
import { CapturedRequest } from '../types';

interface SidebarProps {
	requests: CapturedRequest[];
	selectedRequest: CapturedRequest | null;
	onSelectRequest: (request: CapturedRequest) => void;
	onDeleteRequest: (requestId: string) => void;
	onRefresh: () => void;
	onOpenSettings: () => void;
	onClearAll: () => void;
	overriddenUrls: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
	requests,
	selectedRequest,
	onSelectRequest,
	onDeleteRequest,
	onRefresh,
	onOpenSettings,
	onClearAll,
	overriddenUrls,
}) => {
	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	};

	// Sort by last modified: overrideUpdatedAt > completedAt > timestamp (desc)
	const sorted = [...requests].sort((a, b) => {
		const aMod = a.overrideUpdatedAt ?? a.completedAt ?? a.timestamp;
		const bMod = b.overrideUpdatedAt ?? b.completedAt ?? b.timestamp;
		return bMod - aMod;
	});

	return (
		<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			{/* Header */}
			<div
				style={{
					backgroundColor: '#2563eb',
					color: 'white',
					padding: '16px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<img
							src={chrome.runtime.getURL('icons/network_wizard_icon_128.png')}
							alt='Network Wizard'
							style={{
								width: '24px',
								height: '24px',
								borderRadius: '4px',
							}}
						/>
						<h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Metadata Wizard</h1>
					</div>
					<div style={{ display: 'flex', gap: '8px' }}>
						<button
							onClick={onOpenSettings}
							style={{
								padding: '8px',
								backgroundColor: 'transparent',
								border: 'none',
								borderRadius: '6px',
								color: 'white',
								cursor: 'pointer',
							}}
							onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
							onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
							title='Settings'
						>
							<Settings size={16} />
						</button>
						<button
							onClick={onClearAll}
							style={{
								padding: '8px',
								backgroundColor: 'transparent',
								border: 'none',
								borderRadius: '6px',
								color: 'white',
								cursor: 'pointer',
							}}
							onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
							onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
							title='Clear All Requests'
						>
							<Trash2 size={16} />
						</button>
						<button
							onClick={onRefresh}
							style={{
								padding: '8px',
								backgroundColor: 'transparent',
								border: 'none',
								borderRadius: '6px',
								color: 'white',
								cursor: 'pointer',
							}}
							onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
							onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
							title='Refresh'
						>
							<RefreshCw size={16} />
						</button>
					</div>
				</div>
				<div
					style={{
						marginTop: '8px',
						color: '#bfdbfe',
						fontSize: '14px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<span>
						{requests.length} captured request{requests.length !== 1 ? 's' : ''}
					</span>
					{overriddenUrls.length > 0 && (
						<span style={{ color: '#fed7aa', marginLeft: 'auto', paddingRight: '1rem' }}>
							{overriddenUrls.length} active override{overriddenUrls.length > 1 ? 's' : ''}
						</span>
					)}
					<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
						<div
							style={{
								width: '8px',
								height: '8px',
								backgroundColor: '#22c55e',
								borderRadius: '50%',
								animation: 'pulse 2s infinite',
							}}
						/>
						<span style={{ fontSize: '12px' }}>Live</span>
					</div>
				</div>
			</div>

			{/* Request List */}
			<div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
				{requests.length === 0 ? (
					<div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
						<div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
							<Globe size={48} style={{ color: '#d1d5db' }} />
						</div>
						<p style={{ fontWeight: '500', margin: '0 0 8px 0' }}>No requests captured</p>
						<p style={{ fontSize: '14px', margin: 0, lineHeight: '1.4' }}>
							Navigate to a page with
							<br />
							<code
								style={{
									backgroundColor: '#f3f4f6',
									padding: '4px 8px',
									borderRadius: '4px',
									fontSize: '12px',
									fontFamily: 'monospace',
								}}
							>
								Matching URL patterns
							</code>
							<br />
							endpoints
						</p>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						{sorted.map((request) => (
							<div
								key={request.id}
								style={{
									padding: '16px',
									borderRadius: '8px',
									border: selectedRequest?.id === request.id ? '2px solid #3b82f6' : '2px solid #e5e7eb',
									backgroundColor: selectedRequest?.id === request.id ? '#eff6ff' : '#ffffff',
									cursor: 'pointer',
									transition: 'all 0.2s',
									boxShadow:
										selectedRequest?.id === request.id
											? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
											: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
								}}
								onMouseEnter={(e) => {
									if (selectedRequest?.id !== request.id) {
										e.currentTarget.style.borderColor = '#d1d5db';
										e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
									}
								}}
								onMouseLeave={(e) => {
									if (selectedRequest?.id !== request.id) {
										e.currentTarget.style.borderColor = '#e5e7eb';
										e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
									}
								}}
								onClick={() => onSelectRequest(request)}
							>
								<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
									<div style={{ flex: 1, minWidth: 0 }}>
										{/* Endpoint Name */}
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
											<h3
												style={{
													fontWeight: '600',
													color: '#111827',
													margin: 0,
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
												}}
											>
												{request.endpoint}
											</h3>
											{request.isOverridden && (
												<span
													style={{
														backgroundColor: '#fed7aa',
														color: '#9a3412',
														fontSize: '12px',
														padding: '2px 8px',
														borderRadius: '9999px',
													}}
												>
													Modified
												</span>
											)}
											{/* Response label removed as requested */}
											{request.responseData === undefined && request.completed && (
												<span
													style={{
														backgroundColor: '#fee2e2',
														color: '#dc2626',
														fontSize: '12px',
														padding: '2px 8px',
														borderRadius: '9999px',
													}}
												>
													⚠ No Data
												</span>
											)}
										</div>

										{/* Method Badge */}
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
											<span
												style={{
													padding: '4px 8px',
													fontSize: '12px',
													fontWeight: '500',
													borderRadius: '4px',
													backgroundColor: request.method === 'GET' ? '#dcfce7' : '#dbeafe',
													color: request.method === 'GET' ? '#166534' : '#1e40af',
												}}
											>
												{request.method}
											</span>
											<div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#6b7280' }}>
												<Calendar size={12} style={{ marginRight: '4px' }} />
												{formatTime(request.timestamp)}
											</div>
										</div>

										{/* URL */}
										<p
											style={{
												fontSize: '12px',
												color: '#6b7280',
												margin: 0,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}
										>
											{request.url}
										</p>
									</div>

									{/* Delete Button */}
									<button
										onClick={(e) => {
											e.stopPropagation();
											onDeleteRequest(request.id);
										}}
										style={{
											marginLeft: '8px',
											padding: '8px',
											color: '#9ca3af',
											backgroundColor: 'transparent',
											border: 'none',
											borderRadius: '6px',
											cursor: 'pointer',
											transition: 'all 0.2s',
											opacity: 1,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.color = '#dc2626';
											e.currentTarget.style.backgroundColor = '#fef2f2';
											e.currentTarget.style.transform = 'scale(1.1)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.color = '#9ca3af';
											e.currentTarget.style.backgroundColor = 'transparent';
											e.currentTarget.style.transform = 'scale(1)';
										}}
										title='Delete request'
									>
										<Trash2 size={16} />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default Sidebar;
