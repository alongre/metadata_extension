import React, { useRef, useState } from 'react';
import { RefreshCw, Trash2, Calendar, Globe, Settings, Maximize2, Minimize2, Pin } from 'lucide-react';
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
	displayMode: 'docked' | 'undocked';
	onToggleDisplayMode: () => void;
	pinnedRequestIds: string[];
	onSetPinnedRequestIds: (ids: string[]) => void;
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
	displayMode,
	onToggleDisplayMode,
	pinnedRequestIds,
	onSetPinnedRequestIds,
}) => {
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragSourceIndex = useRef<number | null>(null);

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	};

	const pinnedSet = new Set(pinnedRequestIds);
	const requestMap = new Map(requests.map((r) => [r.id, r]));

	// Pinned: preserve explicit order from pinnedRequestIds, filter out missing
	const pinned = pinnedRequestIds.map((id) => requestMap.get(id)).filter((r): r is CapturedRequest => r !== undefined);

	// Unpinned: remaining requests with current auto-sort (overridden first, then recency)
	const unpinned = requests
		.filter((r) => !pinnedSet.has(r.id))
		.sort((a, b) => {
			if (a.isOverridden && !b.isOverridden) return -1;
			if (!a.isOverridden && b.isOverridden) return 1;
			const aMod = a.overrideUpdatedAt ?? a.completedAt ?? a.timestamp;
			const bMod = b.overrideUpdatedAt ?? b.completedAt ?? b.timestamp;
			return bMod - aMod;
		});

	const togglePin = (requestId: string) => {
		if (pinnedSet.has(requestId)) {
			onSetPinnedRequestIds(pinnedRequestIds.filter((id) => id !== requestId));
		} else {
			onSetPinnedRequestIds([...pinnedRequestIds, requestId]);
		}
	};

	const handleDragStart = (index: number) => {
		dragSourceIndex.current = index;
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		setDragOverIndex(index);
	};

	const handleDragLeave = () => {
		setDragOverIndex(null);
	};

	const handleDrop = (e: React.DragEvent, dropIndex: number) => {
		e.preventDefault();
		setDragOverIndex(null);
		const sourceIndex = dragSourceIndex.current;
		if (sourceIndex === null || sourceIndex === dropIndex) return;
		const newIds = [...pinnedRequestIds];
		const [moved] = newIds.splice(sourceIndex, 1);
		newIds.splice(dropIndex, 0, moved);
		onSetPinnedRequestIds(newIds);
		dragSourceIndex.current = null;
	};

	const handleDragEnd = () => {
		setDragOverIndex(null);
		dragSourceIndex.current = null;
	};

	const renderCard = (
		request: CapturedRequest,
		isPinned: boolean,
		dragHandlers?: {
			index: number;
		}
	) => (
		<div
			key={request.id}
			draggable={isPinned}
			onDragStart={dragHandlers ? () => handleDragStart(dragHandlers.index) : undefined}
			onDragOver={dragHandlers ? (e) => handleDragOver(e, dragHandlers.index) : undefined}
			onDragLeave={dragHandlers ? handleDragLeave : undefined}
			onDrop={dragHandlers ? (e) => handleDrop(e, dragHandlers.index) : undefined}
			onDragEnd={dragHandlers ? handleDragEnd : undefined}
			style={{
				padding: '16px',
				borderRadius: '8px',
				border:
					dragOverIndex === dragHandlers?.index
						? '2px solid #3b82f6'
						: selectedRequest?.id === request.id
							? '2px solid #3b82f6'
							: '2px solid #e5e7eb',
				backgroundColor:
					dragOverIndex === dragHandlers?.index
						? '#dbeafe'
						: selectedRequest?.id === request.id
							? '#eff6ff'
							: '#ffffff',
				cursor: isPinned ? 'grab' : 'pointer',
				transition: 'all 0.2s',
				boxShadow:
					selectedRequest?.id === request.id
						? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
						: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
			}}
			onMouseEnter={(e) => {
				if (selectedRequest?.id !== request.id && dragOverIndex !== dragHandlers?.index) {
					e.currentTarget.style.borderColor = '#d1d5db';
					e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
				}
			}}
			onMouseLeave={(e) => {
				if (selectedRequest?.id !== request.id && dragOverIndex !== dragHandlers?.index) {
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

				{/* Action Buttons */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '8px' }}>
					{/* Pin Button */}
					<button
						onClick={(e) => {
							e.stopPropagation();
							togglePin(request.id);
						}}
						style={{
							padding: '6px',
							color: isPinned ? '#3b82f6' : '#9ca3af',
							backgroundColor: 'transparent',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							transition: 'all 0.2s',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.color = isPinned ? '#2563eb' : '#3b82f6';
							e.currentTarget.style.backgroundColor = '#eff6ff';
							e.currentTarget.style.transform = 'scale(1.1)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.color = isPinned ? '#3b82f6' : '#9ca3af';
							e.currentTarget.style.backgroundColor = 'transparent';
							e.currentTarget.style.transform = 'scale(1)';
						}}
						title={isPinned ? 'Unpin request' : 'Pin request'}
					>
						<Pin size={14} style={isPinned ? { fill: '#3b82f6' } : undefined} />
					</button>
					{/* Delete Button */}
					<button
						onClick={(e) => {
							e.stopPropagation();
							onDeleteRequest(request.id);
						}}
						style={{
							padding: '6px',
							color: '#9ca3af',
							backgroundColor: 'transparent',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							transition: 'all 0.2s',
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
						<Trash2 size={14} />
					</button>
				</div>
			</div>
		</div>
	);

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
							onClick={onToggleDisplayMode}
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
							title={displayMode === 'docked' ? 'Undock to Window' : 'Dock to Popup'}
						>
							{displayMode === 'docked' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
						</button>
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
						{/* Pinned Section */}
						{pinned.length > 0 && (
							<>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '6px',
										fontSize: '12px',
										fontWeight: '600',
										color: '#3b82f6',
										textTransform: 'uppercase',
										letterSpacing: '0.05em',
									}}
								>
									<Pin size={12} />
									Pinned
								</div>
								{pinned.map((request, index) => renderCard(request, true, { index }))}
							</>
						)}
						{/* Divider */}
						{pinned.length > 0 && unpinned.length > 0 && (
							<div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
						)}
						{/* Unpinned Section */}
						{unpinned.map((request) => renderCard(request, false))}
					</div>
				)}
			</div>
		</div>
	);
};

export default Sidebar;
