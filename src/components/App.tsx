import React, { useState, useEffect } from 'react';
import { CapturedRequest } from '../types';
import Sidebar from './Sidebar';
import JsonEditor from './JsonEditor';
import Settings from './Settings';

const App: React.FC = () => {
	const [requests, setRequests] = useState<CapturedRequest[]>([]);
	const [selectedRequest, setSelectedRequest] = useState<CapturedRequest | null>(null);
	const [sidebarWidth, setSidebarWidth] = useState(250);
	const [isResizing, setIsResizing] = useState(false);
	const [showSettings, setShowSettings] = useState(false);

	useEffect(() => {
		loadRequests();

		// Listen for real-time request updates from background script
		const messageListener = (message: any) => {
			if (message.type === 'REQUEST_COMPLETED') {
				console.log('🔄 New request completed, refreshing list:', message.request.endpoint);
				loadRequests(); // Refresh the list when new requests come in
			}
		};

		chrome.runtime.onMessage.addListener(messageListener);

		// Set up auto-refresh every 5 seconds to catch any missed updates
		const autoRefreshInterval = setInterval(() => {
			loadRequests();
		}, 5000);

		return () => {
			chrome.runtime.onMessage.removeListener(messageListener);
			clearInterval(autoRefreshInterval);
		};
	}, []);

	const loadRequests = async () => {
		try {
			const response = await chrome.runtime.sendMessage({ type: 'GET_REQUESTS' });
			const requestsArray = (Object.values(response || {}) as CapturedRequest[])
				.filter((r) => r.responseData !== undefined)
				.sort((a, b) => b.timestamp - a.timestamp);
			setRequests(requestsArray);
			// If the current selection has no response or was removed, clear it
			if (selectedRequest && !requestsArray.find((r) => r.id === selectedRequest.id)) {
				setSelectedRequest(null);
			}
		} catch (error) {
			console.error('Failed to load requests:', error);
		}
	};

	const handleDeleteRequest = async (requestId: string) => {
		try {
			await chrome.runtime.sendMessage({
				type: 'DELETE_REQUEST',
				requestId,
			});
			setRequests((prev) => prev.filter((req) => req.id !== requestId));
			if (selectedRequest?.id === requestId) {
				setSelectedRequest(null);
			}
		} catch (error) {
			console.error('Failed to delete request:', error);
		}
	};

	const handleSaveOverride = async (requestId: string, data: any) => {
		try {
			await chrome.runtime.sendMessage({
				type: 'SAVE_OVERRIDE',
				requestId,
				data,
			});
			// Update local state
			setRequests((prev) =>
				prev.map((req) => (req.id === requestId ? { ...req, overrideData: data, isOverridden: true } : req))
			);
			setSelectedRequest((prev) =>
				prev?.id === requestId ? { ...prev, overrideData: data, isOverridden: true } : prev
			);
		} catch (error) {
			console.error('Failed to save override:', error);
		}
	};

	const handleClearOverride = async (requestId: string) => {
		try {
			await chrome.runtime.sendMessage({
				type: 'CLEAR_OVERRIDE',
				requestId,
			});
			// Update local state
			setRequests((prev) =>
				prev.map((req) => (req.id === requestId ? { ...req, overrideData: undefined, isOverridden: false } : req))
			);
			setSelectedRequest((prev) =>
				prev?.id === requestId ? { ...prev, overrideData: undefined, isOverridden: false } : prev
			);
		} catch (error) {
			console.error('Failed to clear override:', error);
		}
	};

	const handleClearAll = async () => {
		try {
			await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_REQUESTS' });
			setRequests([]);
			setSelectedRequest(null);
		} catch (error) {
			console.error('Failed to clear all requests:', error);
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		setIsResizing(true);
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!isResizing) return;
		const newWidth = e.clientX;
		if (newWidth >= 200 && newWidth <= 400) {
			setSidebarWidth(newWidth);
		}
	};

	const handleMouseUp = () => {
		setIsResizing(false);
	};

	useEffect(() => {
		if (isResizing) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = 'col-resize';
		} else {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = '';
		}

		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = '';
		};
	}, [isResizing]);

	return (
		<>
			<div
				style={{
					display: 'flex',
					height: '600px',
					width: '800px',
					backgroundColor: '#f3f4f6',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}
			>
				{/* Sidebar */}
				<div
					style={{
						width: `${sidebarWidth}px`,
						backgroundColor: 'white',
						boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
						flexShrink: 0,
					}}
				>
					<Sidebar
						requests={requests}
						selectedRequest={selectedRequest}
						onSelectRequest={setSelectedRequest}
						onDeleteRequest={handleDeleteRequest}
						onRefresh={loadRequests}
						onOpenSettings={() => setShowSettings(true)}
						onClearAll={handleClearAll}
					/>
				</div>

				{/* Resizer */}
				<div
					style={{
						width: '4px',
						backgroundColor: '#d1d5db',
						cursor: 'col-resize',
						transition: 'background-color 0.2s',
						flexShrink: 0,
					}}
					onMouseDown={handleMouseDown}
					onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
					onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#d1d5db')}
				/>

				{/* JSON Editor */}
				<div
					style={{
						width: `${800 - sidebarWidth - 4}px`,
						backgroundColor: 'white',
						overflow: 'hidden',
					}}
				>
					<JsonEditor
						selectedRequest={selectedRequest}
						onSaveOverride={handleSaveOverride}
						onClearOverride={handleClearOverride}
					/>
				</div>
			</div>

			{/* Settings Modal */}
			{showSettings && <Settings onClose={() => setShowSettings(false)} />}
		</>
	);
};

export default App;
