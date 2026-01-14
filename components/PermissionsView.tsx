import React, { useState, useEffect } from 'react';
import { meshPermissions, UserPermissions, PermissionRequest } from '../services/meshPermissions';
import { bluetoothMesh } from '../services/bluetoothMesh';

const PermissionsView: React.FC = () => {
  const [myPermissions, setMyPermissions] = useState<UserPermissions | null>(null);
  const [grantedPermissions, setGrantedPermissions] = useState<UserPermissions[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<PermissionRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<PermissionRequest[]>([]);
  const [nearbyNodes, setNearbyNodes] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    nodeId: '',
    requestedPermissions: [] as string[],
    message: ''
  });

  useEffect(() => {
    initializePermissions();
  }, []);

  const initializePermissions = () => {
    // Load current permissions
    setMyPermissions(meshPermissions.getMyPermissions());
    setGrantedPermissions(meshPermissions.getGrantedPermissions());
    setReceivedRequests(meshPermissions.getReceivedRequests());
    setSentRequests(meshPermissions.getSentRequests());

    // Load nearby nodes
    setNearbyNodes(bluetoothMesh.getPeers());

    // Subscribe to permission updates
    const unsubscribeUpdated = meshPermissions.subscribe('permissionsUpdated', (permissions) => {
      setMyPermissions(permissions);
    });

    const unsubscribeGranted = meshPermissions.subscribe('permissionsGranted', (permissions) => {
      setGrantedPermissions(prev => [permissions, ...prev.filter(p => p.nodeId !== permissions.nodeId)]);
    });

    const unsubscribeRequestReceived = meshPermissions.subscribe('permissionRequestReceived', (request) => {
      setReceivedRequests(prev => [request, ...prev]);
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeGranted();
      unsubscribeRequestReceived();
    };
  };

  const handleMyPermissionChange = (permission: keyof UserPermissions['grantedPermissions'], value: boolean) => {
    if (!myPermissions) return;
    
    meshPermissions.updateMyPermissions({
      [permission]: value
    });
  };

  const handleApproveRequest = (requestId: string) => {
    const request = receivedRequests.find(r => r.id === requestId);
    if (!request) return;

    // Grant all requested permissions for simplicity
    meshPermissions.approvePermissionRequest(requestId, request.requestedPermissions);
    setReceivedRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const handleDenyRequest = (requestId: string) => {
    meshPermissions.denyPermissionRequest(requestId);
    setReceivedRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const handleSendRequest = async () => {
    if (!requestForm.nodeId || requestForm.requestedPermissions.length === 0) return;

    try {
      await meshPermissions.requestPermissions(
        requestForm.nodeId,
        '',
        requestForm.requestedPermissions,
        requestForm.message
      );
      
      setShowRequestModal(false);
      setRequestForm({ nodeId: '', requestedPermissions: [], message: '' });
      alert('Permission request sent!');
    } catch (error) {
      alert('Failed to send permission request');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'profileView': return 'fa-user';
      case 'chatAccess': return 'fa-message';
      case 'marketplaceView': return 'fa-shop';
      case 'proximityData': return 'fa-location-dot';
      case 'nodeStatus': return 'fa-wifi';
      default: return 'fa-shield';
    }
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case 'profileView': return 'View Profile';
      case 'chatAccess': return 'Chat Access';
      case 'marketplaceView': return 'Marketplace Access';
      case 'proximityData': return 'Proximity Data';
      case 'nodeStatus': return 'Online Status';
      default: return permission;
    }
  };

  if (!myPermissions) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
        <div className="text-center py-20">
          <i className="fa-solid fa-spinner fa-spin text-4xl opacity-20 mb-4"></i>
          <p className="text-sm opacity-60">Loading permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-current pb-4">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tighter glow-text">permissions.exe</h2>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white/30">privacy_and_access_control</p>
        </div>
        <button 
          onClick={() => setShowRequestModal(true)}
          className="terminal-btn active px-4 py-2 text-[10px] uppercase"
        >
          request_permissions
        </button>
      </div>

      {/* My Permissions */}
      <div className="mb-8">
        <h3 className="text-lg font-bold uppercase mb-4">my_default_permissions</h3>
        <p className="text-xs opacity-60 mb-4">These permissions apply to all users by default. You can override them for specific users.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(myPermissions.grantedPermissions).map(([permission, granted]) => (
            <div key={permission} className="border border-current border-opacity-20 p-4 bg-[#050505]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${getPermissionIcon(permission)} text-lg`}></i>
                  <span className="font-bold text-white">{getPermissionLabel(permission)}</span>
                </div>
                <button
                  onClick={() => handleMyPermissionChange(permission as keyof UserPermissions['grantedPermissions'], !granted)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    granted ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                    granted ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
              </div>
              <p className="text-xs opacity-40 mt-2">
                {granted ? 'Allowed by default' : 'Requires explicit permission'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Permission Requests */}
      {receivedRequests.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold uppercase mb-4">pending_requests</h3>
          <div className="space-y-4">
            {receivedRequests.map(request => (
              <div key={request.id} className="border border-current border-opacity-20 p-4 bg-[#050505]">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-white">Request from {request.fromNode}</p>
                    <p className="text-xs opacity-60">{request.message}</p>
                    <p className="text-[8px] opacity-40">{formatTimestamp(request.timestamp)}</p>
                  </div>
                  <span className="text-xs bg-amber-500 text-black px-2 py-1 rounded">
                    pending
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {request.requestedPermissions.map(perm => (
                    <span key={perm} className="text-xs bg-current/20 px-2 py-1 rounded">
                      <i className={`fa-solid ${getPermissionIcon(perm)} mr-1`}></i>
                      {getPermissionLabel(perm)}
                    </span>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApproveRequest(request.id)}
                    className="terminal-btn active px-3 py-1 text-[8px] uppercase"
                  >
                    approve
                  </button>
                  <button 
                    onClick={() => handleDenyRequest(request.id)}
                    className="terminal-btn px-3 py-1 text-[8px] uppercase"
                  >
                    deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Granted Permissions */}
      {grantedPermissions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold uppercase mb-4">granted_permissions</h3>
          <div className="space-y-4">
            {grantedPermissions.map(user => (
              <div key={user.nodeId} className="border border-current border-opacity-20 p-4 bg-[#050505]">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-white">{user.handle || user.nodeId}</p>
                    <p className="text-xs opacity-40">Granted {formatTimestamp(user.lastUpdated)}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {Object.entries(user.grantedPermissions)
                    .filter(([_, granted]) => granted)
                    .map(([permission]) => (
                      <span key={permission} className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded">
                        <i className={`fa-solid ${getPermissionIcon(permission)} mr-1`}></i>
                        {getPermissionLabel(permission)}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold uppercase mb-4">sent_requests</h3>
          <div className="space-y-4">
            {sentRequests.map(request => (
              <div key={request.id} className="border border-current border-opacity-20 p-4 bg-[#050505]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white">To: {request.toNode}</p>
                    <p className="text-xs opacity-60">{request.message}</p>
                    <p className="text-[8px] opacity-40">{formatTimestamp(request.timestamp)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    request.status === 'approved' ? 'bg-green-500 text-black' :
                    request.status === 'denied' ? 'bg-red-500 text-white' :
                    'bg-amber-500 text-black'
                  }`}>
                    {request.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text text-center">request_permissions.exe</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">select_node</p>
                <select 
                  value={requestForm.nodeId}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, nodeId: e.target.value }))}
                  className="w-full bg-black border border-current p-3 text-xs text-white"
                >
                  <option value="">Select nearby node...</option>
                  {nearbyNodes.map(node => (
                    <option key={node.id} value={node.id}>{node.handle}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">requested_permissions</p>
                <div className="space-y-2">
                  {['profileView', 'chatAccess', 'marketplaceView', 'proximityData', 'nodeStatus'].map(permission => (
                    <label key={permission} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={requestForm.requestedPermissions.includes(permission)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRequestForm(prev => ({
                              ...prev,
                              requestedPermissions: [...prev.requestedPermissions, permission]
                            }));
                          } else {
                            setRequestForm(prev => ({
                              ...prev,
                              requestedPermissions: prev.requestedPermissions.filter(p => p !== permission)
                            }));
                          }
                        }}
                        className="bg-black border-current"
                      />
                      <span className="text-xs">
                        <i className={`fa-solid ${getPermissionIcon(permission)} mr-1`}></i>
                        {getPermissionLabel(permission)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <textarea 
                value={requestForm.message}
                onChange={(e) => setRequestForm(prev => ({ ...prev, message: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white min-h-[80px] placeholder-white/20" 
                placeholder="message_to_user..." 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowRequestModal(false)} className="terminal-btn py-3 uppercase text-[10px]">
                  cancel
                </button>
                <button onClick={handleSendRequest} className="terminal-btn active py-3 uppercase text-[10px]">
                  send_request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionsView;
